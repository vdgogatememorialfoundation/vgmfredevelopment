"use client";

import type { Event } from "@/types";
import PartnerRegister from "@/components/events/PartnerRegister";
import { RegistrationCountdown } from "@/components/events/RegistrationCountdown";
import { useI18n } from "@/components/i18n/LanguageProvider";
import {
  configuredWindows,
  formatWindowWhen,
  openRegistrationPhase,
  registrationBadge,
  windowPhase,
} from "@/lib/registration-windows";

const phaseText = {
  upcoming: "Opens",
  open: "Open",
  closing: "Closing soon",
  closed: "Closed",
} as const;

export function EventRegistration({ event, variant = "page" }: { event: Event; variant?: "page" | "card" }) {
  const { t } = useI18n();
  const windows = configuredWindows(event);
  const phase = openRegistrationPhase(event);
  const portalId = event.source === "seminar" || event.source === "autism" ? Number(String(event.id).split("-").pop()) : 0;

  if (!windows.length) {
    return variant === "card" ? <RegistrationCountdown event={event} compact /> : <RegistrationCountdown event={event} />;
  }

  return (
    <div className={variant === "card" ? "space-y-2" : "mt-4 space-y-3"}>
      {windows.map((window) => {
        const state = windowPhase(window);
        return (
          <div key={window.label} className="rounded-xl border border-border bg-warm-cream/50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-burgundy">{window.label}</p>
            <p className="mt-1 text-sm font-medium text-text-primary">{phaseText[state]}</p>
            {window.start ? <p className="text-xs text-text-muted">Starts {formatWindowWhen(window.start)}</p> : null}
            {window.end ? <p className="text-xs text-text-muted">Ends {formatWindowWhen(window.end)}</p> : null}
          </div>
        );
      })}
      {variant === "page" && phase && portalId > 0 && event.source && event.source !== "vgmf" ? (
        <PartnerRegister portal={event.source} seminarId={portalId} phase={phase} />
      ) : null}
      {variant === "page" && !phase ? (
        <p className="btn-outline mt-2 w-full pointer-events-none cursor-not-allowed opacity-60">
          {windows.every((window) => windowPhase(window) === "closed") ? t("events.closed") : registrationBadge(event)}
        </p>
      ) : null}
    </div>
  );
}
