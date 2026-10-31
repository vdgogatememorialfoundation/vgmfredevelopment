import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { COUNTRIES, DEFAULT_COUNTRY, countryByCode } from "@/lib/geo";
import { dataFile } from "@/lib/server/paths";

export type PlatformCountries = {
  allowInternational: boolean;
  enabledCountryCodes: string[];
};

export const defaultPlatformCountries: PlatformCountries = {
  allowInternational: true,
  enabledCountryCodes: [],
};

const VALID_CODES = new Set(COUNTRIES.map((country) => country.code));

function filePath() {
  return dataFile("platform-countries.json");
}

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

export function readPlatformCountries(): PlatformCountries {
  try {
    return sanitizePlatformCountries(JSON.parse(readFileSync(filePath(), "utf8")) as Partial<PlatformCountries>);
  } catch {
    return defaultPlatformCountries;
  }
}

export function writePlatformCountries(next: PlatformCountries) {
  const file = filePath();
  const value = sanitizePlatformCountries(next);
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(value, null, 2));
  } catch {
    /* read-only host */
  }
  return value;
}

export function enabledCountryCodes(config = readPlatformCountries()): string[] {
  if (!config.allowInternational) return [DEFAULT_COUNTRY];
  if (!config.enabledCountryCodes.length) return COUNTRIES.map((country) => country.code);
  return config.enabledCountryCodes.filter((code) => VALID_CODES.has(code));
}

export function isCountryEnabled(code?: string, config = readPlatformCountries()) {
  const needle = String(code || "").trim();
  if (!needle) return false;
  const upper = needle.toUpperCase();
  if (VALID_CODES.has(upper)) return enabledCountryCodes(config).includes(upper);
  const named = COUNTRIES.find(
    (country) => country.name.toLowerCase() === needle.toLowerCase() || country.code.toLowerCase() === needle.toLowerCase()
  );
  return named ? enabledCountryCodes(config).includes(named.code) : false;
}

export function countryRejection(code?: string, name?: string) {
  const rawCode = String(code || "").trim();
  const rawName = String(name || "").trim();
  if (!rawCode && !rawName) return null;
  if (rawCode ? isCountryEnabled(rawCode) : isCountryEnabled(rawName)) return null;
  const label = rawName || countryByCode(rawCode).name || rawCode;
  return `The Foundation is not available in ${label} yet.`;
}

export function publicPlatformCountries(config = readPlatformCountries()) {
  const codes = enabledCountryCodes(config);
  const allowed = new Set(codes);
  return {
    allowInternational: config.allowInternational,
    enabledCountryCodes: config.enabledCountryCodes,
    countries: COUNTRIES.filter((country) => allowed.has(country.code)).map((country) => ({
      code: country.code,
      name: country.name,
      dial: country.dial,
    })),
  };
}
