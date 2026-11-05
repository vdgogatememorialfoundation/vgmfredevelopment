export type DisclaimerPlacement = "top" | "bottom" | "both";

export type SiteDisclaimer = { id: string; title: string; body: string; enabled: boolean; placement?: DisclaimerPlacement };

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

export type FieldMode = "required" | "optional" | "hidden";

export const BUILTIN_FIELDS = [
  { key: "salutation", label: "Salutation", placeholder: "", fixed: false },
  { key: "firstName", label: "First Name", placeholder: "Enter first name", fixed: true },
  { key: "middleName", label: "Middle Name", placeholder: "Optional", fixed: false },
  { key: "lastName", label: "Last Name", placeholder: "Enter last name", fixed: true },
  { key: "email", label: "Email Address", placeholder: "name@example.com", fixed: true },
  { key: "phone", label: "Phone Number", placeholder: "", fixed: true },
  { key: "alternatePhone", label: "Alternate phone number", placeholder: "", fixed: false },
  { key: "whatsapp", label: "WhatsApp Number", placeholder: "", fixed: false },
] as const;

export type BuiltinKey = (typeof BUILTIN_FIELDS)[number]["key"];

export type BuiltinField = { label?: string; placeholder?: string; mode?: FieldMode; help?: string };

export type LoginCopy = {
  heading?: string;
  intro?: string;
  identifierLabel?: string;
  identifierPlaceholder?: string;
  passwordLabel?: string;
  passwordPlaceholder?: string;
  button?: string;
};

export type SignupControls = {
  birthDate: FieldMode;
  fields: SignupField[];
  builtins?: Partial<Record<BuiltinKey, BuiltinField>>;
  terms?: string;
  submit?: string;
  login?: LoginCopy;
};

/** Label, placeholder and mode of a built-in signup field, with admin overrides applied. */
export function builtinField(controls: SignupControls | undefined, key: BuiltinKey) {
  const base = BUILTIN_FIELDS.find((field) => field.key === key)!;
  const custom = controls?.builtins?.[key] ?? {};
  const mode: FieldMode = base.fixed ? "required" : custom.mode ?? (key === "whatsapp" ? "required" : "optional");
  return { label: custom.label?.trim() || base.label, placeholder: custom.placeholder?.trim() || base.placeholder, mode, help: custom.help?.trim() || "" };
}

/** A reel is either an uploaded video file or an Instagram / YouTube / Facebook link. */
export type InstagramReel = { id: string; url: string; video?: string; caption?: string; enabled: boolean };

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
    .map((row, index) => ({
      id: rowId(row.id, index),
      title: str(row.title, 120),
      body: str(row.body),
      enabled: row.enabled !== false,
      placement: (row.placement === "top" || row.placement === "both" ? row.placement : "bottom") as DisclaimerPlacement,
    }))
    .filter((row) => row.title || row.body);
}

const TYPES: SignupFieldType[] = ["text", "number", "date", "textarea", "select"];

export function normalizeSignup(input: unknown): SignupControls {
  const row = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const birth = row.birthDate === "required" || row.birthDate === "hidden" ? row.birthDate : "optional";
  const rawBuiltins = (row.builtins && typeof row.builtins === "object" ? row.builtins : {}) as Record<string, Record<string, unknown>>;
  const builtins: Partial<Record<BuiltinKey, BuiltinField>> = {};
  for (const field of BUILTIN_FIELDS) {
    const item = rawBuiltins[field.key];
    if (!item || typeof item !== "object") continue;
    const mode = item.mode === "required" || item.mode === "optional" || item.mode === "hidden" ? item.mode : undefined;
    builtins[field.key] = {
      label: str(item.label, 80) || undefined,
      placeholder: str(item.placeholder, 120) || undefined,
      help: str(item.help, 240) || undefined,
      mode: field.fixed ? undefined : mode,
    };
  }
  const rawLogin = (row.login && typeof row.login === "object" ? row.login : {}) as Record<string, unknown>;
  const login: LoginCopy = {};
  for (const key of ["heading", "intro", "identifierLabel", "identifierPlaceholder", "passwordLabel", "passwordPlaceholder", "button"] as const) {
    const value = str(rawLogin[key], key === "intro" ? 600 : 120).trim();
    if (value) login[key] = value;
  }
  return {
    builtins,
    login,
    terms: str(row.terms, 400).trim() || undefined,
    submit: str(row.submit, 60).trim() || undefined,
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

export type ReelEmbed = { kind: "video" | "frame"; src: string };

export function reelEmbed(reel: Pick<InstagramReel, "url" | "video">): ReelEmbed | null {
  const video = reel.video?.trim();
  if (video && (/^\/uploads\//.test(video) || /^https:\/\//.test(video))) return { kind: "video", src: video };
  const url = reel.url.trim();
  const insta = reelCode(url);
  if (insta) return { kind: "frame", src: `https://www.instagram.com/reel/${insta}/embed` };
  const yt = url.match(/(?:youtube\.com\/(?:shorts\/|watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/i)?.[1];
  if (yt) return { kind: "frame", src: `https://www.youtube-nocookie.com/embed/${yt}` };
  if (/^https:\/\/(www\.|m\.)?facebook\.com\/.+\/(videos|reel)\//i.test(url) || /^https:\/\/(www\.)?facebook\.com\/reel\//i.test(url)) {
    return { kind: "frame", src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false` };
  }
  if (/^https:\/\/.+\.(mp4|webm|mov)(\?.*)?$/i.test(url)) return { kind: "video", src: url };
  return null;
}

export function normalizeReels(input: unknown): InstagramReel[] {
  return list(input)
    .map((row, index) => ({
      id: rowId(row.id, index),
      url: str(row.url, 400).trim(),
      video: str(row.video, 400).trim() || undefined,
      caption: str(row.caption, 200) || undefined,
      enabled: row.enabled !== false,
    }))
    .filter((row) => reelEmbed(row));
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
