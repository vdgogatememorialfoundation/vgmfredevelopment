import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Order } from "@/types";
import { dataFile } from "@/lib/server/paths";
import { readMobileFeed } from "@/lib/server/mobile-feed";
import { addOrder } from "@/lib/server/mobile-store";
import { appCourierEstimate, appPickupAllowed, feedPreorderable, recordAppOrder } from "@/lib/server/mobile-shop";
import { findAccount } from "@/lib/server/accounts";
import { ordersForAccount, patchShopOrder } from "@/lib/server/shop-orders";
import { findShopShipment } from "@/lib/server/shop-shipments";
import { allTickets } from "@/lib/server/support-tickets";
import { savedAdminIntegrations } from "@/lib/server/admin-integrations";
import { razorpayCreds, razorpayLink, razorpayLinkCancel, sendMetaInteractive, sendMetaOrderDetails, sendMetaText } from "@/lib/server/providers";
import { offerActive } from "@/lib/promotions";
import { isValidPostal } from "@/lib/geo";

/**
 * Customer self-service & Pune Metro-style Online Ordering over WhatsApp (and website chat):
 * - Meta WhatsApp Flows (native form checkout inside WhatsApp)
 * - Meta Interactive List Picker (book catalogue bottom-sheet drawer)
 * - Meta Interactive Reply Buttons (1-tap quantity, cart, delivery mode, address confirmation)
 * - In-chat Razorpay Review & Pay card + 24-hour UPI/Card payment link
 * - Live Order Tracking & Support Ticket Status lookup
 */

type Address = { name: string; line1: string; city: string; state: string; pincode: string };
type Step = "menu" | "book" | "qty" | "more" | "delivery_mode" | "address" | "name" | "line1" | "city" | "state" | "pincode" | "email" | "confirm" | "desk";
type Session = {
  step: Step;
  cart: { id: string; quantity: number }[];
  bookId?: string;
  pickup?: boolean;
  address?: Partial<Address>;
  email?: string;
  updatedAt: string;
  deskUntil?: string;
};

const FILE = dataFile("chat-bot-sessions.json");
const IDLE_MS = 2 * 60 * 60 * 1000;
const DESK_MS = 12 * 60 * 60 * 1000;
const SITE = "https://vaidyagogate.org";

function load(): Record<string, Session> {
  try {
    const rows = JSON.parse(readFileSync(FILE, "utf8")) as Record<string, Session>;
    return rows && typeof rows === "object" ? rows : {};
  } catch {
    return {};
  }
}

function save(rows: Record<string, Session>) {
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const [key, row] of Object.entries(rows)) if (Date.parse(row.updatedAt) < cutoff) delete rows[key];
    writeFileSync(FILE, JSON.stringify(rows));
  } catch {
    /* read-only host */
  }
}

export function chatBotEnabled() {
  const whatsapp = (savedAdminIntegrations().whatsapp ?? {}) as { botEnabled?: boolean };
  return whatsapp.botEnabled !== false;
}

export function whatsAppOrderingOn() {
  const whatsapp = (savedAdminIntegrations().whatsapp ?? {}) as { orderingEnabled?: boolean };
  return whatsapp.orderingEnabled !== false;
}

export function pauseChatBot(key: string) {
  const rows = load();
  rows[key] = { ...(rows[key] ?? { step: "menu", cart: [] }), step: "desk", deskUntil: new Date(Date.now() + DESK_MS).toISOString(), updatedAt: new Date().toISOString() };
  save(rows);
}

export function resumeChatBot(key: string) {
  const rows = load();
  if (!rows[key]) return;
  rows[key] = { ...rows[key], step: "menu", deskUntil: undefined, updatedAt: new Date().toISOString() };
  save(rows);
}

type FeedBook = { id: string; title: string; author?: string; language?: string; price: number; stock?: number; stockStatus?: string; active?: boolean; preorder?: { enabled: boolean }; offer?: { price: number } };

export function catalogue(): FeedBook[] {
  return ((readMobileFeed().books ?? []) as unknown as FeedBook[]).filter(
    (book) => book.active !== false && (feedPreorderable(book as never) || (book.stockStatus !== "out_of_stock" && Number(book.stock ?? 0) > 0))
  );
}

function priceOf(book: FeedBook) {
  return offerActive(book as never) && book.offer?.price ? book.offer.price : Number(book.price) || 0;
}

function bookLabel(book: FeedBook) {
  return `${book.title}${book.language && !book.title.toLowerCase().includes(book.language.toLowerCase()) ? ` (${book.language})` : ""} · ₹${priceOf(book)}${feedPreorderable(book as never) ? " · Pre-order" : ""}`;
}

const MENU = [
  "🏛️ *Vaidya Gogate Memorial Foundation*",
  "Namaste! Welcome to our Official WhatsApp Ordering & Customer Care Desk.",
  "",
  "Reply with a number or tap an option below:",
  "1️⃣ *Order Books* (Instant WhatsApp Checkout & UPI)",
  "2️⃣ *My Orders & Live Tracking*",
  "3️⃣ *My Support Tickets*",
  "4️⃣ *Talk to Customer Care Executive*",
  "5️⃣ *My Seminar / Event Applications*",
  "6️⃣ *My Account Details*",
  "",
  "Type *menu* any time to return to the main menu.",
].join("\n");

function inr(value: number) {
  return `₹${Math.round(value * 100) / 100}`;
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function orderLine(order: Order) {
  const shipment = findShopShipment(order.id);
  const items = order.items.map((item) => `${item.title} × ${item.quantity}`).join(", ");
  const tracking = shipment?.awb ? `\n   🚚 Tracking: *${shipment.awb}*${shipment.courier ? ` (${shipment.courier})` : ""}` : "";
  const due = order.paymentStatus !== "Paid" && order.status !== "Cancelled" ? ` · Payment: ${order.paymentStatus}` : " · Paid ✅";
  return `📦 *#${order.id}* · ${new Date(order.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}\n   ${items}\n   *${inr(order.total)}* · Status: *${order.status}*${due}${tracking}\n   🔗 ${SITE}/account/orders/${encodeURIComponent(order.id)}`;
}

function myOrders(phone: string, email?: string) {
  const orders = ordersForAccount({ phone, email }).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  if (!orders.length) return `We couldn't find orders for this number yet.\n\nReply *1* to order books on WhatsApp or visit ${SITE}/account/orders.`;
  return [`📦 *Your Latest VGMF Orders:*`, "", ...orders.map(orderLine), "", `Reply *1* to order books or *4* to chat with Customer Care.`].join("\n");
}

function myTickets(phone: string, email?: string) {
  const pDigits = digits(phone).slice(-10);
  const em = (email || "").toLowerCase();
  const list = allTickets().filter((t) => {
    const tPhone = digits(t.phone || "").slice(-10);
    const tEmail = (t.email || "").toLowerCase();
    return (pDigits.length === 10 && tPhone === pDigits) || (em && tEmail === em);
  }).slice(0, 5);
  if (!list.length) {
    return `🎫 You have no open support tickets linked to this number.\n\nReply *4* to connect with a Customer Care Executive or raise a ticket at ${SITE}/account/tickets.`;
  }
  return [
    `🎫 *Your Support Tickets:*`,
    "",
    ...list.map((t) => {
      const lastReply = t.responses?.[t.responses.length - 1];
      return `• *#${t.id}* — ${t.subject}\n   Status: *${t.status}* · Updated ${new Date(t.updatedAt || t.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}${lastReply ? `\n   Latest reply (${lastReply.from}): "${lastReply.text.slice(0, 120)}"` : ""}`;
    }),
    "",
    "Reply *4* to speak with Customer Care about any ticket.",
  ].join("\n");
}

function lastAddress(phone: string, email?: string): Address | null {
  const order = ordersForAccount({ phone, email })
    .filter((row) => row.deliveryMode !== "store_pickup" && row.deliveryAddress?.line1 && row.deliveryAddress?.pincode)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const address = order?.deliveryAddress;
  return address ? { name: address.fullName, line1: [address.line1, address.landmark].filter(Boolean).join(", "), city: address.city, state: address.state, pincode: address.pincode } : null;
}

function addressText(address: Partial<Address>) {
  return [address.name, address.line1, `${address.city}, ${address.state} - ${address.pincode}`].filter(Boolean).join("\n");
}

function cartText(cart: Session["cart"]) {
  const books = catalogue();
  let sum = 0;
  const lines = cart
    .map((line) => {
      const book = books.find((row) => row.id === line.id);
      if (!book) return "";
      const lineTotal = priceOf(book) * line.quantity;
      sum += lineTotal;
      return `• ${book.title} × ${line.quantity} = *${inr(lineTotal)}*`;
    })
    .filter(Boolean);
  if (lines.length > 1) lines.push(`Subtotal: *${inr(sum)}*`);
  return lines.join("\n");
}

/** Sends native Meta Interactive Buttons / List Picker / Flow along with the reply when on Meta Cloud API. */
async function sendInteractiveHelper(key: string, phone: string, interactive: Record<string, unknown>) {
  if (!key.startsWith("meta:")) return false;
  try {
    const { loadWhatsAppCreds } = await import("@/lib/server/whatsapp-inbox");
    const creds = await loadWhatsAppCreds();
    const sent = await sendMetaInteractive(creds, { to: phone, interactive });
    return Boolean(sent?.id);
  } catch {
    return false;
  }
}

/** Sends the Pune Metro-style Interactive Book Catalogue List Drawer + Optional Meta Flow CTA. */
export async function sendWhatsAppOrderingFlowMenu(phone: string, key = `meta:${digits(phone)}`) {
  const books = catalogue();
  const whatsapp = (savedAdminIntegrations().whatsapp ?? {}) as { metaOrderingFlowId?: string; metaOrderingFlowCta?: string };
  const flowId = String(whatsapp.metaOrderingFlowId || "").trim();

  // If a Meta WhatsApp Flow ID is configured, send the native Flow CTA button first!
  if (flowId && key.startsWith("meta:")) {
    await sendInteractiveHelper(key, phone, {
      type: "flow",
      header: { type: "text", text: "VGMF Book Store · Instant Order" },
      body: {
        text: "Tap below to open the VGMF Book Ordering Flow, select your books, quantity & delivery address, and pay securely inside WhatsApp.",
      },
      footer: { text: "Vaidya Gogate Memorial Foundation" },
      action: {
        name: "flow",
        parameters: {
          flow_message_version: "3",
          flow_token: `vgmf_flow_${digits(phone)}_${Date.now()}`,
          flow_id: flowId,
          flow_cta: String(whatsapp.metaOrderingFlowCta || "Order Books Now").slice(0, 20),
          flow_action: "navigate",
        },
      },
    });
  }

  // Send native WhatsApp Interactive List Picker of all available books (up to 10 rows per WhatsApp spec)
  if (books.length && key.startsWith("meta:")) {
    await sendInteractiveHelper(key, phone, {
      type: "list",
      header: { type: "text", text: "📘 VGMF Official Publications" },
      body: {
        text: "Tap *Select a Book* below to choose a publication from the Vaidya Gogate Memorial Foundation catalogue:",
      },
      footer: { text: "Instant UPI & Razorpay payment on WhatsApp" },
      action: {
        button: "Select a Book",
        sections: [
          {
            title: "Available Publications",
            rows: books.slice(0, 10).map((b, idx) => ({
              id: `book:${idx + 1}`,
              title: b.title.slice(0, 24),
              description: `₹${priceOf(b)}${b.language ? ` · ${b.language}` : ""}${feedPreorderable(b as never) ? " (Pre-order)" : " · In Stock"}`.slice(0, 72),
            })),
          },
        ],
      },
    });
  }
}

async function placeOrder(phone: string, session: Session, key = ""): Promise<string> {
  const books = catalogue();
  const items = session.cart
    .map((line) => {
      const book = books.find((row) => row.id === line.id);
      return book ? { id: book.id, title: book.title, quantity: line.quantity, price: priceOf(book) } : null;
    })
    .filter((item): item is { id: string; title: string; quantity: number; price: number } => Boolean(item));
  if (!items.length) return "Your bag is empty. Reply *1* to choose a book.";
  const isPickup = Boolean(session.pickup);
  const address: Address = isPickup
    ? {
        name: session.address?.name || "Store Pickup Customer",
        line1: "VGMF Store Pickup, Pune",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411030",
      }
    : (session.address as Address);
  const email = session.email || `${digits(phone)}@whatsapp.vaidyagogate.org`;
  const draft = addOrder({
    email,
    name: address.name,
    phone: `+${digits(phone)}`,
    items,
    address: { line1: address.line1, city: address.city, state: address.state, pincode: address.pincode, country: "India", countryCode: "IN" },
  });
  const feed = readMobileFeed();
  const preorder = items.some((item) => feedPreorderable((feed.books ?? []).find((row) => String(row.id) === item.id) as never));
  const courierMode = ((feed.orderSettings ?? {}) as { shippingFeeMode?: string }).shippingFeeMode === "courier_rate";
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  const courierFee =
    !isPickup && !preorder && courierMode
      ? ((await appCourierEstimate(draft.subtotal, units, address.pincode, items.map((item) => ({ bookId: item.id, quantity: item.quantity }))).catch(() => undefined)) ?? null)
      : undefined;
  const order = recordAppOrder(draft, {
    name: address.name,
    phone: `+${digits(phone)}`,
    address: { ...address, country: "India", countryCode: "IN" },
    pickup: isPickup,
    courierFee,
  });
  const payNow = order.preorderPayment?.advance ?? order.total;
  const creds = razorpayCreds({});
  if (!creds) return `Order #${order.id} is saved. Our team will send you the payment link shortly.`;
  const link = await razorpayLink(creds, {
    amount: payNow,
    orderId: order.id,
    name: address.name,
    email: session.email,
    phone: `+${digits(phone)}`,
    description: `Order ${order.id} · Vaidya Gogate Memorial Foundation`,
    expiryHours: 24,
  });
  const now = new Date().toISOString();
  patchShopOrder(order.id, {
    createdBy: "WhatsApp",
    paymentMethod: "Razorpay payment link",
    paymentLink: { url: link.url, id: link.id, provider: "razorpay", createdAt: now, amount: payNow, purpose: order.preorderPayment ? "advance" : undefined },
    history: [{ at: now, status: "Pending", note: "Placed on WhatsApp Ordering Flow; payment link sent." }],
  });
  const inChatSent = await payInChat(key, phone, order, payNow).catch(() => false);
  const lines = [
    `🎟️ *VGMF WHATSAPP ORDER #${order.id}*`,
    "━━━━━━━━━━━━━━━━━━━━━━━━",
    cartText(session.cart),
    order.platformFee ? `Platform fee: ${inr(order.platformFee)}` : "",
    isPickup
      ? "🏬 Delivery Mode: *Store Pickup (FREE)*"
      : order.shipping
        ? `🚚 Courier Charge: ${inr(order.shipping)}`
        : order.preorderPayment
          ? "🚚 Courier: charged when the book is ready to ship"
          : order.shippingDue
            ? "🚚 Courier: calculated once packed"
            : "🚚 Delivery: *FREE*",
    `💰 Order Total: *${inr(order.total)}*`,
    order.preorderPayment ? `⚡ Pay Now (Pre-order Advance): *${inr(payNow)}*` : "",
    "━━━━━━━━━━━━━━━━━━━━━━━━",
    inChatSent
      ? `👉 Tap *Review and Pay* on the card above to pay via UPI inside WhatsApp, OR tap this secure Razorpay link (valid 24h):\n${link.url}`
      : `👉 *Tap to Pay via UPI / Card / NetBanking (valid 24h):*\n${link.url}`,
    "",
    "✅ Your e-receipt & tracking will be sent right here on WhatsApp automatically once payment is completed.",
  ];
  return lines.filter((line, index, all) => line !== "" || all[index - 1] !== "").join("\n");
}

/** Handles a one-shot Meta WhatsApp Flow JSON submission (nfm_reply). */
async function handleMetaFlowSubmission(key: string, phone: string, flowJsonRaw: string, session: Session): Promise<string | null> {
  try {
    const data = JSON.parse(flowJsonRaw) as Record<string, unknown>;
    const books = catalogue();
    const bookIdRaw = String(data.book_id || data.bookId || data.publication || "").trim();
    const matchedBook =
      books.find((b) => String(b.id) === bookIdRaw || b.title.toLowerCase().includes(bookIdRaw.toLowerCase())) ||
      books[Number(digits(bookIdRaw)) - 1] ||
      books[0];
    if (!matchedBook) return null;
    const qty = Math.max(1, Math.min(20, Number(data.quantity || 1) || 1));
    const isPickup = String(data.delivery_mode || "").toLowerCase() === "pickup";
    session.cart = [{ id: matchedBook.id, quantity: qty }];
    session.pickup = isPickup;
    session.address = {
      name: String(data.full_name || data.name || "Customer").trim(),
      line1: String(data.address_line1 || data.line1 || data.address || "VGMF Store Pickup").trim(),
      city: String(data.city || "Pune").trim(),
      state: String(data.state || "Maharashtra").trim(),
      pincode: digits(String(data.pincode || "411030")).slice(0, 6) || "411030",
    };
    if (typeof data.email === "string" && data.email.includes("@")) {
      session.email = data.email.trim().toLowerCase();
    }
    const reply = await placeOrder(phone, session, key);
    session.step = "menu";
    session.cart = [];
    return reply;
  } catch {
    return null;
  }
}

export async function chatBotReply(
  key: string,
  phone: string,
  text: string,
  profileName?: string,
  cart?: { id: string; quantity: number }[],
  flowJson?: string,
): Promise<string | null> {
  if (!chatBotEnabled()) return null;
  const rows = load();
  let input = text.trim();
  const lower = input.toLowerCase();
  const now = new Date();
  let session: Session = rows[key] ?? { step: "menu", cart: [], updatedAt: now.toISOString() };
  const restart = /^(menu|hi|hello|hey|namaste|namaskar|start|0|action:menu)$/i.test(input);
  const directMenuCmd = /^([12356]|action:(order_books|my_orders|my_tickets|my_seminars|my_account)|book:\d+|qty:\d+|more:(add|checkout|clear)|mode:(delivery|pickup)|addr:(saved|new)|confirm:(yes|no))$/i.test(input) || /^(my orders?|track|order books?|my tickets?)$/i.test(input);
  if (session.step === "desk" && directMenuCmd) {
    session.step = "menu";
    session.deskUntil = undefined;
  }
  if (session.step === "desk" && !restart && !directMenuCmd && !cart?.length && !flowJson && session.deskUntil && Date.parse(session.deskUntil) > now.getTime()) return null;
  if (now.getTime() - Date.parse(session.updatedAt) > IDLE_MS && session.step !== "desk") session = { step: "menu", cart: [], updatedAt: now.toISOString() };
  const account = findAccount(phone);
  session.email ||= account?.email;
  const finish = (reply: string) => {
    session.updatedAt = new Date().toISOString();
    rows[key] = session;
    save(rows);
    return reply;
  };
  const ordering = whatsAppOrderingOn();
  const orderOnSite = `Ordering on WhatsApp is paused right now. Please order on our website: ${SITE}/shop\n\nReply *menu* for the menu.`;
  const books = catalogue();
  const bookMenu = () =>
    books.length
      ? [`📘 *Choose a Publication* (reply with its number or tap from the list):`, "", ...books.slice(0, 20).map((book, index) => `*${index + 1}.* ${bookLabel(book)}`)].join("\n")
      : `No books are open for ordering right now. See ${SITE}/shop`;

  // Handle Meta WhatsApp Flow submission (nfm_reply)
  if (flowJson) {
    if (!ordering) return finish(orderOnSite);
    const flowReply = await handleMetaFlowSubmission(key, phone, flowJson, session);
    if (flowReply) return finish(flowReply);
  }

  // Normalize interactive button/list IDs so both tap buttons and typed numbers work identically!
  if (/^book:\d+$/i.test(input)) {
    session.step = "book";
    input = input.split(":")[1];
  } else if (/^qty:\d+$/i.test(input)) {
    session.step = "qty";
    input = input.split(":")[1];
  } else if (input === "action:order_books") {
    session.step = "menu";
    input = "1";
  } else if (input === "action:my_orders") {
    session.step = "menu";
    input = "2";
  } else if (input === "action:my_tickets") {
    session.step = "menu";
    input = "3";
  } else if (input === "action:talk_agent") {
    session.step = "menu";
    input = "4";
  } else if (input === "action:my_seminars") {
    session.step = "menu";
    input = "5";
  } else if (input === "action:my_account") {
    session.step = "menu";
    input = "6";
  } else if (input === "more:add") {
    session.step = "more";
    input = "1";
  } else if (input === "more:checkout") {
    session.step = "more";
    input = "2";
  } else if (input === "more:clear") {
    session.step = "more";
    input = "3";
  } else if (input === "mode:delivery") {
    session.step = "delivery_mode";
    input = "1";
  } else if (input === "mode:pickup") {
    session.step = "delivery_mode";
    input = "2";
  } else if (input === "addr:saved") {
    session.step = "address";
    input = "1";
  } else if (input === "addr:new") {
    session.step = "address";
    input = "2";
  } else if (input === "confirm:yes") {
    session.step = "confirm";
    input = "1";
  } else if (input === "confirm:no") {
    session.step = "confirm";
    input = "2";
  }

  if (!ordering && (cart?.length || !["menu", "desk"].includes(session.step))) {
    session = { step: "menu", cart: [], email: session.email, updatedAt: now.toISOString() };
    if (cart?.length) return finish(orderOnSite);
  }
  if (cart?.length) {
    const known = cart.filter((line) => books.some((book) => book.id === line.id));
    if (!known.length) return finish("Those items aren't available to order right now. Reply *1* to see the books you can order.");
    session = { step: "more", cart: known, email: session.email, updatedAt: now.toISOString() };
    input = "2";
  } else if (restart || session.step === "desk") {
    session = { step: "menu", cart: session.cart, email: session.email, updatedAt: now.toISOString() };
    // Also send interactive quick buttons on Meta Cloud API!
    void sendInteractiveHelper(key, phone, {
      type: "button",
      header: { type: "text", text: "VGMF Official WhatsApp Desk" },
      body: { text: "Quick Actions — tap a button below to order books, track your parcel, or connect with Customer Care:" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "action:order_books", title: "📘 Order Books" } },
          { type: "reply", reply: { id: "action:my_orders", title: "📦 My Orders" } },
          { type: "reply", reply: { id: "action:talk_agent", title: "💬 Customer Care" } },
        ],
      },
    });
    return finish(`${account ? `Namaste ${account.firstName || profileName || ""}! 🙏\n` : ""}${MENU}`.trim());
  }

  switch (session.step) {
    case "menu": {
      if (input === "1" || (lower.includes("order") && !lower.includes("my order")) || lower === "book" || lower === "books") {
        if (!ordering) return finish(orderOnSite);
        session.step = books.length ? "book" : "menu";
        if (books.length) void sendWhatsAppOrderingFlowMenu(phone, key);
        return finish(bookMenu());
      }
      if (input === "2" || lower.includes("my order") || lower.includes("track") || lower.includes("status")) {
        return finish(myOrders(phone, session.email));
      }
      if (input === "3" || lower.includes("ticket")) {
        return finish(myTickets(phone, session.email));
      }
      if (input === "6" || lower.includes("account")) {
        if (!account) return finish(`No account is linked to this number yet. Create one at ${SITE}/account, or just order here on WhatsApp and we'll set it up automatically.\n\nReply *1* to order books or *menu* for the menu.`);
        const address = lastAddress(phone, account.email);
        return finish(
          [
            `👤 *Your VGMF Account (${account.accountId}):*`,
            `Name: ${[account.salutation, account.firstName, account.lastName].filter(Boolean).join(" ")}`,
            `Email: ${account.email}`,
            `Phone: ${account.phone}`,
            address ? `\n📍 *Saved Delivery Address:*\n${addressText(address)}` : "",
            "",
            `Manage account: ${SITE}/account`,
            "Reply *1* to order books, *2* for your orders, or *3* for your support tickets.",
          ]
            .filter((line) => line !== "")
            .join("\n")
        );
      }
      if (input === "5" || lower.includes("application") || lower.includes("seminar") || lower.includes("registration")) {
        try {
          const { liveRecordsForEmail } = await import("@/lib/server/partner-portals");
          const records = await liveRecordsForEmail(session.email || "", phone);
          const rowsList = records.tickets.slice(0, 8);
          if (!rowsList.length) return finish("We couldn't find seminar or event applications for this number. Applications made with another number or email show on seminar.vaidyagogate.org or autism.vaidyagogate.org after you sign in.\n\nReply *menu* for the menu.");
          return finish([
            "🎓 *Your Seminar & Event Applications:*",
            "",
            ...rowsList.map((row) => `• *${row.eventName}*${row.applicationNo ? ` (${row.applicationNo})` : ""}\n   Status: *${row.status}*${row.portalUrl ? `\n   ${row.portalUrl}` : ""}`),
            "",
            "Reply *4* to talk to our team or *menu* for the menu.",
          ].join("\n"));
        } catch {
          return finish("We couldn't load applications right now. Please try again in a few minutes, or reply *4* to talk to our team.");
        }
      }
      if (input === "4" || lower.includes("talk") || lower.includes("agent") || lower.includes("help") || lower.includes("care")) {
        session.step = "desk";
        session.deskUntil = new Date(now.getTime() + DESK_MS).toISOString();
        return finish("💬 *Connected to VGMF Customer Care*\nThank you. A Customer Care Executive has been notified and will reply here shortly (Mon–Sat, 10 AM – 6 PM).\n\nYou can type your question or order ID right below. Type *menu* any time to return to self-service.");
      }
      return finish(MENU);
    }
    case "book": {
      const book = books[Number(digits(input)) - 1] || books.find((b) => b.id === input || b.title.toLowerCase() === lower);
      if (!book) return finish(`Please reply with a book number from the list.\n\n${bookMenu()}`);
      session.bookId = book.id;
      session.step = "qty";
      void sendInteractiveHelper(key, phone, {
        type: "button",
        body: { text: `Selected: *${bookLabel(book)}*\n\nTap how many copies you would like, or type any number (1–20):` },
        action: {
          buttons: [
            { type: "reply", reply: { id: "qty:1", title: "1 Copy" } },
            { type: "reply", reply: { id: "qty:2", title: "2 Copies" } },
            { type: "reply", reply: { id: "qty:5", title: "5 Copies" } },
          ],
        },
      });
      return finish(`📘 *${bookLabel(book)}*\nHow many copies would you like? Reply with a number (1–20) or tap a button.`);
    }
    case "qty": {
      const quantity = Number(digits(input));
      if (!quantity || quantity < 1 || quantity > 20) return finish("Please reply with the number of copies (1–20).");
      const existing = session.cart.find((line) => line.id === session.bookId);
      if (existing) existing.quantity = quantity;
      else if (session.bookId) session.cart.push({ id: session.bookId, quantity });
      session.step = "more";
      void sendInteractiveHelper(key, phone, {
        type: "button",
        body: { text: `🛒 *Your WhatsApp Cart:*\n${cartText(session.cart)}\n\nChoose your next step:` },
        action: {
          buttons: [
            { type: "reply", reply: { id: "more:checkout", title: "✅ Checkout Now" } },
            { type: "reply", reply: { id: "more:add", title: "➕ Add Another Book" } },
            { type: "reply", reply: { id: "more:clear", title: "🗑️ Empty Cart" } },
          ],
        },
      });
      return finish(`🛒 *In your WhatsApp Cart:*\n${cartText(session.cart)}\n\n*1.* Add another book\n*2.* Proceed to Checkout\n*3.* Empty cart`);
    }
    case "more": {
      if (input === "1" && books.length) {
        session.step = "book";
        void sendWhatsAppOrderingFlowMenu(phone, key);
        return finish(bookMenu());
      }
      if (input === "3") {
        session.cart = [];
        session.step = "menu";
        return finish(`Cart emptied.\n\n${MENU}`);
      }
      if (input !== "2") return finish("Reply *1* to add another book, *2* to checkout or *3* to empty the cart.");
      if (appPickupAllowed()) {
        session.step = "delivery_mode";
        void sendInteractiveHelper(key, phone, {
          type: "button",
          body: { text: "How would you like to receive your books?" },
          action: {
            buttons: [
              { type: "reply", reply: { id: "mode:delivery", title: "🚚 Home Delivery" } },
              { type: "reply", reply: { id: "mode:pickup", title: "🏬 Store Pickup" } },
            ],
          },
        });
        return finish("How would you like to receive your order?\n*1.* Home Delivery (Courier)\n*2.* Store Pickup (VGMF Store, Pune · Free)");
      }
      session.pickup = false;
      const saved = lastAddress(phone, session.email);
      if (saved) {
        session.address = saved;
        session.step = "address";
        void sendInteractiveHelper(key, phone, {
          type: "button",
          body: { text: `Deliver to your saved address?\n${addressText(saved)}` },
          action: {
            buttons: [
              { type: "reply", reply: { id: "addr:saved", title: "✅ Deliver Here" } },
              { type: "reply", reply: { id: "addr:new", title: "✏️ New Address" } },
            ],
          },
        });
        return finish(`📍 *Deliver to your saved address?*\n${addressText(saved)}\n\n*1.* Yes, use this address\n*2.* Enter a different address`);
      }
      session.address = {};
      session.step = "name";
      return finish("Please enter the *Full Name* for delivery:");
    }
    case "delivery_mode": {
      if (input === "2" || lower.includes("pickup") || lower.includes("store")) {
        session.pickup = true;
        session.address = {
          name: account ? [account.firstName, account.lastName].filter(Boolean).join(" ").trim() || "Customer" : profileName || "Customer",
          line1: "VGMF Store Pickup, Pune",
          city: "Pune",
          state: "Maharashtra",
          pincode: "411030",
        };
        session.step = session.email ? "confirm" : "email";
        if (session.email) {
          void sendInteractiveHelper(key, phone, {
            type: "button",
            body: { text: `🏬 *Store Pickup (VGMF Store, Pune)*\n\n${cartText(session.cart)}\n\nConfirm order & generate payment link?` },
            action: {
              buttons: [
                { type: "reply", reply: { id: "confirm:yes", title: "✅ Place Order & Pay" } },
                { type: "reply", reply: { id: "confirm:no", title: "❌ Cancel" } },
              ],
            },
          });
        }
        return finish(session.email ? `🏬 *Store Pickup (VGMF Store, Pune)*\n\n${cartText(session.cart)}\n\n*1.* Place order & get payment link\n*2.* Cancel` : "Please enter your *Email address* for the order receipt (or reply *skip*):");
      }
      session.pickup = false;
      const saved = lastAddress(phone, session.email);
      if (saved) {
        session.address = saved;
        session.step = "address";
        void sendInteractiveHelper(key, phone, {
          type: "button",
          body: { text: `Deliver to your saved address?\n${addressText(saved)}` },
          action: {
            buttons: [
              { type: "reply", reply: { id: "addr:saved", title: "✅ Deliver Here" } },
              { type: "reply", reply: { id: "addr:new", title: "✏️ New Address" } },
            ],
          },
        });
        return finish(`📍 *Deliver to your saved address?*\n${addressText(saved)}\n\n*1.* Yes, use this address\n*2.* Enter a different address`);
      }
      session.address = {};
      session.step = "name";
      return finish("Please enter the *Full Name* for delivery:");
    }
    case "address": {
      if (input === "2") {
        session.address = {};
        session.step = "name";
        return finish("Please enter the *Full Name* for delivery:");
      }
      if (input !== "1") return finish("Reply *1* for this address or *2* for a different one.");
      session.step = session.email ? "confirm" : "email";
      if (session.email) {
        void sendInteractiveHelper(key, phone, {
          type: "button",
          body: { text: `📍 *Deliver to:*\n${addressText(session.address ?? {})}\n\n${cartText(session.cart)}\n\nReady to place order?` },
          action: {
            buttons: [
              { type: "reply", reply: { id: "confirm:yes", title: "✅ Place Order & Pay" } },
              { type: "reply", reply: { id: "confirm:no", title: "❌ Cancel" } },
            ],
          },
        });
      }
      return finish(session.email ? `📍 *Deliver to:*\n${addressText(session.address ?? {})}\n\n${cartText(session.cart)}\n\n*1.* Place order and get payment link\n*2.* Cancel` : "Please enter your *Email address* for the order receipt (or reply *skip*):");
    }
    case "name":
      if (input.length < 2) return finish("Please enter the *Full Name* for delivery:");
      session.address = { ...session.address, name: input.slice(0, 80) };
      session.step = "line1";
      return finish("House / Flat / Building, Street and Area?");
    case "line1":
      if (input.length < 5) return finish("Please type the full street address:");
      session.address = { ...session.address, line1: input.slice(0, 160) };
      session.step = "city";
      return finish("City / Town?");
    case "city":
      session.address = { ...session.address, city: input.slice(0, 80) };
      session.step = "state";
      return finish("State?");
    case "state":
      session.address = { ...session.address, state: input.slice(0, 80) };
      session.step = "pincode";
      return finish("6-digit PIN code?");
    case "pincode":
      if (!isValidPostal("IN", digits(input))) return finish("Please type a valid 6-digit Indian PIN code:");
      session.address = { ...session.address, pincode: digits(input) };
      session.step = session.email ? "confirm" : "email";
      if (session.email) {
        void sendInteractiveHelper(key, phone, {
          type: "button",
          body: { text: `📍 *Deliver to:*\n${addressText(session.address)}\n\n${cartText(session.cart)}\n\nConfirm order & generate payment link?` },
          action: {
            buttons: [
              { type: "reply", reply: { id: "confirm:yes", title: "✅ Place Order & Pay" } },
              { type: "reply", reply: { id: "confirm:no", title: "❌ Cancel" } },
            ],
          },
        });
      }
      return finish(session.email ? `📍 *Deliver to:*\n${addressText(session.address)}\n\n${cartText(session.cart)}\n\n*1.* Place order and get payment link\n*2.* Cancel` : "Please enter your *Email address* for the order receipt (or reply *skip*):");
    case "email":
      if (lower !== "skip") {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) return finish("Please type a valid email address, or reply *skip*:");
        session.email = lower;
      }
      session.step = "confirm";
      void sendInteractiveHelper(key, phone, {
        type: "button",
        body: { text: `📍 *Deliver to:*\n${addressText(session.address ?? {})}\n\n${cartText(session.cart)}\n\nConfirm order & generate payment link?` },
        action: {
          buttons: [
            { type: "reply", reply: { id: "confirm:yes", title: "✅ Place Order & Pay" } },
            { type: "reply", reply: { id: "confirm:no", title: "❌ Cancel" } },
          ],
        },
      });
      return finish(`📍 *Deliver to:*\n${addressText(session.address ?? {})}\n\n${cartText(session.cart)}\n\n*1.* Place order and get payment link\n*2.* Cancel`);
    case "confirm": {
      if (input === "2") {
        session.step = "menu";
        return finish(`Order cancelled. Your cart items are saved.\n\n${MENU}`);
      }
      if (input !== "1") return finish("Reply *1* (or tap *Place Order & Pay*) to confirm, or *2* to cancel.");
      try {
        const reply = await placeOrder(phone, session, key);
        session = { step: "menu", cart: [], email: session.email, updatedAt: now.toISOString() };
        return finish(reply);
      } catch (error) {
        return finish(`Sorry, we couldn't create the order (${(error as Error).message || "error"}). Reply *1* to try again or *4* to talk to our team.`);
      }
    }
  }
  return finish(MENU);
}

async function payInChat(key: string, phone: string, order: Order, payNow: number) {
  if (!key.startsWith("meta:") || payNow <= 0) return false;
  const whatsapp = (savedAdminIntegrations().whatsapp ?? {}) as { metaPaymentConfiguration?: string };
  const configurationName = String(whatsapp.metaPaymentConfiguration || "Razorpay").trim();
  const { loadWhatsAppCreds, logOutboundWhatsApp } = await import("@/lib/server/whatsapp-inbox");
  const creds = await loadWhatsAppCreds();
  const titles = order.items.map((item) => item.title).join(", ");
  const books = order.items.map((item) => ({ id: item.bookId || item.sku || item.title, name: item.title, amount: item.price, quantity: item.quantity }));
  const fee = order.platformFee || 0;
  const shipping = order.shipping || 0;
  const discount = order.discount || 0;
  const itemised = !order.preorderPayment && books.reduce((sum, item) => sum + item.amount * item.quantity, 0) + fee + shipping - discount === payNow;
  const sent = await sendMetaOrderDetails(creds, {
    to: phone,
    referenceId: order.id,
    configurationName,
    body: order.preorderPayment ? `Pre-order #${order.id}: advance ${inr(payNow)} now. The balance and courier are due when the book is ready.` : `Order #${order.id}: please review and pay via UPI / Razorpay.`,
    items: itemised ? books : [{ id: order.id, name: order.preorderPayment ? `Pre-order advance · ${titles}` : `Order ${order.id} · ${titles}`, amount: payNow, quantity: 1 }],
    tax: itemised && fee ? { amount: fee, description: "Platform fee" } : undefined,
    shipping: itemised ? shipping : undefined,
    discount: itemised ? discount : undefined,
    total: payNow,
  });
  if (sent?.id) logOutboundWhatsApp({ provider: "meta", phone, text: `[Review and pay card] #${order.id} · ${inr(payNow)}`, externalId: sent.id, by: "WhatsApp Store Flow" });
  return Boolean(sent?.id);
}

export async function recordWhatsAppPayment(input: { referenceId: string; status: string; paymentId: string; phone?: string }) {
  if (!/^(success|captured)$/i.test(input.status)) return;
  const { findShopOrder } = await import("@/lib/server/shop-orders");
  const order = findShopOrder(input.referenceId);
  if (!order || order.paymentStatus !== "Pending") return;
  const { markAppOrderPaid } = await import("@/lib/server/mobile-shop");
  markAppOrderPaid(order.id, { paymentId: input.paymentId, razorpayOrderId: "", note: `Paid inside WhatsApp (Razorpay)${input.paymentId ? ` · ${input.paymentId}` : ""}` });
  const creds = razorpayCreds({});
  if (creds && order.paymentLink?.id) await razorpayLinkCancel(creds, order.paymentLink.id).catch(() => undefined);
  const phone = input.phone || order.deliveryAddress?.phone;
  if (!phone) return;
  const { loadWhatsAppCreds } = await import("@/lib/server/whatsapp-inbox");
  const plan = order.preorderPayment;
  const body = plan
    ? `✅ *PAYMENT CONFIRMED · PRE-ORDER #${order.id}*\nAdvance of ${inr(plan.advance)} received! We will message you here on WhatsApp when your book is packed and ready to ship.`
    : `✅ *PAYMENT CONFIRMED · ORDER #${order.id}*\nThank you! Payment received. You will receive Packed, Shipped & Delivery updates right here on WhatsApp.\n\nView order: ${SITE}/account/orders/${encodeURIComponent(order.id)}`;
  await sendMetaText(await loadWhatsAppCreds(), { to: phone, body }).catch(() => null);
}

/** Ready-to-publish Meta WhatsApp Flow JSON (v5.0) for Pune Metro-style 1-screen Book Ordering inside WhatsApp. */
export function buildMetaOrderingFlowJson() {
  const books = catalogue();
  const bookOptions = (books.length ? books : [{ id: "1", title: "VGMF Publication", price: 250 }]).slice(0, 20).map((b, idx) => ({
    id: String(b.id || idx + 1),
    title: `${b.title} (₹${priceOf(b as FeedBook)})`.slice(0, 30),
  }));
  return {
    version: "5.0",
    screens: [
      {
        id: "VGMF_BOOK_ORDER",
        title: "Order VGMF Publications",
        terminal: true,
        data: {},
        layout: {
          type: "SingleColumnLayout",
          children: [
            {
              type: "TextHeading",
              text: "Vaidya Gogate Memorial Foundation",
            },
            {
              type: "Dropdown",
              label: "Select Publication",
              name: "book_id",
              required: true,
              "data-source": bookOptions,
            },
            {
              type: "TextInput",
              label: "Quantity (1-20)",
              name: "quantity",
              "input-type": "number",
              required: true,
            },
            {
              type: "RadioButtonsGroup",
              label: "Delivery Mode",
              name: "delivery_mode",
              required: true,
              "data-source": [
                { id: "delivery", title: "Home Delivery (Courier)" },
                { id: "pickup", title: "Store Pickup (Pune · Free)" },
              ],
            },
            {
              type: "TextInput",
              label: "Full Name",
              name: "full_name",
              required: true,
            },
            {
              type: "TextInput",
              label: "House / Street / Area Address",
              name: "address_line1",
              required: true,
            },
            {
              type: "TextInput",
              label: "City",
              name: "city",
              required: true,
            },
            {
              type: "TextInput",
              label: "State",
              name: "state",
              required: true,
            },
            {
              type: "TextInput",
              label: "6-Digit PIN Code",
              name: "pincode",
              "input-type": "number",
              required: true,
            },
            {
              type: "TextInput",
              label: "Email (for invoice & updates)",
              name: "email",
              "input-type": "email",
              required: false,
            },
            {
              type: "Footer",
              label: "Place Order & Pay",
              "on-click-action": {
                name: "complete",
                payload: {
                  book_id: "${form.book_id}",
                  quantity: "${form.quantity}",
                  delivery_mode: "${form.delivery_mode}",
                  full_name: "${form.full_name}",
                  address_line1: "${form.address_line1}",
                  city: "${form.city}",
                  state: "${form.state}",
                  pincode: "${form.pincode}",
                  email: "${form.email}",
                },
              },
            },
          ],
        },
      },
    ],
  };
}
