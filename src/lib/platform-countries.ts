import { COUNTRIES, DEFAULT_COUNTRY, countryByCode, type Country } from "@/lib/geo";

export const PLATFORM_COUNTRIES_KEY = "vgmf_platform_countries";

export type PlatformCountries = {
  allowInternational: boolean;
  enabledCountryCodes: string[];
};

export const defaultPlatformCountries: PlatformCountries = {
  allowInternational: true,
  enabledCountryCodes: [],
};

export const DIASPORA_COUNTRY_CODES = [
  "IN",
  "US",
  "GB",
  "CA",
  "AU",
  "AE",
  "SG",
  "NZ",
  "DE",
  "FR",
  "NL",
  "IE",
  "ZA",
  "MY",
  "NP",
  "LK",
  "BD",
];

const VALID_CODES = new Set(COUNTRIES.map((country) => country.code));

export function sanitizePlatformCountries(input?: Partial<PlatformCountries> | null): PlatformCountries {
  const codes = Array.from(
    new Set(
      (input?.enabledCountryCodes ?? [])
        .map((code) => String(code || "").trim().toUpperCase())
        .filter((code) => VALID_CODES.has(code))
    )
  );
  return {
    allowInternational: input?.allowInternational !== false,
    enabledCountryCodes: codes,
  };
}

export function enabledCountryCodes(config: PlatformCountries = defaultPlatformCountries): string[] {
  if (!config.allowInternational) return [DEFAULT_COUNTRY];
  if (!config.enabledCountryCodes.length) return COUNTRIES.map((country) => country.code);
  return config.enabledCountryCodes.filter((code) => VALID_CODES.has(code));
}

export function enabledCountries(config: PlatformCountries = defaultPlatformCountries): Country[] {
  const allowed = new Set(enabledCountryCodes(config));
  return COUNTRIES.filter((country) => allowed.has(country.code));
}

export function isCountryEnabled(code?: string, config: PlatformCountries = defaultPlatformCountries) {
  const needle = String(code || "").trim().toUpperCase();
  if (!needle) return config.allowInternational;
  return enabledCountryCodes(config).includes(needle);
}

export function defaultEnabledCountry(config: PlatformCountries = defaultPlatformCountries): Country {
  const list = enabledCountries(config);
  return list.find((country) => country.code === DEFAULT_COUNTRY) ?? list[0] ?? countryByCode(DEFAULT_COUNTRY);
}

export function getPlatformCountries(): PlatformCountries {
  if (typeof window === "undefined") return defaultPlatformCountries;
  try {
    const raw = window.localStorage.getItem(PLATFORM_COUNTRIES_KEY);
    if (!raw) return defaultPlatformCountries;
    return sanitizePlatformCountries(JSON.parse(raw) as Partial<PlatformCountries>);
  } catch {
    return defaultPlatformCountries;
  }
}

export function savePlatformCountries(config: PlatformCountries) {
  if (typeof window === "undefined") return sanitizePlatformCountries(config);
  const next = sanitizePlatformCountries(config);
  window.localStorage.setItem(PLATFORM_COUNTRIES_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("vgmf-cms"));
  return next;
}
