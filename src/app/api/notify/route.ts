import { NextRequest, NextResponse } from "next/server";
import {
  listMetaTemplates,
  sendAiSensy,
  sendMetaTemplate,
  sendZeptoMail,
  sendZohoCpaas,
  sendZohoMail,
} from "@/lib/server/providers";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function toHtml(text: string) {
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#1f2a24">${escapeHtml(text).replace(/\n/g, "<br/>")}</div>`;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const creds = (body.creds as Record<string, unknown>) ?? {};
  try {
    if (body.action === "templates") {
      return NextResponse.json({ ok: true, templates: await listMetaTemplates(creds) });
    }

    if (body.channel === "email") {
      const mail = { to: String(body.to ?? ""), subject: String(body.subject ?? ""), html: toHtml(String(body.body ?? "")) };
      if (!/^\S+@\S+\.\S+$/.test(mail.to)) return NextResponse.json({ ok: false, configured: true, error: "Recipient email is not valid." });
      const sent = body.provider === "zoho" ? await sendZohoMail(creds, mail) : await sendZeptoMail(creds, mail);
      if (!sent) return NextResponse.json({ ok: false, configured: false, error: `${body.provider === "zoho" ? "Zoho Mail" : "ZeptoMail"} credentials are not configured.` });
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
