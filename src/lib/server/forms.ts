import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { dataFile } from "@/lib/server/paths";
import { findAccount, listAccounts } from "@/lib/server/accounts";
import { findShopOrder, listShopOrders, ordersForAccount, patchShopOrder } from "@/lib/server/shop-orders";
import { readMobileFeed } from "@/lib/server/mobile-feed";
import { sendMobileEmail } from "@/lib/server/mobile-mail";
import type { Order } from "@/types";

export type FormAudience = "everyone" | "signed-up" | "delivered" | "category";
export type QuestionType = "rating" | "text" | "textarea" | "choice";
export type FormQuestion = { id: string; label: string; type: QuestionType; options?: string[]; required?: boolean };
export type CustomerForm = {
  id: string;
  title: string;
  description: string;
  kind: "platform-review" | "custom";
  audience: FormAudience;
  categories: string[];
  questions: FormQuestion[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastMailedAt?: string;
  lastMailedCount?: number;
};
export type FormResponse = {
  id: string;
  formId: string;
  email: string;
  name: string;
  orderId?: string;
  answers: Record<string, string>;
  createdAt: string;
};
export type OrderFeedback = {
  orderId: string;
  email: string;
  delivery?: { rating: number; comment: string };
  products: { bookId: string; title: string; rating: number; comment: string }[];
  createdAt: string;
  updatedAt: string;
};
type Store = { forms: CustomerForm[]; responses: FormResponse[]; feedback: OrderFeedback[] };

const FILE = dataFile("customer-forms.json");

function load(): Store {
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as Partial<Store>;
    return { forms: parsed.forms ?? [], responses: parsed.responses ?? [], feedback: parsed.feedback ?? [] };
  } catch {
    return { forms: [], responses: [], feedback: [] };
  }
}

function save(store: Store) {
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(store, null, 2));
  } catch {
    /* read-only host */
  }
}

const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
const clip = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

function siteUrl() {
  return (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
}

export function productCategories() {
  return [...new Set(readMobileFeed().books.map((book) => book.category).filter(Boolean))].sort();
}

function categoryOf(bookId: string) {
  return readMobileFeed().books.find((book) => book.id === bookId)?.category ?? "";
}

function cleanForm(input: Partial<CustomerForm>, prev?: CustomerForm): CustomerForm {
  const now = new Date().toISOString();
  const audience = (["everyone", "signed-up", "delivered", "category"] as const).includes(input.audience as FormAudience) ? (input.audience as FormAudience) : "signed-up";
  const questions = (input.questions ?? [])
    .map((question, index) => ({
      id: clip(question.id, 40) || `q${index + 1}`,
      label: clip(question.label, 300),
      type: (["rating", "text", "textarea", "choice"] as const).includes(question.type) ? question.type : "text",
      options: question.type === "choice" ? (question.options ?? []).map((option) => clip(option, 120)).filter(Boolean) : undefined,
      required: Boolean(question.required),
    }))
    .filter((question) => question.label);
  return {
    id: prev?.id ?? id("form"),
    title: clip(input.title, 160) || "Untitled form",
    description: clip(input.description, 2000),
    kind: input.kind === "platform-review" ? "platform-review" : "custom",
    audience,
    categories: audience === "category" ? (input.categories ?? []).map((value) => clip(value, 80)).filter(Boolean) : [],
    questions,
    active: input.active ?? prev?.active ?? true,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    lastMailedAt: prev?.lastMailedAt,
    lastMailedCount: prev?.lastMailedCount,
  };
}

export function listForms() {
  return load().forms;
}

export function listResponses(formId = "") {
  return load().responses.filter((row) => !formId || row.formId === formId);
}

export function listOrderFeedback() {
  return load().feedback;
}

export function saveForm(input: Partial<CustomerForm>) {
  const store = load();
  const index = input.id ? store.forms.findIndex((form) => form.id === input.id) : -1;
  const form = cleanForm(input, index >= 0 ? store.forms[index] : undefined);
  if (!form.questions.length) throw new Error("Add at least one question.");
  if (index >= 0) store.forms[index] = form;
  else store.forms.unshift(form);
  save(store);
  return form;
}

export function deleteForm(formId: string) {
  const store = load();
  store.forms = store.forms.filter((form) => form.id !== formId);
  store.responses = store.responses.filter((row) => row.formId !== formId);
  save(store);
}

/** Who can see and answer a form. "everyone" still needs an email to record the answer. */
export function canAnswer(form: CustomerForm, email: string) {
  if (!form.active) return false;
  if (form.audience === "everyone") return true;
  if (!email || !findAccount(email)) return false;
  if (form.audience === "signed-up") return true;
  const delivered = ordersForAccount({ email }).filter((order) => order.status === "Delivered");
  if (form.audience === "delivered") return delivered.length > 0;
  const wanted = new Set(form.categories.map((value) => value.toLowerCase()));
  return delivered.some((order) => order.items.some((item) => wanted.has(categoryOf(item.bookId).toLowerCase())));
}

export function formsFor(email: string) {
  const answered = new Set(load().responses.filter((row) => row.email === email).map((row) => row.formId));
  return listForms()
    .filter((form) => canAnswer(form, email))
    .map((form) => ({ ...form, answered: Boolean(email) && answered.has(form.id) }));
}

export function submitResponse(formId: string, input: { email: string; name?: string; answers: Record<string, unknown> }) {
  const store = load();
  const form = store.forms.find((item) => item.id === formId);
  const email = input.email.trim().toLowerCase();
  if (!form) throw new Error("This form is no longer available.");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter your email.");
  if (!canAnswer(form, email)) throw new Error("This form is not open for your account.");
  const answers: Record<string, string> = {};
  for (const question of form.questions) {
    const value = clip(input.answers?.[question.id], 4000);
    if (question.required && !value) throw new Error(`Please answer: ${question.label}`);
    if (value) answers[question.id] = value;
  }
  const account = findAccount(email);
  const row: FormResponse = {
    id: id("resp"),
    formId,
    email,
    name: clip(input.name, 120) || (account ? [account.firstName, account.lastName].filter(Boolean).join(" ") : ""),
    answers,
    createdAt: new Date().toISOString(),
  };
  store.responses = store.responses.filter((item) => !(item.formId === formId && item.email === email));
  store.responses.unshift(row);
  save(store);
  return row;
}

function audienceEmails(form: CustomerForm) {
  const emails = new Set<string>();
  for (const account of listAccounts()) if (account.email) emails.add(account.email);
  if (form.audience === "everyone") for (const order of listShopOrders()) if (order.deliveryAddress?.email) emails.add(order.deliveryAddress.email.toLowerCase());
  return [...emails].filter((email) => canAnswer(form, email));
}

export async function mailForm(formId: string) {
  const store = load();
  const form = store.forms.find((item) => item.id === formId);
  if (!form) throw new Error("Form not found.");
  const recipients = audienceEmails(form);
  const link = `${siteUrl()}/forms/${form.id}`;
  let sent = 0;
  for (const email of recipients) {
    const ok = await sendMobileEmail(
      email,
      form.title,
      `Namaste,\n\n${form.description || "We would value a few minutes of your time."}\n\nOpen the form: ${link}\n\nWith warm regards,\nVaidya Gogate Memorial Foundation`
    ).catch(() => false);
    if (ok) sent += 1;
  }
  form.lastMailedAt = new Date().toISOString();
  form.lastMailedCount = sent;
  save(store);
  return { recipients: recipients.length, sent };
}

export function feedbackFor(orderId: string) {
  return load().feedback.find((row) => row.orderId === orderId) ?? null;
}

export function saveOrderFeedback(order: Order, email: string, input: { delivery?: { rating?: unknown; comment?: unknown }; products?: { bookId?: unknown; rating?: unknown; comment?: unknown }[] }) {
  if (order.status !== "Delivered") throw new Error("You can rate the order once it is delivered or collected.");
  const store = load();
  const now = new Date().toISOString();
  const prev = store.feedback.find((row) => row.orderId === order.id);
  const rating = (value: unknown) => Math.min(5, Math.max(0, Math.round(Number(value) || 0)));
  const deliveryRating = rating(input.delivery?.rating);
  const products = order.items
    .map((item) => {
      const given = input.products?.find((row) => String(row.bookId) === item.bookId);
      return { bookId: item.bookId, title: item.title, rating: rating(given?.rating), comment: clip(given?.comment, 1000) };
    })
    .filter((row) => row.rating > 0);
  const row: OrderFeedback = {
    orderId: order.id,
    email,
    delivery: deliveryRating ? { rating: deliveryRating, comment: clip(input.delivery?.comment, 1000) } : prev?.delivery,
    products: products.length ? products : prev?.products ?? [],
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };
  if (!row.delivery && !row.products.length) throw new Error("Choose at least one star rating.");
  store.feedback = [row, ...store.feedback.filter((item) => item.orderId !== order.id)];
  save(store);
  return row;
}

/** Once per order, after delivery or store pickup: ask for the delivery experience and product ratings. */
export async function inviteOrderFeedback(orderId: string) {
  const order = findShopOrder(orderId);
  const email = String(order?.deliveryAddress?.email || order?.accountEmail || "").trim().toLowerCase();
  if (!order || order.status !== "Delivered" || order.feedbackInvitedAt || !email) return;
  patchShopOrder(order.id, { feedbackInvitedAt: new Date().toISOString() });
  const pickup = order.deliveryMode === "store_pickup";
  await sendMobileEmail(
    email,
    `How was your order ${order.id}?`,
    `Dear ${order.deliveryAddress?.fullName || "Customer"},\n\nYour order ${order.id} was ${pickup ? "collected from the store" : "delivered"}. Please rate the ${pickup ? "pickup" : "delivery"} experience and the products you received. It takes under a minute.\n\nRate this order: ${siteUrl()}/account/orders/${order.id}#feedback\n\nWith warm regards,\nVaidya Gogate Memorial Foundation`
  ).catch(() => false);
}
