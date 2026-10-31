import type { User } from "@/types";

export type RemoteAccount = {
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
  name: string;
  createdAt?: string;
};

export function remoteAccountToUser(account: RemoteAccount, extras: Partial<User> = {}): User {
  return {
    id: account.id,
    accountId: account.accountId,
    salutation: account.salutation,
    firstName: account.firstName,
    middleName: account.middleName,
    lastName: account.lastName,
    email: account.email,
    phone: account.phone,
    whatsapp: extras.whatsapp || account.whatsapp || account.phone,
    alternatePhone: extras.alternatePhone || account.alternatePhone || account.phone,
    role: extras.role || "customer",
    status: extras.status || "active",
    storeCredit: extras.storeCredit ?? 0,
    createdAt: extras.createdAt || account.createdAt || new Date().toISOString(),
    foundationPasswordSet: extras.foundationPasswordSet,
    password: extras.password,
  };
}

async function post(action: string, body: Record<string, unknown>) {
  const response = await fetch("/api/mobile/account", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || data.ok === false) {
    throw new Error(String(data.error || "Could not reach Foundation accounts."));
  }
  return data;
}

export async function remoteRegister(input: Record<string, string>) {
  return post("register", input);
}

export async function remoteVerifyRegister(input: Record<string, string>) {
  return post("verify-register", input) as Promise<Record<string, unknown> & { account: RemoteAccount }>;
}

export async function remoteLogin(input: { identifier: string; password?: string; method?: string }) {
  return post("login", input);
}

export async function remoteVerifyLogin(email: string, code: string) {
  return post("verify-login", { email, code }) as Promise<Record<string, unknown> & { account: RemoteAccount }>;
}

export async function remoteForgot(identifier: string) {
  return post("forgot", { identifier });
}

export async function remoteReset(email: string, code: string, password: string) {
  return post("reset", { email, code, password }) as Promise<Record<string, unknown> & { account?: RemoteAccount }>;
}

export async function remoteSync(input: Record<string, string>) {
  return post("sync", input) as Promise<Record<string, unknown> & { account: RemoteAccount }>;
}

export function isAccountConflict(error: unknown) {
  return /already created|already exists|Please login/i.test(error instanceof Error ? error.message : String(error || ""));
}
