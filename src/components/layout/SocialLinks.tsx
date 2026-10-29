"use client";

import type { ReactNode } from "react";
import { SOCIAL_NETWORKS, configuredSocial, type SocialNetworkId } from "@/lib/social";
import { useSiteSettings } from "@/lib/use-cms";
import { classNames } from "@/lib/utils";

const ICONS: Record<SocialNetworkId, ReactNode> = {
  facebook: <path fill="currentColor" d="M22 12.07A10 10 0 1 0 10.5 21.9v-7H8v-2.8h2.5V9.6c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.5v1.8H16.6L16.2 15h-2.5v7A10 10 0 0 0 22 12.07z" />,
  instagram: (
    <>
      <path fill="currentColor" d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm10 2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />
      <path fill="currentColor" d="M12 8.2A3.8 3.8 0 1 1 8.2 12 3.8 3.8 0 0 1 12 8.2zm0 2A1.8 1.8 0 1 0 13.8 12 1.8 1.8 0 0 0 12 10.2z" />
      <circle fill="currentColor" cx="16.8" cy="7.2" r="1" />
    </>
  ),
  linkedin: (
    <>
      <path fill="currentColor" d="M6.5 9.5H4V20h2.5zM5.2 4A1.5 1.5 0 1 0 5.2 7a1.5 1.5 0 0 0 0-3z" />
      <path fill="currentColor" d="M10 9.5h2.4v1.4h.1c.3-.6 1.2-1.6 2.8-1.6 3 0 3.5 2 3.5 4.5V20H16.3v-5.2c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V20H10z" />
    </>
  ),
  youtube: (
    <>
      <path fill="currentColor" d="M23 12.2s0-3.2-.4-4.7a3 3 0 0 0-2.1-2.1C18.7 5 12 5 12 5s-6.7 0-8.5.4a3 3 0 0 0-2.1 2.1C1 9 1 12.2 1 12.2s0 3.2.4 4.7a3 3 0 0 0 2.1 2.1C5.3 19.4 12 19.4 12 19.4s6.7 0 8.5-.4a3 3 0 0 0 2.1-2.1c.4-1.5.4-4.7.4-4.7z" />
      <path fill="#fff" d="M10 15.2V9.2l5.4 3z" />
    </>
  ),
  twitter: <path fill="currentColor" d="M3.5 3.5h4.7l4.2 5.8L17.2 3.5H21l-6.6 8.3L21.5 20.5h-4.7l-4.6-6.4-5.2 6.4H3l7.2-8.7z" />,
  whatsapp: (
    <path fill="currentColor" d="M12 2a10 10 0 0 0-8.7 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm5.7 14.2c-.2.7-1.3 1.2-2.1 1.4-.6.1-1.3.2-2.1 0-1.3-.3-4-1.4-5.8-4.3-1.3-2-1.4-3.7-1.2-4.5.2-.8.8-1.4 1.4-1.6h.5c.3 0 .5 0 .7.5l1 2.3c.1.3 0 .5-.2.7l-.6.7c-.2.2-.2.4 0 .7.5.8 1.4 1.8 2.4 2.4.4.3.7.3.9.1l.8-.5c.2-.1.5 0 .6.2l1.6 1.8c.3.3.2.6 0 .8z" />
  ),
};

export default function SocialLinks({
  className,
  iconClassName,
  tone = "light",
  title,
  always = false,
}: {
  className?: string;
  iconClassName?: string;
  tone?: "light" | "dark";
  title?: string;
  /** Show every network; links activate when admin adds an https URL. */
  always?: boolean;
}) {
  const settings = useSiteSettings();
  const configured = configuredSocial(settings?.social);
  const merged = settings?.social;
  const links = always
    ? SOCIAL_NETWORKS.map((network) => ({
        ...network,
        href: (merged?.[network.id] ?? "").trim(),
      }))
    : configured;
  if (links.length === 0) return null;

  const list = (
    <ul className={classNames("flex flex-wrap items-center gap-2", !title && className)}>
      {links.map((link) => {
        const active = /^https?:\/\//i.test(link.href);
        const classNameIcon = classNames(
          "inline-flex h-9 w-9 items-center justify-center rounded-full border transition",
          tone === "light"
            ? "border-gold/40 bg-white/10 text-stone-100 hover:border-gold hover:text-gold"
            : "border-gold/50 bg-white text-burgundy hover:border-burgundy hover:text-burgundy",
          !active && "opacity-60",
          iconClassName
        );
        const icon = (
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
            {ICONS[link.id]}
          </svg>
        );
        return (
          <li key={link.id}>
            {active ? (
              <a href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label} className={classNameIcon}>
                {icon}
              </a>
            ) : (
              <span aria-label={`${link.label} (add a link in Admin → Settings)`} title={`${link.label}: add a link in Admin → General`} className={classNameIcon}>
                {icon}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );

  if (!title) return list;

  return (
    <div className={className}>
      <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-text-muted">{title}</h2>
      <div className="mt-3">{list}</div>
    </div>
  );
}
