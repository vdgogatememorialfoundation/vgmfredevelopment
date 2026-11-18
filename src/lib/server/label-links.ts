import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureDataDir } from "@/lib/server/paths";

const TOKEN = /^[a-f0-9]{32}$/;
const MAX_BYTES = 8 * 1024 * 1024;

function dir() {
  return ensureDataDir("labels");
}

/** Stores a label PDF under a random token; the link is the only way to fetch it. */
export function saveLabelPdf(bytes: Uint8Array, name: string) {
  if (bytes.length === 0 || bytes.length > MAX_BYTES) throw new Error("The label file is empty or too large.");
  if (Buffer.from(bytes.subarray(0, 4)).toString("latin1") !== "%PDF") throw new Error("Only PDF labels can be saved.");
  const token = randomBytes(16).toString("hex");
  const safeName = (name.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "label.pdf").slice(0, 80);
  writeFileSync(join(/* turbopackIgnore: true */ dir(), `${token}.pdf`), bytes);
  writeFileSync(join(/* turbopackIgnore: true */ dir(), `${token}.json`), JSON.stringify({ name: safeName.endsWith(".pdf") ? safeName : `${safeName}.pdf`, at: new Date().toISOString() }));
  return token;
}

export function readLabelPdf(token: string) {
  if (!TOKEN.test(token)) return null;
  const file = join(/* turbopackIgnore: true */ dir(), `${token}.pdf`);
  if (!existsSync(file)) return null;
  let name = "label.pdf";
  try {
    name = (JSON.parse(readFileSync(join(/* turbopackIgnore: true */ dir(), `${token}.json`), "utf8")) as { name?: string }).name || name;
  } catch {
    /* name is optional */
  }
  return { bytes: readFileSync(file), name };
}
