import { NextRequest, NextResponse } from "next/server";
import { readKv, writeKv } from "@/lib/server/db";
import {
  listMetaTemplates,
  sendAiSensy,
  sendMetaTemplate,
  sendMsg91Sms,
  sendTransactionalEmail,
  sendZohoCpaas,
} from "@/lib/server/providers";
import { applyFoundationBrand, wrapFoundationEmail } from "@/lib/email-layout";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function imageHtml(images: unknown) {
  if (!Array.isArray(images)) return "";
  return images
    .filter((src): src is string => typeof src === "string" && /^(https?:|data:image)/i.test(src))
    .slice(0, 6)
    .map(
      (src) =>
        `<p><img src="${src.replace(/"/g, "")}" alt="" style="max-width:100%;height:auto;border-radius:8px;margin:12px 0" /></p>`
    )
    .join("");
}

function toHtml(text: string, html?: boolean, images?: unknown) {
  const branded = applyFoundationBrand(text);
  const body = html || /<(img|p|br|div|strong|em|a)\b/i.test(branded) ? branded : escapeHtml(branded).replace(/\n/g, "<br/>");
  return wrapFoundationEmail(`${body}${imageHtml(images)}`);
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function mergeCreds(stored: Record<string, unknown>, incoming: Record<string, unknown>) {
  const next = { ...stored };
  for (const [key, value] of Object.entries(incoming)) {
    if (typeof value === "string") {
      if (value.trim()) next[key] = value.trim();
      continue;
    }
    if (value && typeof value === "object") next[key] = value;
  }
  return next;
}

async function storedNotify() {
  return (await readKv<Record<string, unknown>>("admin", "notify-creds")) ?? {};
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const stored = await storedNotify();
  const storedMail = asRecord((await readKv<Record<string, unknown>>("admin", "email-creds")) ?? stored.email);
  const incoming = asRecord(body.creds);
  const creds = mergeCreds(mergeCreds(storedMail, asRecord(stored.email)), incoming);

  try {
    if (body.action === "save-creds") {
      const next = {
        email: mergeCreds(asRecord(stored.email), asRecord(body.email)),
        whatsapp: mergeCreds(asRecord(stored.whatsapp), asRecord(body.whatsapp)),
        sms: mergeCreds(asRecord(stored.sms), asRecord(body.sms)),
        messages: { ...asRecord(stored.messages), ...asRecord(body.messages) },
      };
      await writeKv("admin", "notify-creds", next);
      await writeKv("admin", "email-creds", next.email);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "templates") {
      return NextResponse.json({ ok: true, templates: await listMetaTemplates(creds) });
    }

    if (body.channel === "email") {
      const mail = {
        to: String(body.to ?? ""),
        subject: String(body.subject ?? ""),
        html: toHtml(String(body.body ?? ""), body.html === true, body.images),
        replyTo: typeof body.replyTo === "string" && body.replyTo.includes("@") ? String(body.replyTo) : undefined,
      };
      if (!/^\S+@\S+\.\S+$/.test(mail.to)) return NextResponse.json({ ok: false, configured: true, error: "Recipient email is not valid." });
      const sent = await sendTransactionalEmail(
        {
          ...creds,
          provider: String(body.provider || creds.provider || "cpaas"),
        },
        mail
      );
      if (!sent) {
        return NextResponse.json({
          ok: false,
          configured: false,
          error: "Email is not configured. Save the Zoho CPaaS / ZeptoMail token under Settings → Email.",
        });
      }
      return NextResponse.json({ ok: true, configured: true, ...sent });
    }

    if (body.channel === "sms") {
      const smsCreds = mergeCreds(asRecord(stored.sms), incoming);
      const to = String(body.to ?? "");
      if (to.replace(/\D/g, "").length < 10) return NextResponse.json({ ok: false, configured: true, error: "Recipient phone number is not valid." });
      const sent = await sendMsg91Sms(smsCreds, {
        to,
        body: String(body.body ?? ""),
        otp: typeof body.otp === "string" ? body.otp : undefined,
      });
      if (!sent) return NextResponse.json({ ok: false, configured: false, error: "MSG91 credentials are not configured." });
      return NextResponse.json({ ok: true, configured: true, ...sent });
    }

    if (body.channel === "whatsapp") {
      const waCreds = mergeCreds(asRecord(stored.whatsapp), incoming);
      const to = String(body.to ?? "");
      const params = Array.isArray(body.params) ? body.params.map(String) : [];
      if (to.replace(/\D/g, "").length < 10) return NextResponse.json({ ok: false, configured: true, error: "Recipient phone number is not valid." });
      const provider = String(body.provider || waCreds.provider || "");
      const sent =
        provider === "aisensy"
          ? await sendAiSensy(waCreds, { to, campaign: String(body.template ?? ""), name: String(body.name ?? ""), params })
          : provider === "zoho"
            ? await sendZohoCpaas(waCreds, { to, template: String(body.template ?? ""), language: String(body.language ?? "en"), params })
            : await sendMetaTemplate(waCreds, { to, template: String(body.template ?? ""), language: String(body.language ?? "en"), params });
      if (!sent) return NextResponse.json({ ok: false, configured: false, error: "WhatsApp credentials are not configured." });
      return NextResponse.json({ ok: true, configured: true, ...sent });
    }

    return NextResponse.json({ ok: false, error: "Unknown channel." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, configured: true, error: (error as Error).message });
  }
}
