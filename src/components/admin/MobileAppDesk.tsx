"use client";

import { useEffect, useState } from "react";
import { getIntegrations } from "@/lib/integrations";
import {
  appFlavors,
  defaultMobileAppConfig,
  getMobileAppConfig,
  mobileModules,
  saveMobileAppConfig,
  type MobileAppConfig,
  type MobileModuleId,
} from "@/lib/mobile-config";
import { collectMobileSnapshot } from "@/lib/mobile-publish";
import { ImageField } from "@/components/admin/ImageField";

const input = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";
const primary = "rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const ghost = "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50";

export function MobileAppDesk() {
  const [config, setConfig] = useState<MobileAppConfig>(defaultMobileAppConfig);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [publishedAt, setPublishedAt] = useState("");

  useEffect(() => {
    setConfig(getMobileAppConfig());
    void fetch("/api/mobile/publish", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { publishedAt?: string }) => {
        if (data.publishedAt) setPublishedAt(data.publishedAt);
      })
      .catch(() => undefined);
  }, []);

  const patch = (next: Partial<MobileAppConfig>) => setConfig((current) => ({ ...current, ...next }));

  const save = () => {
    saveMobileAppConfig(config);
    setNote("App settings saved on this browser. Publish to app to push them to phones.");
  };

  const publish = async () => {
    saveMobileAppConfig(config);
    setBusy(true);
    setNote("Publishing the live website snapshot to the app…");
    try {
      const snapshot = collectMobileSnapshot();
      const response = await fetch("/api/mobile/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...snapshot, email: getIntegrations().email }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        publishedAt?: string;
        counts?: Record<string, number>;
      };
      if (!data.ok) {
        setNote(data.error || "Publish failed.");
        return;
      }
      setPublishedAt(data.publishedAt ?? "");
      const counts = data.counts
        ? Object.entries(data.counts)
            .map(([key, value]) => `${value} ${key}`)
            .join(", ")
        : "snapshot stored";
      setNote(`Published ${new Date(data.publishedAt ?? Date.now()).toLocaleString("en-IN")}. ${counts}. Installed apps refresh this feed — no Play Store or App Store update is required.`);
    } catch (error) {
      setNote((error as Error).message || "Publish failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mobile app</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            The Android and iOS apps load events, articles, shop, clinics, notices, about pages and more from this website.
            Publish after you change content. That updates phones immediately — you do not submit a new Play Store or App Store
            build for ordinary publishing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={ghost} onClick={save}>
            Save settings
          </button>
          <button type="button" className={primary} disabled={busy} onClick={() => void publish()}>
            {busy ? "Publishing…" : "Publish to app"}
          </button>
        </div>
      </div>

      {note ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{note}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Public download</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Hidden on the website until you turn this on. The footer link and /app download cards stay off by default.
        </p>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-burgundy"
            checked={config.showPublicDownload}
            onChange={(event) => patch({ showPublicDownload: event.target.checked })}
          />
          Show Android app download on the public site
        </label>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <button type="button" className={primary} onClick={save}>
            Save
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">App name and logo</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          These appear inside the installed apps on the next refresh. You do not submit a Play Store or App Store update to
          rename an app or change its logo. Publish after saving.
        </p>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          {appFlavors.map((app) => {
            const brand = config.apps[app.id];
            return (
              <div key={app.id} className="rounded-xl border border-slate-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{app.label}</p>
                <label className="mt-3 block text-sm font-medium text-slate-700">
                  Display name
                  <input
                    className={`${input} mt-1`}
                    value={brand.name}
                    onChange={(event) =>
                      patch({
                        apps: {
                          ...config.apps,
                          [app.id]: { ...brand, name: event.target.value },
                        },
                      })
                    }
                  />
                </label>
                <div className="mt-3">
                  <ImageField
                    label="Logo"
                    value={brand.logoUrl}
                    maxWidth={400}
                    hint="Shown in the app header. PNG or SVG."
                    onChange={(logoUrl) =>
                      patch({
                        apps: {
                          ...config.apps,
                          [app.id]: { ...brand, logoUrl },
                        },
                      })
                    }
                  />
                </div>
                <a className="mt-3 inline-block text-sm font-semibold text-burgundy" href={app.download}>
                  Download {app.defaultName} APK
                </a>
              </div>
            );
          })}
        </div>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <button type="button" className={primary} onClick={save}>
            Save names and logos
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Live feed</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Last published: {publishedAt ? new Date(publishedAt).toLocaleString("en-IN") : "not yet — publish once so the app has the current site."}{" "}
          Email sign-in codes use ZeptoMail or Zoho from Admin → Email (email OTP only — WhatsApp OTP is not used).
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <a className="font-semibold text-burgundy" href="/api/mobile/feed" target="_blank" rel="noreferrer">
            View app feed JSON
          </a>
          <a className="font-semibold text-burgundy" href="/app">
            Android download page
          </a>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Screens shown in the app</h2>
        <p className="mt-0.5 text-sm text-slate-500">Turn a module off and publish. The next app refresh hides that tab. No store release.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {mobileModules.map((item) => (
            <label key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-burgundy"
                checked={config.modules[item.id] !== false}
                onChange={(event) =>
                  patch({
                    modules: { ...config.modules, [item.id]: event.target.checked } as Record<MobileModuleId, boolean>,
                  })
                }
              />
              {item.label}
            </label>
          ))}
        </div>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <button type="button" className={primary} onClick={save}>
            Save
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Store listing (optional)</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Content still updates from Publish to app. Use these only if you later list the wrapper binary on the stores, or to
          force a rare native upgrade.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Minimum native version
            <input className={`${input} mt-1`} value={config.minVersion} onChange={(event) => patch({ minVersion: event.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Latest native version
            <input className={`${input} mt-1`} value={config.latestVersion} onChange={(event) => patch({ latestVersion: event.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Android package
            <input className={`${input} mt-1`} value={config.androidPackage} onChange={(event) => patch({ androidPackage: event.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            iOS bundle
            <input className={`${input} mt-1`} value={config.iosBundle} onChange={(event) => patch({ iosBundle: event.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Play Store URL
            <input className={`${input} mt-1`} value={config.playStoreUrl} onChange={(event) => patch({ playStoreUrl: event.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            App Store URL
            <input className={`${input} mt-1`} value={config.appStoreUrl} onChange={(event) => patch({ appStoreUrl: event.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            API base URL (leave blank to use this website)
            <input className={`${input} mt-1`} value={config.apiBaseUrl} placeholder="https://vaidyagogate.org" onChange={(event) => patch({ apiBaseUrl: event.target.value })} />
          </label>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-burgundy"
            checked={config.forceUpdate}
            onChange={(event) => patch({ forceUpdate: event.target.checked })}
          />
          Force a native app update when the installed version is below the minimum (does not apply to CMS publishing)
        </label>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <button type="button" className={primary} onClick={save}>
            Save
          </button>
        </div>
      </section>
    </div>
  );
}
