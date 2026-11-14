"use client";

import { useSiteSettings } from "@/lib/use-cms";

export default function WhatsAppQueryButton() {
  const settings = useSiteSettings();
  const number = (settings?.queryNumber ?? "").replace(/\D/g, "");
  if (!settings?.queryButton || number.length < 10) return null;
  const message = settings.queryMessage?.trim();
  const href = `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ""}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Ask us on WhatsApp"
      title="Ask us on WhatsApp"
      className="fixed right-4 bottom-[10.5rem] z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_10px_24px_rgba(18,140,76,0.35)] transition hover:bg-[#1EBE5A] sm:right-6"
    >
      <svg width="26" height="26" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
        <path d="M16.04 3C9.4 3 4 8.33 4 14.9c0 2.3.66 4.45 1.82 6.28L4 29l8.06-2.1a12.2 12.2 0 0 0 3.98.66C22.67 27.56 28 22.23 28 15.66 28 9.1 22.67 3 16.04 3Zm0 22.3c-1.25 0-2.47-.22-3.6-.65l-.26-.1-4.78 1.24 1.27-4.6-.17-.27a9.6 9.6 0 0 1-1.6-5.02c0-5.37 4.4-9.74 9.8-9.74 5.4 0 9.8 4.93 9.8 10.3 0 5.36-4.4 8.84-9.8 8.84Zm5.37-7.3c-.3-.15-1.74-.86-2.01-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.46-.88-.78-1.47-1.75-1.64-2.04-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.57-.48-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.03 1-1.03 2.45 0 1.44 1.06 2.84 1.2 3.03.15.2 2.08 3.16 5.04 4.43.7.3 1.25.48 1.68.62.7.22 1.35.19 1.86.12.57-.09 1.74-.71 1.99-1.4.25-.68.25-1.27.17-1.4-.07-.12-.27-.2-.56-.34Z" />
      </svg>
    </a>
  );
}
