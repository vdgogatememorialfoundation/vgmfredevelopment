"use client";

import { useMemo, useState } from "react";
import { COUNTRIES } from "@/lib/geo";
import {
  DIASPORA_COUNTRY_CODES,
  enabledCountryCodes,
  getPlatformCountries,
  savePlatformCountries,
  sanitizePlatformCountries,
  type PlatformCountries,
} from "@/lib/platform-countries";

const button = "rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const ghost = "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700";
const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

export function CountriesDesk() {
  const [config, setConfig] = useState<PlatformCountries>(() => getPlatformCountries());
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return COUNTRIES;
    return COUNTRIES.filter(
      (country) =>
        country.name.toLowerCase().includes(needle) ||
        country.code.toLowerCase().includes(needle) ||
        country.dial.includes(needle.replace(/\s/g, ""))
    );
  }, [query]);

  const selected = new Set(enabledCountryCodes(config));
  const allOn = config.allowInternational && config.enabledCountryCodes.length === 0;

  const patch = (next: PlatformCountries) => {
    setConfig(sanitizePlatformCountries(next));
    setSaved(false);
    setError("");
  };

  const toggle = (code: string) => {
    if (!config.allowInternational) return;
    const current = allOn ? COUNTRIES.map((country) => country.code) : [...config.enabledCountryCodes];
    const next = current.includes(code) ? current.filter((item) => item !== code) : [...current, code];
    patch({
      allowInternational: true,
      enabledCountryCodes: next.length === COUNTRIES.length ? [] : next,
    });
  };

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const next = savePlatformCountries(config);
      setConfig(next);
      const response = await fetch("/api/platform/countries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; config?: PlatformCountries; error?: string } | null;
      if (data?.config) setConfig(sanitizePlatformCountries(data.config));
      if (!response.ok || data?.ok === false) {
        setError(data?.error || "Saved in this browser. The live list could not be published.");
      }
      setSaved(true);
    } catch {
      setError("Saved in this browser. The live list could not be published.");
      setSaved(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Countries</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Choose where customers can create accounts and place orders on the website and in the customer app.
          International customers are on by default. Turn the switch off to keep the platform India-only.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <label className="flex items-start gap-3 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-300"
            checked={config.allowInternational}
            onChange={(event) =>
              patch({
                allowInternational: event.target.checked,
                enabledCountryCodes: event.target.checked ? config.enabledCountryCodes : ["IN"],
              })
            }
          />
          <span>
            Enable international customers
            <span className="mt-1 block font-normal text-slate-500">
              When this is on, signup, checkout and the customer app accept addresses and phone numbers from the countries you select below.
            </span>
          </span>
        </label>

        {!config.allowInternational ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Only India is available on the customer website and app.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={ghost} onClick={() => patch({ allowInternational: true, enabledCountryCodes: [] })}>
                All countries
              </button>
              <button type="button" className={ghost} onClick={() => patch({ allowInternational: false, enabledCountryCodes: ["IN"] })}>
                India only
              </button>
              <button
                type="button"
                className={ghost}
                onClick={() => patch({ allowInternational: true, enabledCountryCodes: DIASPORA_COUNTRY_CODES })}
              >
                Common diaspora
              </button>
            </div>
            <input
              className={field}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search country, code or dial — India, United Kingdom, +1"
            />
            <p className="text-sm text-slate-600">
              {allOn ? `${COUNTRIES.length} countries enabled` : `${selected.size} of ${COUNTRIES.length} countries enabled`}
            </p>
            <div className="max-h-[28rem] space-y-1 overflow-auto rounded-lg border border-slate-200 p-3">
              {matches.map((country) => (
                <label key={country.code} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-slate-800 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={selected.has(country.code)}
                    onChange={() => toggle(country.code)}
                  />
                  <span className="flex-1">
                    {country.name}
                    <span className="ml-2 text-slate-500">
                      {country.code} · {country.dial}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </>
        )}

        <button type="button" className={button} onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : "Save countries"}
        </button>
        {saved && !error ? <p className="text-sm text-emerald-700">Country list saved for the website and customer app.</p> : null}
        {error ? <p className="text-sm text-amber-800">{error}</p> : null}
      </div>
    </div>
  );
}
