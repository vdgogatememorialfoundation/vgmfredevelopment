import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { commerceViewer } from "@/lib/server/commerce-viewer";
import { dataFile } from "@/lib/server/paths";
import { listPortalApprovers } from "@/lib/server/portal-accounts";
import { sendMobileEmail } from "@/lib/server/mobile-mail";
import { sendWhatsAppAlert } from "@/lib/server/whatsapp-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One OTP authorizes cancelling one set of orders (a single order or a bulk selection). */
type Pending = { hash: string; salt: string; orderIds: string[]; by: string; expires: number; attempts: number };

const FILE = () => dataFile("cancel-otp.json");
const TTL_MS = 10 * 60 * 1000;
const MAIN_ADMIN = "vd.gogatememorialfoundation@gmail.com";

function read(): Record<string, Pending> {
  try {
    return JSON.parse(readFileSync(FILE(), "utf8")) as Record<string, Pending>;
  } catch {
    return {};
  }
}

function write(all: Record<string, Pending>) {
  const now = Date.now();
  for (const [id, row] of Object.entries(all)) if (row.expires < now) delete all[id];
  mkdirSync(dirname(FILE()), { recursive: true });
  writeFileSync(FILE(), JSON.stringify(all, null, 2));
}

const hash = (code: string, salt: string) => createHash("sha256").update(`${salt}:${code}`).digest("hex");
const cleanIds = (value: unknown) => Array.from(new Set((Array.isArray(value) ? value : []).map((v) => String(v).trim()).filter(Boolean))).sort();

export async function POST(request: NextRequest) {
  const viewer = commerceViewer(request);
  if (!viewer.portal) return NextResponse.json({ ok: false, error: "Sign in to the Admin portal first." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { action?: string; orderIds?: unknown; requestId?: string; code?: string };
  const orderIds = cleanIds(body.orderIds);
  if (!orderIds.length) return NextResponse.json({ ok: false, error: "No orders selected." }, { status: 400 });
  const by = viewer.email || "Admin";

  if (body.action === "send") {
    const approvers = listPortalApprovers();
    if (!approvers.some((a) => a.email === MAIN_ADMIN)) approvers.unshift({ email: MAIN_ADMIN, phone: "", name: "Admin" });
    const code = String(randomInt(100000, 1000000));
    const salt = randomBytes(8).toString("hex");
    const requestId = randomBytes(9).toString("base64url");
    const all = read();
    all[requestId] = { hash: hash(code, salt), salt, orderIds, by, expires: Date.now() + TTL_MS, attempts: 0 };
    write(all);
    const what = orderIds.length === 1 ? `order ${orderIds[0]}` : `${orderIds.length} orders (${orderIds.slice(0, 10).join(", ")}${orderIds.length > 10 ? ", …" : ""})`;
    const results = await Promise.all(
      approvers.map(async (a) => {
        const mailed = await sendMobileEmail(
          a.email,
          `${code} is the OTP to cancel ${what}`,
          `${by} wants to cancel ${what} from the Admin portal.\n\nCancellation OTP: ${code}\n\nIt is valid for 10 minutes and works only for ${orderIds.length === 1 ? "this order" : "these orders"}. Share it only if you approve this cancellation.\n\nVaidya Gogate Memorial Foundation`
        ).catch(() => false);
        if (a.phone) await sendWhatsAppAlert("otp", { phone: a.phone, name: a.name, params: [code] }).catch(() => false);
        return Boolean(mailed);
      })
    );
    const sent = results.filter(Boolean).length;
    if (!sent) return NextResponse.json({ ok: false, error: "Could not send the cancellation OTP. Try again." }, { status: 502 });
    return NextResponse.json({ ok: true, requestId, message: `A cancellation OTP was sent to ${sent} Admin / Co-admin account${sent === 1 ? "" : "s"}.` });
  }

  if (body.action === "verify") {
    const all = read();
    const row = all[String(body.requestId || "")];
    if (!row || row.expires < Date.now()) return NextResponse.json({ ok: false, error: "The OTP has expired. Start the cancellation again." }, { status: 400 });
    if (row.orderIds.join(",") !== orderIds.join(",")) return NextResponse.json({ ok: false, error: "This OTP was issued for different orders." }, { status: 400 });
    if (row.attempts >= 5) return NextResponse.json({ ok: false, error: "Too many wrong OTPs. Start the cancellation again." }, { status: 429 });
    const expected = Buffer.from(row.hash, "hex");
    const got = Buffer.from(hash(String(body.code || "").replace(/\D/g, ""), row.salt), "hex");
    if (!timingSafeEqual(expected, got)) {
      row.attempts += 1;
      write(all);
      return NextResponse.json({ ok: false, error: "Incorrect OTP." }, { status: 400 });
    }
    delete all[String(body.requestId)];
    write(all);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
