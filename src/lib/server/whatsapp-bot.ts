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
import { savedAdminIntegrations } from "@/lib/server/admin-integrations";
import { razorpayCreds, razorpayLink } from "@/lib/server/providers";
import { offerActive } from "@/lib/promotions";
import { isValidPostal } from "@/lib/geo";

/** Customer self-service over chat (WhatsApp and the website chat): order books, see orders, see the account, reach the desk. */

type Address = { name: string; line1: string; city: string; state: string; pincode: string };
type Step = "menu" | "book" | "qty" | "more" | "address" | "name" | "line1" | "city" | "state" | "pincode" | "email" | "confirm" | "desk";
type Session = {
  step: Step;
  cart: { id: string; quantity: number }[];
  bookId?: string;
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

/** The desk took over this chat (Talk to us, or a staff reply): the menu stays quiet until the customer types "menu". */
export function pauseChatBot(key: string) {
  const rows = load();
  rows[key] = { ...(rows[key] ?? { step: "menu", cart: [] }), step: "desk", deskUntil: new Date(Date.now() + DESK_MS).toISOString(), updatedAt: new Date().toISOString() };
  save(rows);
}

/** After the desk closes a chat, the customer's next message gets the menu again. */
export function resumeChatBot(key: string) {
  const rows = load();
  if (!rows[key]) return;
  rows[key] = { ...rows[key], step: "menu", deskUntil: undefined, updatedAt: new Date().toISOString() };
  save(rows);
}

type FeedBook = { id: string; title: string; language?: string; price: number; stock?: number; stockStatus?: string; active?: boolean; preorder?: { enabled: boolean }; offer?: { price: number } };

function catalogue(): FeedBook[] {
  return ((readMobileFeed().books ?? []) as unknown as FeedBook[]).filter(
    (book) => book.active !== false && (feedPreorderable(book as never) || (book.stockStatus !== "out_of_stock" && Number(book.stock ?? 0) > 0))
  );
}

function priceOf(book: FeedBook) {
  return offerActive(book as never) && book.offer?.price ? book.offer.price : Number(book.price) || 0;
}

function bookLabel(book: FeedBook) {
  return `${book.title}${book.language && !book.title.toLowerCase().includes(book.language.toLowerCase()) ? ` (${book.language})` : ""} · ₹${priceOf(book)}${feedPreorderable(book as never) ? " · pre-order" : ""}`;
}

const MENU = [
  "Namaste from Vaidya Gogate Memorial Foundation. Reply with a number:",
  "1. Order books",
  "2. My orders",
  "3. My account",
  "4. Talk to our team",
  "5. My seminar / event applications",
  "",
  "Type *menu* any time to come back here.",
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
  const tracking = shipment?.awb ? `\n   Tracking: ${shipment.awb}${shipment.courier ? ` (${shipment.courier})` : ""}` : "";
  const due = order.paymentStatus !== "Paid" && order.status !== "Cancelled" ? ` · payment ${order.paymentStatus.toLowerCase()}` : "";
  return `#${order.id} · ${new Date(order.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}\n   ${items}\n   ${inr(order.total)} · *${order.status}*${due}${tracking}`;
}

function myOrders(phone: string, email?: string) {
  const orders = ordersForAccount({ phone, email }).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  if (!orders.length) return `We couldn't find orders for this number. Orders placed with another number or email show at ${SITE}/orders after you sign in.\n\nReply *1* to order books or *menu* for the menu.`;
  return [`Your latest orders:`, "", ...orders.map(orderLine), "", `Full details and tracking: ${SITE}/orders`, "Reply *4* to talk to our team about an order (cancel, return, refund)."].join("\n");
}

function lastAddress(phone: string, email?: string): Address | null {
  const order = ordersForAccount({ phone, email })
    .filter((row) => row.deliveryMode !== "store_pickup" && row.deliveryAddress?.line1 && row.deliveryAddress?.pincode)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const address = order?.deliveryAddress;
  return address ? { name: address.fullName, line1: [address.line1, address.landmark].filter(Boolean).join(", "), city: address.city, state: address.state, pincode: address.pincode } : null;
}

function addressText(address: Partial<Address>) {
  return [address.name, address.line1, `${address.city}, ${address.state} ${address.pincode}`].filter(Boolean).join("\n");
}

function cartText(cart: Session["cart"]) {
  const books = catalogue();
  return cart
    .map((line) => {
      const book = books.find((row) => row.id === line.id);
      return book ? `${book.title} × ${line.quantity} = ${inr(priceOf(book) * line.quantity)}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

async function placeOrder(phone: string, session: Session): Promise<string> {
  const books = catalogue();
  const items = session.cart
    .map((line) => {
      const book = books.find((row) => row.id === line.id);
      return book ? { id: book.id, title: book.title, quantity: line.quantity, price: priceOf(book) } : null;
    })
    .filter((item): item is { id: string; title: string; quantity: number; price: number } => Boolean(item));
  if (!items.length) return "Your bag is empty. Reply *1* to choose a book.";
  const address = session.address as Address;
  const email = session.email || `${digits(phone)}@whatsapp.vaidyagogate.org`;
  const draft = addOrder({ email, name: address.name, phone: `+${digits(phone)}`, items, address: { line1: address.line1, city: address.city, state: address.state, pincode: address.pincode, country: "India", countryCode: "IN" } });
  const feed = readMobileFeed();
  const preorder = items.some((item) => feedPreorderable((feed.books ?? []).find((row) => String(row.id) === item.id) as never));
  const courierMode = ((feed.orderSettings ?? {}) as { shippingFeeMode?: string }).shippingFeeMode === "courier_rate";
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  const courierFee =
    !preorder && courierMode
      ? ((await appCourierEstimate(draft.subtotal, units, address.pincode, items.map((item) => ({ bookId: item.id, quantity: item.quantity }))).catch(() => undefined)) ?? null)
      : undefined;
  const order = recordAppOrder(draft, { name: address.name, phone: `+${digits(phone)}`, address: { ...address, country: "India", countryCode: "IN" }, pickup: false, courierFee });
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
    history: [{ at: now, status: "Pending", note: "Placed over chat; payment link sent." }],
  });
  const lines = [
    `Order *#${order.id}* is ready.`,
    "",
    cartText(session.cart),
    order.platformFee ? `Platform fee: ${inr(order.platformFee)}` : "",
    order.shipping ? `Courier: ${inr(order.shipping)}` : order.preorderPayment ? "Courier: charged when the book is ready to ship" : order.shippingDue ? "Courier: we'll send this once packed" : "",
    `Total: *${inr(order.total)}*`,
    order.preorderPayment ? `Pay now (advance): *${inr(payNow)}*` : "",
    "",
    `Pay here (valid 24 hours): ${link.url}`,
    "We'll confirm on WhatsApp and email once it's paid.",
  ];
  return lines.filter((line, index, all) => line !== "" || all[index - 1] !== "").join("\n");
}

/** Returns the reply to send, or null when the menu should stay quiet (desk is handling the chat). */
export async function chatBotReply(key: string, phone: string, text: string, profileName?: string, cart?: { id: string; quantity: number }[]): Promise<string | null> {
  if (!chatBotEnabled()) return null;
  const rows = load();
  let input = text.trim();
  const lower = input.toLowerCase();
  const now = new Date();
  let session: Session = rows[key] ?? { step: "menu", cart: [], updatedAt: now.toISOString() };
  const restart = /^(menu|hi|hello|hey|namaste|namaskar|start|0)$/i.test(input);
  if (session.step === "desk" && !restart && !cart?.length && session.deskUntil && Date.parse(session.deskUntil) > now.getTime()) return null;
  if (now.getTime() - Date.parse(session.updatedAt) > IDLE_MS && session.step !== "desk") session = { step: "menu", cart: [], updatedAt: now.toISOString() };
  const account = findAccount(phone);
  session.email ||= account?.email;
  const finish = (reply: string) => {
    session.updatedAt = new Date().toISOString();
    rows[key] = session;
    save(rows);
    return reply;
  };
  const books = catalogue();
  const bookMenu = () =>
    books.length
      ? [`Choose a book (reply with its number):`, ...books.slice(0, 20).map((book, index) => `${index + 1}. ${bookLabel(book)}`)].join("\n")
      : `No books are open for ordering right now. See ${SITE}/books`;

  if (cart?.length) {
    const known = cart.filter((line) => books.some((book) => book.id === line.id));
    if (!known.length) return finish("Those items aren't available to order right now. Reply *1* to see the books you can order.");
    session = { step: "more", cart: known, email: session.email, updatedAt: now.toISOString() };
    input = "2";
  } else if (restart || session.step === "desk") {
    session = { step: "menu", cart: session.cart, email: session.email, updatedAt: now.toISOString() };
    return finish(`${account ? `Hello ${account.firstName || profileName || ""}! ` : ""}${MENU}`.trim());
  }

  switch (session.step) {
    case "menu": {
      if (input === "1" || (lower.includes("order") && lower.includes("book"))) {
        session.step = books.length ? "book" : "menu";
        return finish(bookMenu());
      }
      if (input === "2" || lower.includes("my order") || lower.includes("status")) return finish(myOrders(phone, session.email));
      if (input === "3" || lower.includes("account")) {
        if (!account) return finish(`No account is linked to this number yet. Create one at ${SITE}/account, or just order here and we'll set it up.\n\nReply *menu* for the menu.`);
        const address = lastAddress(phone, account.email);
        return finish(
          [
            `Your account (${account.accountId}):`,
            `Name: ${[account.salutation, account.firstName, account.lastName].filter(Boolean).join(" ")}`,
            `Email: ${account.email}`,
            `Phone: ${account.phone}`,
            address ? `Last delivery address:\n${addressText(address)}` : "",
            "",
            `To change details or addresses: ${SITE}/account`,
            "Reply *2* for your orders or *4* to talk to our team.",
          ]
            .filter((line) => line !== "")
            .join("\n")
        );
      }
      if (input === "5" || lower.includes("application") || lower.includes("seminar") || lower.includes("registration")) {
        try {
          const { liveRecordsForEmail } = await import("@/lib/server/partner-portals");
          const records = await liveRecordsForEmail(session.email || "", phone);
          const rows = records.tickets.slice(0, 8);
          if (!rows.length) return finish("We couldn't find seminar or event applications for this number. Applications made with another number or email show on seminar.vaidyagogate.org or autism.vaidyagogate.org after you sign in.\n\nReply *menu* for the menu.");
          return finish(["Your applications:", "", ...rows.map((row) => `• ${row.eventName}${row.applicationNo ? ` (${row.applicationNo})` : ""}\n   Status: *${row.status}*${row.portalUrl ? `\n   ${row.portalUrl}` : ""}`), "", "Reply *4* to talk to our team or *menu* for the menu."].join("\n"));
        } catch {
          return finish("We couldn't load applications right now. Please try again in a few minutes, or reply *4* to talk to our team.");
        }
      }
      if (input === "4" || lower.includes("talk") || lower.includes("agent") || lower.includes("help")) {
        session.step = "desk";
        session.deskUntil = new Date(now.getTime() + DESK_MS).toISOString();
        return finish("Thank you. A member of our team will reply here shortly (Mon–Sat, 10 am – 6 pm). Type *menu* to go back to the menu.");
      }
      return finish(MENU);
    }
    case "book": {
      const book = books[Number(digits(input)) - 1];
      if (!book) return finish(`Please reply with a number from the list.\n\n${bookMenu()}`);
      session.bookId = book.id;
      session.step = "qty";
      return finish(`${bookLabel(book)}\nHow many copies? Reply with a number (1–20).`);
    }
    case "qty": {
      const quantity = Number(digits(input));
      if (!quantity || quantity < 1 || quantity > 20) return finish("Please reply with the number of copies (1–20).");
      const existing = session.cart.find((line) => line.id === session.bookId);
      if (existing) existing.quantity = quantity;
      else if (session.bookId) session.cart.push({ id: session.bookId, quantity });
      session.step = "more";
      return finish(`In your bag:\n${cartText(session.cart)}\n\n1. Add another book\n2. Checkout\n3. Empty the bag`);
    }
    case "more": {
      if (input === "1" && books.length) {
        session.step = "book";
        return finish(bookMenu());
      }
      if (input === "3") {
        session.cart = [];
        session.step = "menu";
        return finish(`Bag emptied.\n\n${MENU}`);
      }
      if (input !== "2") return finish("Reply 1 to add another book, 2 to checkout or 3 to empty the bag.");
      const saved = lastAddress(phone, session.email);
      if (saved) {
        session.address = saved;
        session.step = "address";
        return finish(`Deliver to:\n${addressText(saved)}\n\n1. Yes, this address\n2. A different address`);
      }
      session.address = {};
      session.step = "name";
      return finish("Full name for delivery?");
    }
    case "address": {
      if (input === "2") {
        session.address = {};
        session.step = "name";
        return finish("Full name for delivery?");
      }
      if (input !== "1") return finish("Reply 1 for this address or 2 for a different one.");
      session.step = session.email ? "confirm" : "email";
      return finish(session.email ? `${cartText(session.cart)}\n\n1. Place order and get the payment link\n2. Cancel` : "Your email for the order receipt? (or reply *skip*)");
    }
    case "name":
      if (input.length < 2) return finish("Full name for delivery?");
      session.address = { ...session.address, name: input.slice(0, 80) };
      session.step = "line1";
      return finish("House / building, street and area?");
    case "line1":
      if (input.length < 5) return finish("Please type the full street address.");
      session.address = { ...session.address, line1: input.slice(0, 160) };
      session.step = "city";
      return finish("City / town?");
    case "city":
      session.address = { ...session.address, city: input.slice(0, 80) };
      session.step = "state";
      return finish("State?");
    case "state":
      session.address = { ...session.address, state: input.slice(0, 80) };
      session.step = "pincode";
      return finish("6-digit PIN code?");
    case "pincode":
      if (!isValidPostal("IN", digits(input))) return finish("Please type a valid 6-digit PIN code.");
      session.address = { ...session.address, pincode: digits(input) };
      session.step = session.email ? "confirm" : "email";
      return finish(session.email ? `Deliver to:\n${addressText(session.address)}\n\n${cartText(session.cart)}\n\n1. Place order and get the payment link\n2. Cancel` : "Your email for the order receipt? (or reply *skip*)");
    case "email":
      if (lower !== "skip") {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) return finish("Please type a valid email, or reply *skip*.");
        session.email = lower;
      }
      session.step = "confirm";
      return finish(`Deliver to:\n${addressText(session.address ?? {})}\n\n${cartText(session.cart)}\n\n1. Place order and get the payment link\n2. Cancel`);
    case "confirm": {
      if (input === "2") {
        session.step = "menu";
        return finish(`Cancelled. Your bag is kept.\n\n${MENU}`);
      }
      if (input !== "1") return finish("Reply 1 to place the order or 2 to cancel.");
      try {
        const reply = await placeOrder(phone, session);
        session = { step: "menu", cart: [], email: session.email, updatedAt: now.toISOString() };
        return finish(reply);
      } catch (error) {
        return finish(`Sorry, we couldn't create the order (${(error as Error).message || "error"}). Reply *1* to try again or *4* to talk to our team.`);
      }
    }
  }
  void appPickupAllowed;
  return finish(MENU);
}
