import { NextRequest, NextResponse } from "next/server";
import { readKv } from "@/lib/server/db";
import {
  listMetaTemplates,
  sendAiSensy,
  sendMetaTemplate,
  sendMsg91Sms,
  sendZeptoMail,
  sendZohoCpaas,
  sendZohoMail,
} from "@/lib/server/providers";

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
  const body = html || /<(img|p|br|div|strong|em|a)\b/i.test(text) ? text : escapeHtml(text).replace(/\n/g, "<br/>");
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#1f2a24">${body}${imageHtml(images)}</div>`;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const storedMail = (await readKv<Record<string, unknown>>("admin", "email-creds")) ?? {};
  const creds = { ...storedMail, ...((body.creds as Record<string, unknown>) ?? {}) };
  try {
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
      const provider = String(body.provider || creds.provider || "zeptomail");
      const sent = provider === "zoho" ? await sendZohoMail(creds, mail) : await sendZeptoMail(creds, mail);
      if (!sent) return NextResponse.json({ ok: false, configured: false, error: `${provider === "zoho" ? "Zoho Mail" : "ZeptoMail"} credentials are not configured.` });
      return NextResponse.json({ ok: true, configured: true, ...sent });
    }

    if (body.channel === "sms") {
      const to = String(body.to ?? "");
      if (to.replace(/\D/g, "").length < 10) return NextResponse.json({ ok: false, configured: true, error: "Recipient phone number is not valid." });
      const sent = await sendMsg91Sms(creds, {
        to,
        body: String(body.body ?? ""),
        otp: typeof body.otp === "string" ? body.otp : undefined,
      });
      if (!sent) return NextResponse.json({ ok: false, configured: false, error: "MSG91 credentials are not configured." });
      return NextResponse.json({ ok: true, configured: true, ...sent });
    }

    if (body.channel === "whatsapp") {
      const to = String(body.to ?? "");
      const params = Array.isArray(body.params) ? body.params.map(String) : [];
      if (to.replace(/\D/g, "").length < 10) return NextResponse.json({ ok: false, configured: true, error: "Recipient phone number is not valid." });
      const sent =
        body.provider === "aisensy"
          ? await sendAiSensy(creds, { to, campaign: String(body.template ?? ""), name: String(body.name ?? ""), params })
          : body.provider === "zoho"
            ? await sendZohoCpaas(creds, { to, template: String(body.template ?? ""), language: String(body.language ?? "en"), params })
            : await sendMetaTemplate(creds, { to, template: String(body.template ?? ""), language: String(body.language ?? "en"), params });
      if (!sent) return NextResponse.json({ ok: false, configured: false, error: "WhatsApp credentials are not configured." });
      return NextResponse.json({ ok: true, configured: true, ...sent });
    }

    return NextResponse.json({ ok: false, error: "Unknown channel." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, configured: true, error: (error as Error).message });
  }
}
