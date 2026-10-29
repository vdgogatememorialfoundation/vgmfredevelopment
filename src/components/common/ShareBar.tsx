"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n/LanguageProvider";

export function ShareBar({
  url,
  title,
  text,
}: {
  url: string;
  title: string;
  text?: string;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [copiedPost, setCopiedPost] = useState(false);
  const body = text?.trim() || title;
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedBody = encodeURIComponent(`${body}\n${url}`);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${title}\n${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const copyPost = async () => {
    try {
      await navigator.clipboard.writeText(`${title}\n\n${body}\n\n${url}`);
      setCopiedPost(true);
      window.setTimeout(() => setCopiedPost(false), 2000);
    } catch {
      setCopiedPost(false);
    }
  };

  const nativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text: body, url });
        return;
      } catch {
        /* cancelled */
      }
    }
    void copy();
  };

  const links = [
    { key: "facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, label: t("article.shareFacebook") },
    { key: "x", href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`, label: t("article.shareX") },
    { key: "linkedin", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, label: t("article.shareLinkedin") },
    { key: "whatsapp", href: `https://wa.me/?text=${encodedBody}`, label: t("article.shareWhatsapp") },
    { key: "telegram", href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`, label: t("article.shareTelegram") },
    { key: "email", href: `mailto:?subject=${encodedTitle}&body=${encodedBody}`, label: t("article.shareEmail") },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">{t("article.share")}</p>
      <button type="button" onClick={() => void nativeShare()} className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-ink hover:border-burgundy hover:text-burgundy">
        {t("common.share")}
      </button>
      {links.map((link) => (
        <a
          key={link.key}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-ink hover:border-burgundy hover:text-burgundy"
        >
          {link.label}
        </a>
      ))}
      <button type="button" onClick={() => void copy()} className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-ink hover:border-burgundy hover:text-burgundy">
        {copied ? t("article.copied") : t("article.copyLink")}
      </button>
      <button type="button" onClick={() => void copyPost()} className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-ink hover:border-burgundy hover:text-burgundy">
        {copiedPost ? t("article.copied") : t("article.copyPost")}
      </button>
    </div>
  );
}
