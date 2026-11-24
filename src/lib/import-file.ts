/** Reads a CSV file or an Excel 2003 XML (.xls) sheet saved from our templates into header-keyed rows. */
export async function readSheetFile(file: File): Promise<Record<string, string>[]> {
  const text = await file.text();
  if (text.startsWith("PK")) throw new Error("This is an .xlsx file. In Excel use File → Save As → CSV (or Excel 97-2003 .xls), then import that file.");
  const table = /<Workbook[\s>]/.test(text) ? parseSpreadsheetXml(text) : parseCsv(text.replace(/^\uFEFF/, ""));
  const [header = [], ...body] = table.filter((row) => row.some((cell) => cell.trim()));
  const keys = header.map((cell) => cell.trim());
  return body.map((row) => Object.fromEntries(keys.map((key, index) => [key, (row[index] ?? "").trim()])));
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function parseSpreadsheetXml(text: string): string[][] {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const rows = Array.from(doc.getElementsByTagNameNS("*", "Row"));
  return rows.map((row) => {
    const cells: string[] = [];
    for (const cell of Array.from(row.getElementsByTagNameNS("*", "Cell"))) {
      const at = Number(cell.getAttributeNS("urn:schemas-microsoft-com:office:spreadsheet", "Index") || cell.getAttribute("ss:Index") || 0);
      if (at > 0) while (cells.length < at - 1) cells.push("");
      cells.push(cell.getElementsByTagNameNS("*", "Data")[0]?.textContent ?? "");
    }
    return cells;
  });
}

/** Case- and spacing-insensitive lookup of a column in an imported row. */
export function col(row: Record<string, string>, ...names: string[]) {
  const wanted = names.map((name) => name.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const [key, value] of Object.entries(row)) {
    if (wanted.includes(key.toLowerCase().replace(/[^a-z0-9]/g, ""))) return value;
  }
  return "";
}
