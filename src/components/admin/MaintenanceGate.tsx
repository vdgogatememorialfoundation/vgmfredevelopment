"use client";

import { useEffect, useState } from "react";
import { getSettings, saveSettings } from "@/lib/admin-store";
import { useSiteSettings } from "@/lib/use-cms";
import { useAuth } from "@/components/auth/AuthContext";
import SiteLogo from "@/components/common/SiteLogo";

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const settings = useSiteSettings();
  const { user } = useAuth();
  const until = settings?.maintenanceUntil ? Date.parse(settings.maintenanceUntil) : NaN;
  const on = Boolean(settings?.maintenanceMode);
  const now = useNow(on && Number.isFinite(until));
  const expired = on && Number.isFinite(until) && until <= now;

  useEffect(() => {
    if (!expired) return;
    saveSettings({ ...getSettings(), maintenanceMode: false, maintenanceUntil: "" });
    window.dispatchEvent(new Event("vgmf-cms"));
  }, [expired]);

  useEffect(() => {
    const href = settings?.faviconUrl || settings?.logoUrl || "/icon.png";
    const apply = (rel: string, type?: string) => {
      let link = document.querySelector<HTMLLinkElement>(`link[rel='${rel}']`);
      if (!link) {
        link = document.createElement("link");
        link.rel = rel;
        if (type) link.type = type;
        document.head.appendChild(link);
      }
      link.href = href;
    };
    apply("icon", "image/png");
    apply("shortcut icon", "image/png");
    apply("apple-touch-icon");
  }, [settings?.faviconUrl, settings?.logoUrl]);

  if (!on || expired || user?.role === "admin" || user?.role === "staff") {
    return (
      <>
        {on && !expired && (
          <div className="bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-800">
            Maintenance mode is on. Visitors see the maintenance page; you see the site because you are signed in as {user?.role}.
          </div>
        )}
        {children}
      </>
    );
  }

  const left = Number.isFinite(until) ? Math.max(0, until - now) : null;
  const parts =
    left === null
      ? null
      : [
          { label: "Days", value: Math.floor(left / 864e5) },
          { label: "Hours", value: Math.floor((left % 864e5) / 36e5) },
          { label: "Minutes", value: Math.floor((left % 36e5) / 6e4) },
          { label: "Seconds", value: Math.floor((left % 6e4) / 1000) },
        ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white to-warm-cream px-6 text-center">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-white p-10 shadow-sm">
        <div className="flex justify-center">
          <SiteLogo size={64} />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-burgundy">Scheduled maintenance</p>
        <h1 className="mt-2 font-serif text-3xl font-bold text-text-primary">We will be back shortly</h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">{settings?.maintenanceMessage}</p>
        {parts && (
          <>
            <div className="mt-8 grid grid-cols-4 gap-3">
              {parts.map((part) => (
                <div key={part.label} className="rounded-xl border border-border bg-warm-cream/50 py-3">
                  <p className="text-2xl font-bold tabular-nums text-text-primary">{String(part.value).padStart(2, "0")}</p>
                  <p className="text-[11px] uppercase tracking-wider text-text-muted">{part.label}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-text-muted">
              Expected back {new Date(until).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </>
        )}
        {settings?.supportEmail && (
          <p className="mt-6 text-xs text-text-muted">
            Need help? <a className="font-semibold text-burgundy" href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a>
          </p>
        )}
      </div>
    </div>
  );
}
