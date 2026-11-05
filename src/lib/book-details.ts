import type { Book } from "@/types";

export const AUDIENCE_TAGS = ["Practicing Vaidyas", "UG Students", "PG Students", "Researchers", "Faculty"];

export const DETAIL_SECTIONS: { key: keyof NonNullable<Book["details"]>; label: string }[] = [
  { key: "about", label: "About this book" },
  { key: "learn", label: "What you will learn" },
  { key: "highlights", label: "Key highlights" },
  { key: "whoShouldRead", label: "Who should read this book?" },
  { key: "chapters", label: "Chapters included" },
  { key: "outcomes", label: "Learning outcomes" },
  { key: "authorInfo", label: "Author information" },
  { key: "publisherInfo", label: "Publisher information" },
  { key: "editionInfo", label: "Edition and publication details" },
];

/** Valid ISBN-10 or ISBN-13 (checksum verified). Spaces and hyphens are ignored. */
export function isValidIsbn(raw?: string) {
  const code = (raw ?? "").replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{9}[\dX]$/.test(code)) {
    const sum = [...code].reduce((total, char, index) => total + (char === "X" ? 10 : Number(char)) * (10 - index), 0);
    return sum % 11 === 0;
  }
  if (/^97[89]\d{10}$/.test(code)) {
    const sum = [...code].reduce((total, char, index) => total + Number(char) * (index % 2 ? 3 : 1), 0);
    return sum % 10 === 0;
  }
  return false;
}

function formatDate(value?: string) {
  if (!value) return "";
  const when = new Date(`${value}T00:00:00`);
  return Number.isNaN(when.getTime()) ? value : when.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

/** The specification table shown on the product page, built from the book's own fields. */
export function bookSpecRows(book: Book) {
  const isbn = isValidIsbn(book.isbn) ? book.isbn : "";
  const rows: [string, string | undefined][] = [
    ["Book title", book.title],
    ["SKU", book.sku],
    ["ISBN", isbn],
    ["Product code", book.productCode],
    ["Author", book.author],
    ["Editor", book.editor],
    ["Publisher", book.publisher?.name],
    ["Publication date", formatDate(book.publicationDate) || (book.publishedYear ? String(book.publishedYear) : "")],
    ["Edition", book.edition],
    ["Language", book.language],
    ["Binding", book.binding],
    ["Pages", book.pages ? `${book.pages} pages` : ""],
    ["Dimensions", book.dimensions],
    ["Weight", book.weightKg ? `${Math.round(book.weightKg * 1000)} grams` : ""],
    ["Paper quality", book.paperQuality],
    ["Printing", book.printing],
    ["Country of origin", book.countryOfOrigin],
    ["Category", book.category],
    ["Subject", book.subject],
    ["Availability", book.stockStatus === "out_of_stock" || book.stock < 1 ? (book.preorder?.enabled ? "Available to pre-order" : "Out of stock") : "In stock"],
  ];
  return rows.filter((row): row is [string, string] => Boolean(row[1]?.toString().trim()));
}
