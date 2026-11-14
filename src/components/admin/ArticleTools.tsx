"use client";

import { useRef, useState, type RefObject } from "react";
import { getAccounts, displayName } from "@/lib/admin-store";
import { hideArticle, saveArticle, slugify } from "@/lib/cms";
import { queueNotification } from "@/lib/notify";
import { articlePublicUrl } from "@/lib/article-display";
import { ARTICLE_FONTS } from "@/components/articles/ArticleRichText";
import type { Article, ArticleStatus, ArticleStyle, User } from "@/types";

export const FOUNDATION_NAME = "Vaidya Gogate Memorial Foundation";

const field = "rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm";
const tool = "rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-burgundy hover:text-burgundy";

export function isFoundationPublisher(user?: Pick<User, "role"> | null) {
  return !user || user.role !== "staff";
}

export function publisherName(user?: (Pick<User, "role"> & Parameters<typeof displayName>[0]) | null) {
  if (isFoundationPublisher(user)) return FOUNDATION_NAME;
  return displayName(user!) || FOUNDATION_NAME;
}

export function PublisherLine({ user }: { user?: (Pick<User, "role"> & Parameters<typeof displayName>[0]) | null }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
      {isFoundationPublisher(user) ? (
        <>Published by <span className="font-semibold text-burgundy">{FOUNDATION_NAME}</span></>
      ) : (
        <>By <span className="font-semibold text-burgundy">{publisherName(user)}</span></>
      )}
    </div>
  );
}

type Edit = { before: string; after: string; placeholder?: string; line?: boolean; block?: boolean };

/** Formatting buttons for a plain-text article body (rendered by ArticleRichText). */
export function RichTextToolbar({
  target,
  value,
  onChange,
  imageCount = 0,
}: {
  target: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  imageCount?: number;
}) {
  const apply = ({ before, after, placeholder = "text", line, block }: Edit) => {
    const area = target.current;
    const start = area?.selectionStart ?? value.length;
    const end = area?.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || placeholder;
    let inserted: string;
    if (line) {
      inserted = selected.split("\n").map((row, index) => `${before.replace("#", String(index + 1))}${row}`).join("\n");
    } else {
      inserted = `${before}${selected}${after}`;
    }
    if (block) {
      const lead = start > 0 && !value.slice(0, start).endsWith("\n\n") ? (value.slice(0, start).endsWith("\n") ? "\n" : "\n\n") : "";
      inserted = `${lead}${inserted}\n\n`;
    }
    const next = value.slice(0, start) + inserted + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      area?.focus();
      const caret = start + inserted.length;
      area?.setSelectionRange(caret, caret);
    });
  };
  const ask = (label: string) => (window.prompt(label) ?? "").trim();

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <button type="button" className={`${tool} font-bold`} title="Bold" onClick={() => apply({ before: "**", after: "**" })}>B</button>
      <button type="button" className={`${tool} italic`} title="Italic" onClick={() => apply({ before: "*", after: "*" })}>I</button>
      <button type="button" className={`${tool} underline`} title="Underline" onClick={() => apply({ before: "__", after: "__" })}>U</button>
      <button type="button" className={`${tool} line-through`} title="Strikethrough" onClick={() => apply({ before: "~~", after: "~~" })}>S</button>
      <button type="button" className={tool} title="Highlight" onClick={() => apply({ before: "==", after: "==" })}>Highlight</button>
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <button type="button" className={tool} onClick={() => apply({ before: "## ", after: "", placeholder: "Heading", block: true })}>H2</button>
      <button type="button" className={tool} onClick={() => apply({ before: "### ", after: "", placeholder: "Sub-heading", block: true })}>H3</button>
      <button type="button" className={tool} onClick={() => apply({ before: "", after: "", placeholder: "New paragraph", block: true })}>¶ Paragraph</button>
      <button type="button" className={tool} onClick={() => apply({ before: "- ", after: "", placeholder: "Point", line: true, block: true })}>• Points</button>
      <button type="button" className={tool} onClick={() => apply({ before: "#. ", after: "", placeholder: "Step", line: true, block: true })}>1. Numbered</button>
      <button type="button" className={tool} onClick={() => apply({ before: "> ", after: "", placeholder: "Quote", line: true, block: true })}>❝ Quote</button>
      <button type="button" className={tool} onClick={() => apply({ before: "---", after: "", placeholder: "", block: true })}>Divider</button>
      <span className="mx-1 h-5 w-px bg-slate-200" />
      {(["left", "center", "right", "justify"] as const).map((align) => (
        <button key={align} type="button" className={tool} title={`Align ${align}`} onClick={() => apply({ before: `|${align}| `, after: "", placeholder: "Paragraph", block: true })}>
          {align === "left" ? "⟸" : align === "center" ? "≡" : align === "right" ? "⟹" : "☰"}
        </button>
      ))}
      <span className="mx-1 h-5 w-px bg-slate-200" />
      {[",", ";", ":", "—", "“ ”", "…"].map((mark) => (
        <button key={mark} type="button" className={tool} title="Insert punctuation" onClick={() => apply({ before: mark === "“ ”" ? "“" : mark, after: mark === "“ ”" ? "”" : "", placeholder: mark === "“ ”" ? "quote" : "" })}>
          {mark}
        </button>
      ))}
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <button
        type="button"
        className={tool}
        onClick={() => {
          const url = ask("Link address (https://…)");
          if (url) apply({ before: "[", after: `](${url})`, placeholder: "link text" });
        }}
      >
        Link
      </button>
      <button
        type="button"
        className={tool}
        onClick={() => {
          const url = ask("YouTube, Vimeo or video file link");
          if (url) apply({ before: `[[video:${url}]]`, after: "", placeholder: "", block: true });
        }}
      >
        ▶ Video
      </button>
      <button
        type="button"
        className={tool}
        onClick={() => {
          const url = ask("Reference image link (https://…)");
          if (!url) return;
          const caption = ask("Caption (optional)");
          apply({ before: `[[image-url:${url}${caption ? `|${caption}` : ""}]]`, after: "", placeholder: "", block: true });
        }}
      >
        Reference image
      </button>
      {imageCount > 0 && (
        <select
          className={field}
          value=""
          onChange={(event) => {
            if (event.target.value) apply({ before: `[[image:${event.target.value}]]`, after: "", placeholder: "", block: true });
          }}
        >
          <option value="">Place gallery image here…</option>
          {Array.from({ length: imageCount }, (_, index) => (
            <option key={index} value={index + 1}>Image {index + 1}</option>
          ))}
        </select>
      )}
    </div>
  );
}

export function ArticleStyleControls({ value, onChange }: { value: ArticleStyle; onChange: (next: ArticleStyle) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      <label className="text-xs font-semibold text-slate-500">
        Font
        <select className={`${field} mt-1 w-full`} value={value.font ?? ""} onChange={(event) => onChange({ ...value, font: (event.target.value || undefined) as ArticleStyle["font"] })}>
          <option value="">Site default</option>
          {ARTICLE_FONTS.map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-500">
        Text size
        <select className={`${field} mt-1 w-full`} value={value.size ?? "md"} onChange={(event) => onChange({ ...value, size: event.target.value as ArticleStyle["size"] })}>
          <option value="sm">Small</option>
          <option value="md">Normal</option>
          <option value="lg">Large</option>
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-500">
        Line spacing
        <select className={`${field} mt-1 w-full`} value={value.spacing ?? "normal"} onChange={(event) => onChange({ ...value, spacing: event.target.value as ArticleStyle["spacing"] })}>
          <option value="tight">Compact</option>
          <option value="normal">Normal</option>
          <option value="relaxed">Airy</option>
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-500">
        Paragraph alignment
        <select className={`${field} mt-1 w-full`} value={value.align ?? "left"} onChange={(event) => onChange({ ...value, align: event.target.value as ArticleStyle["align"] })}>
          <option value="left">Left</option>
          <option value="justify">Justified</option>
          <option value="center">Centred</option>
        </select>
      </label>
    </div>
  );
}

function origin() {
  return typeof window === "undefined" ? "https://vaidyagogate.org" : window.location.origin;
}

/** Emails readers (optional) and the writer when an article goes live. */
export function notifyArticlePublished(article: Article, options: { readers: boolean; writer: boolean }) {
  const url = articlePublicUrl(article).startsWith("http") ? articlePublicUrl(article) : `${origin()}${articlePublicUrl(article)}`;
  const body = `${article.title}\n\n${article.excerpt}\n\nRead it here: ${url}\n\n${FOUNDATION_NAME}`;
  let sent = 0;
  const writer = article.publishedByEmail || article.assignedTo;
  if (options.writer && writer) {
    queueNotification({ to: writer, subject: `Your article is live: ${article.title}`, template: "article-published-writer", body });
    sent += 1;
  }
  if (options.readers) {
    const seen = new Set<string>(writer ? [writer.toLowerCase()] : []);
    for (const account of getAccounts()) {
      const email = account.email?.trim().toLowerCase();
      if (!email || seen.has(email) || account.role !== "customer") continue;
      seen.add(email);
      queueNotification({
        to: account.email,
        name: displayName(account),
        subject: `New article: ${article.title}`,
        template: "article-published",
        body: `Namaste ${displayName(account) || ""},\n\n${body}`,
      });
      sent += 1;
    }
  }
  return sent;
}

export function notifyArticleReturned(article: Article, note: string) {
  const writer = article.publishedByEmail || article.assignedTo;
  if (!writer) return;
  queueNotification({
    to: writer,
    subject: `Changes requested: ${article.title}`,
    template: "article-returned",
    body: `Your article “${article.title}” was returned for changes.${note ? `\n\nNote: ${note}` : ""}\n\n${FOUNDATION_NAME}`,
  });
}

export function exportArticles(articles: Article[], name = "articles") {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), articles }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${name}-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head = [], ...body] = rows.filter((item) => item.some((value) => value.trim()));
  return body.map((values) => Object.fromEntries(head.map((key, index) => [key.trim().toLowerCase(), values[index] ?? ""])));
}

/** Reads a JSON export or a CSV (title, excerpt, content, category, tags, coverImage, status). */
export async function readArticleFile(file: File, user: { email?: string; role?: User["role"] } & Parameters<typeof displayName>[0]): Promise<Article[]> {
  const text = await file.text();
  const raw: Partial<Article>[] = file.name.toLowerCase().endsWith(".csv")
    ? parseCsv(text).map((row) => ({ ...row, tags: String(row.tags ?? "").split(/[;,|]/).map((tag) => tag.trim()).filter(Boolean) }) as Partial<Article>)
    : (() => {
        const parsed = JSON.parse(text) as { articles?: Partial<Article>[] } | Partial<Article>[];
        return Array.isArray(parsed) ? parsed : parsed.articles ?? [];
      })();
  const staff = user.role === "staff";
  return raw
    .filter((item) => item.title?.trim() && item.content?.trim())
    .map((item, index) => {
      const status = (staff ? "pending" : (item.status as ArticleStatus) || "draft") as ArticleStatus;
      return {
        ...item,
        id: item.id?.trim() || `art-${Date.now()}-${index}`,
        title: item.title!.trim(),
        slug: item.slug?.trim() || slugify(item.title!),
        excerpt: item.excerpt?.trim() || item.content!.trim().slice(0, 160),
        content: item.content!.trim(),
        category: item.category?.trim() || "Ayurveda",
        date: item.date || new Date().toISOString().slice(0, 10),
        status,
        author: staff ? publisherName(user as User) : item.author || FOUNDATION_NAME,
        publishedByEmail: staff ? user.email : item.publishedByEmail || user.email,
      } as Article;
    });
}

export type BulkAction = "publish" | "draft" | "pending" | "return" | "feature" | "unfeature" | "delete" | "export";

export function runBulkAction(action: BulkAction, articles: Article[], options: { emailReaders?: boolean } = {}) {
  if (action === "export") return exportArticles(articles, "selected-articles");
  for (const article of articles) {
    if (action === "delete") hideArticle(article.id);
    else if (action === "feature" || action === "unfeature") saveArticle({ ...article, featured: action === "feature" });
    else if (action === "return") {
      saveArticle({ ...article, status: "rejected" });
      notifyArticleReturned(article, "");
    } else {
      const status: ArticleStatus = action === "publish" ? "published" : action;
      saveArticle({ ...article, status, reviewNote: status === "published" ? undefined : article.reviewNote });
      if (status === "published" && article.status !== "published") notifyArticlePublished({ ...article, status }, { readers: Boolean(options.emailReaders), writer: true });
    }
  }
}

export function ArticleImportButton({ user, onDone }: { user: Parameters<typeof readArticleFile>[1]; onDone: (message: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".json,.csv,application/json,text/csv"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            const items = await readArticleFile(file, user);
            items.forEach((article) => saveArticle(article));
            onDone(items.length ? `Imported ${items.length} article${items.length === 1 ? "" : "s"}.` : "No articles with a title and text were found in that file.");
          } catch {
            onDone("That file could not be read. Use a JSON export or a CSV with title and content columns.");
          } finally {
            setBusy(false);
          }
        }}
      />
      <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => input.current?.click()} disabled={busy}>
        {busy ? "Importing…" : "Import"}
      </button>
    </>
  );
}

export { origin as siteOrigin };
