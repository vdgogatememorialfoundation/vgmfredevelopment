export const LOCALES = [
  { id: "en", name: "English", native: "English", html: "en-IN" },
  { id: "hi", name: "Hindi", native: "हिन्दी", html: "hi-IN" },
  { id: "mr", name: "Marathi", native: "मराठी", html: "mr-IN" },
  { id: "kn", name: "Kannada", native: "ಕನ್ನಡ", html: "kn-IN" },
  { id: "ta", name: "Tamil", native: "தமிழ்", html: "ta-IN" },
  { id: "ml", name: "Malayalam", native: "മലയാളം", html: "ml-IN" },
  { id: "gu", name: "Gujarati", native: "ગુજરાતી", html: "gu-IN" },
  { id: "te", name: "Telugu", native: "తెలుగు", html: "te-IN" },
  { id: "bn", name: "Bengali", native: "বাংলা", html: "bn-IN" },
  { id: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ", html: "pa-IN" },
  { id: "or", name: "Odia", native: "ଓଡ଼ିଆ", html: "or-IN" },
  { id: "as", name: "Assamese", native: "অসমীয়া", html: "as-IN" },
  { id: "ur", name: "Urdu", native: "اردو", html: "ur-IN" },
] as const;

export type Locale = (typeof LOCALES)[number]["id"];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_KEY = "vgmf_locale";

export function isLocale(value: string): value is Locale {
  return LOCALES.some((locale) => locale.id === value);
}
