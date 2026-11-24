import { NextRequest } from "next/server";
import { readMobileFeed } from "@/lib/server/mobile-feed";
import { isPublishedNow } from "@/lib/schedule";
import { siteConfig } from "@/lib/constants";
import { absoluteUrl, plainText } from "@/lib/seo";
import type { Book } from "@/types";

export const dynamic = "force-dynamic";

type Row = Record<string, string>;

const money = (value: number) => `${value.toFixed(2)} INR`;
const isbn13 = (value?: string) => {
  const digits = String(value ?? "").replace(/[^\dX]/gi, "");
  return /^\d{13}$/.test(digits) || /^\d{12}$/.test(digits) || /^\d{8}$/.test(digits) ? digits : "";
};

function offerLive(book: Book, now: number) {
  const offer = book.offer;
  if (!offer || !(offer.price > 0) || offer.price >= book.price) return null;
  if (offer.startsAt && Date.parse(offer.startsAt) > now) return null;
  if (offer.endsAt && Date.parse(offer.endsAt) < now) return null;
  return offer;
}

/** Google needs availability_date on every pre-order: the release date, else the usual pre-order lead time (10 days). */
function availableFrom(book: Book, now: number) {
  const release = book.preorder?.releaseDate ? Date.parse(`${book.preorder.releaseDate.slice(0, 10)}T00:00:00+05:30`) : NaN;
  const when = Number.isFinite(release) && release > now ? release : now + 10 * 24 * 60 * 60 * 1000;
  return new Date(when).toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

/** One product in Google Merchant / Meta catalogue attribute names. */
function row(book: Book, now: number): Row {
  const preorder = Boolean(book.preorder?.enabled);
  const inStock = book.stockStatus !== "out_of_stock" && (book.stock ?? 0) > 0;
  const gtin = isbn13(book.isbn) || isbn13(book.barcode);
  const offer = offerLive(book, now);
  const isBook = book.productType !== "other";
  const title = book.language && isBook ? `${book.title} (${book.language})` : book.title;
  return {
    id: book.sku || book.id,
    title: title.slice(0, 150),
    description: (plainText(book.description, 5000) || title).slice(0, 5000),
    link: absoluteUrl(`/shop/${book.slug}`),
    image_link: book.coverImage ? absoluteUrl(book.coverImage) : "",
    availability: preorder ? "preorder" : inStock ? "in_stock" : "out_of_stock",
    availability_date: preorder ? availableFrom(book, now) : "",
    price: money(book.originalPrice && book.originalPrice > book.price ? book.originalPrice : book.price),
    sale_price: offer ? money(offer.price) : book.originalPrice && book.originalPrice > book.price ? money(book.price) : "",
    sale_price_effective_date: offer?.startsAt && offer.endsAt ? `${new Date(offer.startsAt).toISOString()}/${new Date(offer.endsAt).toISOString()}` : "",
    condition: "new",
    brand: siteConfig.name,
    gtin,
    mpn: gtin ? "" : book.productCode || book.sku || book.id,
    identifier_exists: gtin ? "yes" : "no",
    google_product_category: isBook ? "784" : "",
    product_type: [isBook ? "Books" : "Products", book.category, book.language].filter(Boolean).join(" > "),
    custom_label_0: book.language ?? "",
    ships_from_country: "IN",
    min_handling_time: "1",
    max_handling_time: "3",
    custom_label_1: book.trending ? "Trending" : book.isNew ? "New" : book.ribbon ?? "",
  };
}

const COLUMNS = [
  "id", "title", "description", "link", "image_link", "availability", "availability_date", "price", "sale_price",
  "sale_price_effective_date", "condition", "brand", "gtin", "mpn", "identifier_exists", "google_product_category",
  "product_type", "ships_from_country", "min_handling_time", "max_handling_time", "custom_label_0", "custom_label_1",
];

const xmlEscape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const csvCell = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const tsvCell = (value: string) => value.replace(/[\t\r\n]+/g, " ");

/**
 * Live product feed for Google Merchant Center (scheduled fetch), Meta Commerce (Facebook / Instagram) and Google Sheets.
 * XML (RSS 2.0, g: namespace) by default; ?format=csv or ?format=tsv for sheets and catalogue uploads.
 */
export async function GET(request: NextRequest) {
  const format = (request.nextUrl.searchParams.get("format") ?? "xml").toLowerCase();
  const now = Date.now();
  const rows = (readMobileFeed().books ?? [])
    .filter((book) => book.active !== false && isPublishedNow(book) && book.slug && book.price > 0)
    .map((book) => row(book, now));
  const headers = { "cache-control": "public, max-age=900" };

  if (format === "csv" || format === "tsv") {
    const cell = format === "csv" ? csvCell : tsvCell;
    const sep = format === "csv" ? "," : "\t";
    const body = [COLUMNS.join(sep), ...rows.map((item) => COLUMNS.map((key) => cell(item[key] ?? "")).join(sep))].join("\n");
    return new Response(body, {
      headers: { ...headers, "content-type": `text/${format === "csv" ? "csv" : "tab-separated-values"}; charset=utf-8` },
    });
  }

  const items = rows
    .map(
      (item) =>
        `<item>${COLUMNS.filter((key) => item[key])
          .map((key) => (key === "title" || key === "link" || key === "description" ? `<${key}>${xmlEscape(item[key])}</${key}>` : `<g:${key}>${xmlEscape(item[key])}</g:${key}>`))
          .join("")}</item>`
    )
    .join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${xmlEscape(siteConfig.name)} products</title>
<link>${xmlEscape(absoluteUrl("/shop"))}</link>
<description>Live product catalogue</description>
${items}
</channel>
</rss>`;
  return new Response(body, { headers: { ...headers, "content-type": "application/xml; charset=utf-8" } });
}
