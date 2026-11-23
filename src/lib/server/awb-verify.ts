import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function norm(value: string) {
  return String(value || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/**
 * Automatically reads barcodes (zbarimg) + printed text (tesseract OCR) from a captured AWB label photo
 * and strictly verifies whether it matches the courier-allotted AWB number.
 */
export async function verifyAwbLabelImage(bytes: Buffer, ext: string, expectedAwb: string, expectedOrderId = "") {
  const dir = mkdtempSync(join(tmpdir(), "vgmf-awb-"));
  const filePath = join(dir, `label${ext || ".jpg"}`);
  try {
    writeFileSync(filePath, bytes);
    const expectedKey = norm(expectedAwb);
    const orderKey = norm(expectedOrderId);
    const barcodes: string[] = [];
    let ocrText = "";

    // 1. Decode all 1D/2D barcodes & QR codes from the label photo using zbarimg
    try {
      const { stdout } = await execFileAsync("zbarimg", ["--quiet", "--raw", filePath], { timeout: 10000 });
      for (const line of stdout.split(/\r?\n/)) {
        const clean = line.trim();
        if (clean) barcodes.push(clean);
      }
    } catch {
      /* no barcode decoded or non-zero exit when 0 barcodes found */
    }

    // 2. Run OCR (Tesseract) on the label photo to read printed AWB, courier, and order text
    try {
      const { stdout } = await execFileAsync("tesseract", [filePath, "stdout", "--psm", "6"], { timeout: 15000 });
      ocrText = stdout || "";
    } catch {
      /* fallback to default psm */
      try {
        const { stdout } = await execFileAsync("tesseract", [filePath, "stdout"], { timeout: 15000 });
        ocrText = stdout || "";
      } catch {
        ocrText = "";
      }
    }

    const barcodeMatched = Boolean(expectedKey) && barcodes.some((b) => {
      const bk = norm(b);
      return bk === expectedKey || bk.includes(expectedKey) || (bk.length >= 8 && expectedKey.includes(bk));
    });

    const ocrNorm = norm(ocrText);
    // Allow common OCR digit/letter confusions (O/0, I/1/l, S/5) only when comparing against the exact allotted AWB
    const fuzzy = (s: string) => s.replace(/O/g, "0").replace(/[IL]/g, "1");
    const ocrMatched =
      Boolean(expectedKey) &&
      (ocrNorm.includes(expectedKey) || fuzzy(ocrNorm).includes(fuzzy(expectedKey)));

    const orderIdMatched = Boolean(orderKey) && (
      barcodes.some((b) => norm(b).includes(orderKey)) || ocrNorm.includes(orderKey)
    );

    const matched = barcodeMatched || ocrMatched;
    const method = barcodeMatched ? "Barcode" : ocrMatched ? "OCR Text" : "None";
    const snippet = ocrText.replace(/\s+/g, " ").trim().slice(0, 180);

    return {
      matched,
      method,
      barcodeMatched,
      ocrMatched,
      orderIdMatched,
      barcodes: barcodes.slice(0, 6),
      snippet,
    };
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore cleanup error */
    }
  }
}
