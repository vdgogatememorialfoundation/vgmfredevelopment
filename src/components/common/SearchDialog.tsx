"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CornerDownLeft,
  FileText,
  Newspaper,
  PlayCircle,
  Search,
  Stethoscope,
  X,
  type LucideIcon,
} from "lucide-react";
import { events } from "@/data/events";
import { books } from "@/data/books";
import { articles } from "@/data/articles";
import { clinics } from "@/data/clinics";
import { videos } from "@/data/videos";
import { classNames } from "@/lib/utils";

type SearchItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  group: string;
  icon: LucideIcon;
};

const pages: SearchItem[] = [
  { id: "p-about", title: "About the Foundation", subtitle: "Mission, history and trustees", href: "/about", group: "Pages", icon: FileText },
  { id: "p-legacy", title: "Legacy of Vaidya R. B. Gogate", subtitle: "Life and scholarship", href: "/about/legacy-of-vaidya-rb-gogate", group: "Pages", icon: FileText },
  { id: "p-programmes", title: "Programmes", subtitle: "Education, research, clinics and outreach", href: "/programmes", group: "Pages", icon: FileText },
  { id: "p-donate", title: "Support Us", subtitle: "Donate to scholarships, research and camps", href: "/donate", group: "Pages", icon: FileText },
  { id: "p-gallery", title: "Gallery", subtitle: "Photos from our programmes", href: "/gallery", group: "Pages", icon: FileText },
  { id: "p-faq", title: "FAQ", subtitle: "Frequently asked questions", href: "/faq", group: "Pages", icon: FileText },
  { id: "p-cert", title: "Certificate Verification", subtitle: "Verify a VGMF certificate", href: "/certificate-verification", group: "Pages", icon: FileText },
  { id: "p-contact", title: "Contact", subtitle: "Email, phone and WhatsApp", href: "/contact", group: "Pages", icon: FileText },
];

const index: SearchItem[] = [
  ...pages,
  ...events.map((event) => ({
    id: event.id,
    title: event.name,
    subtitle: `${event.eventType} · ${event.city ?? event.mode}`,
    href: `/events/${event.slug}`,
    group: "Events",
    icon: CalendarDays,
  })),
  ...books.map((book) => ({
    id: book.id,
    title: book.title,
    subtitle: `${book.author} · ${book.category}`,
    href: `/shop/${book.slug}`,
    group: "Publications",
    icon: BookOpen,
  })),
  ...articles.map((article) => ({
    id: article.id,
    title: article.title,
    subtitle: `${article.category} · ${article.author ?? "VGMF"}`,
    href: `/articles/${article.slug}`,
    group: "Articles",
    icon: Newspaper,
  })),
  ...clinics.map((clinic) => ({
    id: clinic.id,
    title: clinic.name,
    subtitle: `${clinic.city} · ${clinic.specialization}`,
    href: `/clinics/${clinic.slug}`,
    group: "Clinics",
    icon: Stethoscope,
  })),
  ...videos.map((video) => ({
    id: video.id,
    title: video.title,
    subtitle: video.category,
    href: "/videos",
    group: "Videos",
    icon: PlayCircle,
  })),
];

const suggestions = ["Seminar", "Panchakarma", "Fellowship", "Research", "Pune"];

export default function SearchDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return index.filter((item) => item.group === "Pages").slice(0, 6);
    return index
      .filter((item) =>
        `${item.title} ${item.subtitle} ${item.group}`.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 30);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const go = (item: SearchItem | undefined) => {
    if (!item) return;
    onClose();
    setQuery("");
    router.push(item.href);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") onClose();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((value) => Math.min(value + 1, results.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((value) => Math.max(value - 1, 0));
    }
    if (event.key === "Enter") {
      event.preventDefault();
      go(results[active]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-navy/60 p-4 pt-[10vh] backdrop-blur-sm animate-[fade-up_0.25s_ease_both]"
      role="dialog"
      aria-modal="true"
      aria-label="Search the site"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-5">
          <Search size={20} className="text-burgundy" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search events, publications, articles, clinics…"
            className="h-16 flex-1 bg-transparent text-base text-text-primary outline-none placeholder:text-text-muted"
            aria-label="Search"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-warm-cream hover:text-text-primary"
          >
            <X size={18} />
          </button>
        </div>

        {!query && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Try
            </span>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setQuery(suggestion);
                  inputRef.current?.focus();
                }}
                className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-primary transition hover:border-burgundy hover:text-burgundy"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <ul className="max-h-[55vh] overflow-y-auto p-2" role="listbox">
          {results.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-text-muted">
              No results for “{query}”.
            </li>
          ) : (
            results.map((item, position) => {
              const Icon = item.icon;
              return (
                <li key={item.id} role="option" aria-selected={position === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(position)}
                    onClick={() => go(item)}
                    className={classNames(
                      "flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left transition",
                      position === active ? "bg-burgundy/5" : "hover:bg-warm-cream"
                    )}
                  >
                    <span className="icon-tile h-10 w-10">
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-text-primary">
                        {item.title}
                      </span>
                      <span className="block truncate text-xs text-text-muted">
                        {item.subtitle}
                      </span>
                    </span>
                    <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted sm:block">
                      {item.group}
                    </span>
                    <ArrowRight
                      size={16}
                      className={classNames(
                        "text-burgundy transition",
                        position === active ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className="flex items-center justify-between border-t border-border bg-warm-cream px-5 py-2.5 text-[11px] text-text-muted">
          <span className="flex items-center gap-1.5">
            <CornerDownLeft size={12} /> to open · ↑↓ to navigate · Esc to close
          </span>
          <span>{index.length} items indexed</span>
        </div>
      </div>
    </div>
  );
}
