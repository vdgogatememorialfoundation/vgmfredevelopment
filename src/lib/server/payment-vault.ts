import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { HostedGatewayId, HostedGatewaySettings } from "@/lib/integrations";
import { dataFile } from "@/lib/server/paths";

export type VaultGateway = HostedGatewaySettings;

export type PaymentVault = Partial<Record<HostedGatewayId, VaultGateway>>;

const FILE = () => dataFile("payment-vault.json");

function emptyGateway(): VaultGateway {
  return { enabled: false, mode: "test", key: "", salt: "", merchantId: "", saltIndex: "1" };
}

export function readVault(): PaymentVault {
  try {
    const parsed = JSON.parse(readFileSync(FILE(), "utf8")) as PaymentVault;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writePaymentVault(next: PaymentVault) {
  const file = FILE();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(next));
}

function envMode(name: string): "test" | "live" {
  return process.env[name]?.trim().toLowerCase() === "live" ? "live" : "test";
}

function fromEnv(id: HostedGatewayId): VaultGateway | null {
  if (id === "payu") {
    const key = process.env.PAYU_KEY?.trim() || "";
    const salt = process.env.PAYU_SALT?.trim() || "";
    if (!key || !salt) return null;
    return { enabled: process.env.PAYU_ENABLED !== "0", mode: envMode("PAYU_MODE"), key, salt, merchantId: "", saltIndex: "1" };
  }
  if (id === "easebuzz") {
    const key = process.env.EASEBUZZ_KEY?.trim() || "";
    const salt = process.env.EASEBUZZ_SALT?.trim() || "";
    if (!key || !salt) return null;
    return { enabled: process.env.EASEBUZZ_ENABLED !== "0", mode: envMode("EASEBUZZ_MODE"), key, salt, merchantId: "", saltIndex: "1" };
  }
  if (id === "cashfree") {
    const key = process.env.CASHFREE_APP_ID?.trim() || "";
    const salt = process.env.CASHFREE_SECRET?.trim() || "";
    if (!key || !salt) return null;
    return { enabled: process.env.CASHFREE_ENABLED !== "0", mode: envMode("CASHFREE_MODE"), key, salt, merchantId: "", saltIndex: "1" };
  }
  const merchantId = process.env.PHONEPE_MERCHANT_ID?.trim() || "";
  const salt = process.env.PHONEPE_SALT_KEY?.trim() || "";
  if (!merchantId || !salt) return null;
  return {
    enabled: process.env.PHONEPE_ENABLED !== "0",
    mode: envMode("PHONEPE_MODE"),
    key: "",
    salt,
    merchantId,
    saltIndex: process.env.PHONEPE_SALT_INDEX?.trim() || "1",
  };
}

export function gatewayCreds(id: HostedGatewayId): VaultGateway | null {
  const saved = { ...emptyGateway(), ...readVault()[id] };
  const envCreds = fromEnv(id);
  const creds = saved.key || saved.salt || saved.merchantId ? saved : envCreds;
  if (!creds?.enabled) return null;
  if (id === "phonepe") return creds.merchantId && creds.salt ? creds : null;
  return creds.key && creds.salt ? creds : null;
}

export function listReadyGateways() {
  const ids: HostedGatewayId[] = ["payu", "easebuzz", "cashfree", "phonepe"];
  return ids.flatMap((id) => {
    const creds = gatewayCreds(id);
    return creds ? [{ id, mode: creds.mode }] : [];
  });
}
