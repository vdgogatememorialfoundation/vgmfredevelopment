"use client";

import { useEffect, useState } from "react";
import { subscribeCms } from "@/lib/cms";
import {
  enabledCountries,
  getPlatformCountries,
  sanitizePlatformCountries,
  savePlatformCountries,
  type PlatformCountries,
} from "@/lib/platform-countries";

export function usePlatformCountries() {
  const [config, setConfig] = useState<PlatformCountries>(getPlatformCountries);

  useEffect(() => {
    const sync = () => setConfig(getPlatformCountries());
    const unsub = subscribeCms(sync);
    void fetch("/api/platform/countries", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ ok?: boolean; config?: PlatformCountries }>)
      .then((data) => {
        if (!data?.ok || !data.config) return;
        const next = sanitizePlatformCountries(data.config);
        const current = getPlatformCountries();
        if (
          current.allowInternational === next.allowInternational &&
          current.enabledCountryCodes.join(",") === next.enabledCountryCodes.join(",")
        ) {
          setConfig(next);
          return;
        }
        savePlatformCountries(next);
        setConfig(next);
      })
      .catch(() => undefined);
    return unsub;
  }, []);

  return {
    config,
    countries: enabledCountries(config),
    allowInternational: config.allowInternational,
  };
}
