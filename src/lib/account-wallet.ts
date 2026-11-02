import { useSyncExternalStore } from "react";
import type { DeliveryAddress } from "@/types";

export type SavedAddress = DeliveryAddress & { id: string; isDefault?: boolean };

export type CardBrand = "visa" | "mastercard" | "rupay" | "amex" | "card";

export type SavedCard = {
  id: string;
  brand: CardBrand;
  last4: string;
  expiry: string;
  name: string;
  isDefault?: boolean;
};

type Bucket = { addresses: SavedAddress[]; cards: SavedCard[] };
type Wallet = Record<string, Bucket>;

const KEY = "vgmf_wallet";
const EMPTY_ADDRESSES: SavedAddress[] = [];
const EMPTY_CARDS: SavedCard[] = [];
const EMPTY_WALLET: Wallet = {};

let cache = "";
let snapshot: Wallet = EMPTY_WALLET;

function emptyBucket(): Bucket {
  return { addresses: [], cards: [] };
}

function readWallet(): Wallet {
  if (typeof window === "undefined") return EMPTY_WALLET;
  const raw = window.localStorage.getItem(KEY) || "";
  if (raw === cache) return snapshot;
  cache = raw;
  if (!raw) {
    snapshot = EMPTY_WALLET;
    return snapshot;
  }
  try {
    const parsed = JSON.parse(raw) as Wallet;
    snapshot = parsed && typeof parsed === "object" ? parsed : EMPTY_WALLET;
  } catch {
    snapshot = EMPTY_WALLET;
  }
  return snapshot;
}

function writeWallet(next: Wallet) {
  const raw = JSON.stringify(next);
  cache = raw;
  snapshot = next;
  window.localStorage.setItem(KEY, raw);
  window.dispatchEvent(new Event("vgmf-wallet"));
}

function bucket(email: string): Bucket {
  return readWallet()[email.trim().toLowerCase()] ?? emptyBucket();
}

function saveBucket(email: string, next: Bucket) {
  const key = email.trim().toLowerCase();
  writeWallet({ ...readWallet(), [key]: next });
}

function subscribe(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const notify = () => onChange();
  window.addEventListener("vgmf-wallet", notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener("vgmf-wallet", notify);
    window.removeEventListener("storage", notify);
  };
}

export function cardBrand(digits: string): CardBrand {
  if (/^4/.test(digits)) return "visa";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "mastercard";
  if (/^(60|65|81|82|508)/.test(digits)) return "rupay";
  return "card";
}

export function brandLabel(brand: CardBrand) {
  if (brand === "visa") return "Visa";
  if (brand === "mastercard") return "Mastercard";
  if (brand === "rupay") return "RuPay";
  if (brand === "amex") return "American Express";
  return "Card";
}

function luhn(digits: string) {
  let sum = 0;
  let alternate = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (alternate) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export function inspectCard(number: string, expiry: string, name: string) {
  const digits = number.replace(/\D/g, "");
  const holder = name.trim();
  const match = expiry.trim().match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (digits.length < 13 || digits.length > 19 || !luhn(digits)) return { error: "Enter a valid card number. Only the last four digits are saved." };
  if (!match) return { error: "Enter the expiry as MM/YY." };
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  const now = new Date();
  const expired = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
  if (month < 1 || month > 12 || expired) return { error: "This card is expired." };
  if (holder.length < 2) return { error: "Enter the name on the card." };
  return {
    card: {
      brand: cardBrand(digits),
      last4: digits.slice(-4),
      expiry: `${match[1]}/${match[2]}`,
      name: holder,
    },
  };
}

export function listAddresses(email?: string | null) {
  if (!email) return EMPTY_ADDRESSES;
  return bucket(email).addresses;
}

export function listCards(email?: string | null) {
  if (!email) return EMPTY_CARDS;
  return bucket(email).cards;
}

export function saveAddress(email: string, address: Omit<SavedAddress, "id" | "isDefault"> & { id?: string }) {
  const current = bucket(email);
  const id = address.id || `addr-${Date.now()}`;
  const nextAddress: SavedAddress = { ...address, id, isDefault: current.addresses.some((item) => item.id === id && item.isDefault) || current.addresses.length === 0 };
  const addresses = current.addresses.some((item) => item.id === id)
    ? current.addresses.map((item) => (item.id === id ? { ...nextAddress, isDefault: item.isDefault } : item))
    : [...current.addresses, nextAddress];
  const withDefault = addresses.some((item) => item.isDefault) ? addresses : addresses.map((item, index) => ({ ...item, isDefault: index === 0 }));
  saveBucket(email, { ...current, addresses: withDefault });
  return id;
}

export function removeAddress(email: string, id: string) {
  const current = bucket(email);
  let addresses = current.addresses.filter((item) => item.id !== id);
  if (addresses.length && !addresses.some((item) => item.isDefault)) addresses = addresses.map((item, index) => ({ ...item, isDefault: index === 0 }));
  saveBucket(email, { ...current, addresses });
}

export function makeDefaultAddress(email: string, id: string) {
  const current = bucket(email);
  saveBucket(email, { ...current, addresses: current.addresses.map((item) => ({ ...item, isDefault: item.id === id })) });
}

export function saveCard(email: string, input: { number: string; expiry: string; name: string; id?: string }) {
  const checked = inspectCard(input.number, input.expiry, input.name);
  if ("error" in checked && checked.error) return checked;
  if (!("card" in checked) || !checked.card) return { error: "Enter a valid card number. Only the last four digits are saved." };
  const current = bucket(email);
  const id = input.id || `card-${Date.now()}`;
  const card: SavedCard = { ...checked.card, id, isDefault: current.cards.length === 0 };
  const cards = current.cards.some((item) => item.id === id)
    ? current.cards.map((item) => (item.id === id ? { ...card, isDefault: item.isDefault } : item))
    : [...current.cards, card];
  saveBucket(email, { ...current, cards });
  return { id };
}

export function removeCard(email: string, id: string) {
  const current = bucket(email);
  let cards = current.cards.filter((item) => item.id !== id);
  if (cards.length && !cards.some((item) => item.isDefault)) cards = cards.map((item, index) => ({ ...item, isDefault: index === 0 }));
  saveBucket(email, { ...current, cards });
}

export function makeDefaultCard(email: string, id: string) {
  const current = bucket(email);
  saveBucket(email, { ...current, cards: current.cards.map((item) => ({ ...item, isDefault: item.id === id })) });
}

export function useSavedAddresses(email?: string | null) {
  const wallet = useSyncExternalStore(subscribe, readWallet, () => EMPTY_WALLET);
  if (!email) return EMPTY_ADDRESSES;
  return wallet[email.trim().toLowerCase()]?.addresses ?? EMPTY_ADDRESSES;
}

export function useSavedCards(email?: string | null) {
  const wallet = useSyncExternalStore(subscribe, readWallet, () => EMPTY_WALLET);
  if (!email) return EMPTY_CARDS;
  return wallet[email.trim().toLowerCase()]?.cards ?? EMPTY_CARDS;
}
