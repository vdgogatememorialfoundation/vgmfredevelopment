import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { dataFile } from "@/lib/server/paths";

export type FoundationAccount = {
  id: string;
  accountId: string;
  salutation: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp?: string;
  alternatePhone?: string;
  passwordHash?: string;
  passwordSalt?: string;
  createdAt: string;
};

const FILE = dataFile("foundation-accounts.json");

function load(): FoundationAccount[] {
  try {
    const rows = JSON.parse(readFileSync(FILE, "utf8")) as FoundationAccount[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function save(rows: FoundationAccount[]) {
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(rows, null, 2));
  } catch {
    /* read-only host */
  }
}

function digits(value: string) {
  const text = String(value ?? "").replace(/\D/g, "");
  return text.length > 10 ? text.slice(-10) : text;
}

function hashPassword(password: string, salt: string) {
  return createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

export function publicAccount(account: FoundationAccount) {
  return {
    id: account.id,
    accountId: account.accountId,
    salutation: account.salutation,
    firstName: account.firstName,
    middleName: account.middleName,
    lastName: account.lastName,
    email: account.email,
    phone: account.phone,
    whatsapp: account.whatsapp,
    alternatePhone: account.alternatePhone,
    name: [account.salutation, account.firstName, account.middleName, account.lastName].filter(Boolean).join(" "),
    createdAt: account.createdAt,
  };
}

export function findAccount(identifier: string) {
  const value = identifier.trim().toLowerCase();
  const phone = digits(identifier);
  return (
    load().find(
      (account) =>
        account.email === value ||
        account.accountId === identifier.trim() ||
        (phone && (digits(account.phone) === phone || digits(account.whatsapp || "") === phone || digits(account.alternatePhone || "") === phone))
    ) ?? null
  );
}

export function accountExists(email: string, phone: string) {
  return Boolean(findAccount(email) || findAccount(phone));
}

export function createAccount(input: {
  id?: string;
  accountId?: string;
  salutation?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp?: string;
  alternatePhone?: string;
  password?: string;
}) {
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  if (accountExists(email, phone)) throw new Error("An account with this email or phone is already created. Please login.");
  const used = new Set(load().map((item) => item.accountId));
  let accountId = String(input.accountId || "").replace(/\D/g, "");
  if (accountId.length !== 12 || used.has(accountId)) {
    do accountId = String(Math.floor(100000000000 + Math.random() * 900000000000));
    while (used.has(accountId));
  }
  const salt = input.password ? randomBytes(8).toString("hex") : "";
  const account: FoundationAccount = {
    id: input.id || `usr-${Date.now()}`,
    accountId,
    salutation: (input.salutation || "Dr.").slice(0, 16),
    firstName: input.firstName.trim().slice(0, 40),
    middleName: input.middleName?.trim().slice(0, 40) || undefined,
    lastName: input.lastName.trim().slice(0, 40),
    email,
    phone,
    whatsapp: input.whatsapp?.trim() || phone,
    alternatePhone: input.alternatePhone?.trim() || phone,
    passwordSalt: salt || undefined,
    passwordHash: input.password && salt ? hashPassword(input.password, salt) : undefined,
    createdAt: new Date().toISOString(),
  };
  const rows = load();
  rows.push(account);
  save(rows);
  return account;
}

export function setAccountPassword(email: string, password: string) {
  const rows = load();
  const index = rows.findIndex((item) => item.email === email.trim().toLowerCase());
  if (index < 0) return null;
  const salt = randomBytes(8).toString("hex");
  rows[index] = { ...rows[index], passwordSalt: salt, passwordHash: hashPassword(password, salt) };
  save(rows);
  return rows[index];
}

export function passwordOk(account: FoundationAccount, password: string) {
  if (!account.passwordHash || !account.passwordSalt || !password) return false;
  return account.passwordHash === hashPassword(password, account.passwordSalt);
}

export function upsertAccount(input: {
  id?: string;
  accountId?: string;
  salutation?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  alternatePhone?: string;
  password?: string;
}) {
  const email = String(input.email || "").trim();
  const phone = String(input.phone || "").trim();
  const existing =
    (email && findAccount(email)) ||
    (phone && findAccount(phone)) ||
    (input.accountId && findAccount(String(input.accountId))) ||
    null;
  if (existing) {
    if (input.password && !existing.passwordHash) return setAccountPassword(existing.email, input.password) ?? existing;
    return existing;
  }
  if (!email || !phone || !String(input.firstName || "").trim() || !String(input.lastName || "").trim()) return null;
  return createAccount({
    id: input.id,
    accountId: input.accountId,
    salutation: input.salutation,
    firstName: String(input.firstName),
    middleName: input.middleName,
    lastName: String(input.lastName),
    email,
    phone,
    whatsapp: input.whatsapp,
    alternatePhone: input.alternatePhone,
    password: input.password,
  });
}
