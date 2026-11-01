/** EAN-13 bar patterns. First digit picks the left-side L/G mix. */
const LEFT_L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const LEFT_G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const RIGHT_R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

export function ean13CheckDigit(digits12: string) {
  const digits = digits12.replace(/\D/g, "").padStart(12, "0").slice(0, 12);
  const sum = digits.split("").reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
  return String((10 - (sum % 10)) % 10);
}

export function normalizeEan13(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 13) return digits;
  if (digits.length === 12) return digits + ean13CheckDigit(digits);
  return digits;
}

export function barcodeSvg(code: string, options?: { height?: number; module?: number }) {
  const value = normalizeEan13(code) || "0000000000000";
  const height = options?.height ?? 56;
  const module = options?.module ?? 1.6;
  if (value.length === 13) return ean13Svg(value, height, module);
  return genericBarsSvg(value, height, module);
}

function ean13Svg(value: string, height: number, module: number) {
  const first = Number(value[0]);
  const parity = PARITY[first] ?? PARITY[0];
  let bits = "101";
  for (let i = 0; i < 6; i++) {
    const digit = Number(value[i + 1]);
    bits += (parity[i] === "G" ? LEFT_G : LEFT_L)[digit];
  }
  bits += "01010";
  for (let i = 7; i < 13; i++) bits += RIGHT_R[Number(value[i])];
  bits += "101";
  return renderBars(bits, value, height, module, true);
}

function genericBarsSvg(value: string, height: number, module: number) {
  const bits = `101${value
    .split("")
    .map((char, index) => {
      const n = Number.isFinite(Number(char)) ? Number(char) : char.charCodeAt(0) % 10;
      return (index % 2 ? LEFT_G : LEFT_L)[n];
    })
    .join("")}101`;
  return renderBars(bits, value, height, module, false);
}

function renderBars(bits: string, label: string, height: number, module: number, guard: boolean) {
  const width = Math.max(1, bits.length) * module;
  const barHeight = height - 16;
  const bars: string[] = [];
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== "1") continue;
    const tall = guard && (i < 3 || (i >= 45 && i < 50) || i >= bits.length - 3);
    bars.push(`<rect x="${(i * module).toFixed(2)}" y="0" width="${module.toFixed(2)}" height="${tall ? height - 8 : barHeight}" fill="#1b1410"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width + 8}" height="${height}" viewBox="0 0 ${width + 8} ${height}" role="img" aria-label="${label}">
    <g transform="translate(4 0)">${bars.join("")}</g>
    <text x="${(width + 8) / 2}" y="${height - 2}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" fill="#1b1410">${label}</text>
  </svg>`;
}

export function matchesBarcode(book: { productCode?: string; sku?: string; barcode?: string; isbn?: string; id?: string }, scanned: string) {
  const value = scanned.trim().toLowerCase().replace(/[\s-]/g, "");
  if (!value) return false;
  return [book.productCode, book.sku, book.barcode, book.isbn, book.id]
    .filter(Boolean)
    .some((item) => String(item).toLowerCase().replace(/[\s-]/g, "") === value);
}

export function printBarcodeSheet(rows: { title: string; sku?: string; barcode: string }[]) {
  if (typeof window === "undefined") return;
  const win = window.open("", "_blank");
  if (!win) return;
  const cards = rows
    .map(
      (row) => `<article class="card">
        <p class="title">${escapeHtml(row.title)}</p>
        <p class="sku">${escapeHtml(row.sku || "")}</p>
        <div class="bars">${barcodeSvg(row.barcode, { height: 64, module: 1.8 })}</div>
      </article>`
    )
    .join("");
  win.document.write(`<!doctype html><html><head><title>Product barcodes</title>
    <style>
      body{font-family:Georgia,serif;color:#1b1410;margin:24px;background:#fffdf8}
      h1{font-size:18px;margin:0 0 16px}
      .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
      .card{border:1px solid #d8c8b4;border-radius:10px;padding:12px;text-align:center}
      .title{font-size:13px;font-weight:700;margin:0}
      .sku{font-size:11px;color:#6b5b4f;margin:4px 0 8px}
      .bars svg{max-width:100%;height:auto}
    </style></head><body>
    <h1>Vaidya Gogate Memorial Foundation · Inventory barcodes</h1>
    <div class="grid">${cards}</div>
    </body></html>`);
  win.document.close();
  win.print();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}
