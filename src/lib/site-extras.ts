export type SiteDisclaimer = { id: string; title: string; body: string; enabled: boolean };

export type SignupFieldType = "text" | "number" | "date" | "textarea" | "select";

export type SignupField = {
  id: string;
  label: string;
  type: SignupFieldType;
  required: boolean;
  enabled: boolean;
  options?: string[];
  placeholder?: string;
};

export type SignupControls = {
  birthDate: "required" | "optional" | "hidden";
  fields: SignupField[];
};

export type InstagramReel = { id: string; url: string; caption?: string; enabled: boolean };

export type BirthdayControls = { enabled: boolean; message: string; email: boolean };

export const defaultSignupControls: SignupControls = {
  birthDate: "optional",
  fields: [],
};

export const defaultBirthday: BirthdayControls = {
  enabled: true,
  email: true,
  message: "Wishing you a very happy birthday, {name}! May the year ahead bring you health, happiness and success.",
};

const str = (value: unknown, max = 4000) => (typeof value === "string" ? value.slice(0, max) : "");
const list = (value: unknown) => (Array.isArray(value) ? value : []) as Record<string, unknown>[];
const rowId = (value: unknown, index: number) => str(value, 40).replace(/[^\w-]/g, "") || `row-${index + 1}`;

export function normalizeDisclaimers(input: unknown): SiteDisclaimer[] {
  return list(input)
    .map((row, index) => ({ id: rowId(row.id, index), title: str(row.title, 120), body: str(row.body), enabled: row.enabled !== false }))
    .filter((row) => row.title || row.body);
}

const TYPES: SignupFieldType[] = ["text", "number", "date", "textarea", "select"];

export function normalizeSignup(input: unknown): SignupControls {
  const row = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const birth = row.birthDate === "required" || row.birthDate === "hidden" ? row.birthDate : "optional";
  return {
    birthDate: birth,
    fields: list(row.fields)
      .map((field, index) => ({
        id: rowId(field.id, index),
        label: str(field.label, 80),
        type: TYPES.includes(field.type as SignupFieldType) ? (field.type as SignupFieldType) : "text",
        required: field.required === true,
        enabled: field.enabled !== false,
        options: list(field.options).map((option) => str(option, 80)).filter(Boolean),
        placeholder: str(field.placeholder, 120) || undefined,
      }))
      .filter((field) => field.label),
  };
}

/** Accepts instagram.com/reel/…, /reels/… or /p/… links. */
export function reelCode(url: string) {
  return url.match(/instagram\.com\/(?:[\w.]+\/)?(?:reels?|p|tv)\/([\w-]+)/i)?.[1] ?? "";
}

export function normalizeReels(input: unknown): InstagramReel[] {
  return list(input)
    .map((row, index) => ({ id: rowId(row.id, index), url: str(row.url, 300).trim(), caption: str(row.caption, 200) || undefined, enabled: row.enabled !== false }))
    .filter((row) => reelCode(row.url));
}

export function normalizeBirthday(input: unknown): BirthdayControls {
  const row = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    enabled: row.enabled !== false,
    email: row.email !== false,
    message: str(row.message, 600).trim() || defaultBirthday.message,
  };
}

/** True when `birthDate` (YYYY-MM-DD) falls on `today` (YYYY-MM-DD). 29 Feb is wished on 28 Feb in other years. */
export function isBirthday(birthDate: string | undefined, today: string) {
  const born = /^\d{4}-(\d{2}-\d{2})$/.exec(birthDate ?? "")?.[1];
  if (!born) return false;
  const day = today.slice(5);
  if (born === day) return true;
  const year = Number(today.slice(0, 4));
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return born === "02-29" && !leap && day === "02-28";
}
