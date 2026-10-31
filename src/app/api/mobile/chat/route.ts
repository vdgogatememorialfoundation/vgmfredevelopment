import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, readMobileFeed } from "@/lib/server/mobile-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { ...corsHeaders, "cache-control": "no-store" } });
}

function answer(question: string) {
  const q = question.toLowerCase();
  const feed = readMobileFeed();
  const events = feed.events ?? [];
  const books = feed.books ?? [];
  const clinics = feed.clinics ?? [];
  if (/event|seminar|workshop|fellowship|programme|program/.test(q)) {
    if (!events.length) return "There are no upcoming seminars published right now. Open Events when a new programme is listed. Registration continues on seminar.vaidyagogate.org when a link is published.";
    const next = events[0] as { name?: string; venue?: string; startDate?: string };
    return `The next listed programme is “${next.name}”${next.startDate ? ` on ${String(next.startDate).slice(0, 10)}` : ""}${next.venue ? ` at ${next.venue}` : ""}. Open Events in the app for the full calendar.`;
  }
  if (/shop|book|publication|order|buy|checkout|razorpay/.test(q)) {
    if (!books.length) return "The Foundation shop sells publications. Titles appear after Admin publishes the catalogue. Add them to the bag and pay with Razorpay inside the app — UPI, cards, net banking and wallets.";
    return `Publications in the catalogue include ${books.slice(0, 3).map((item) => `“${String((item as { title?: string }).title)}”`).join(", ")}. Add them to the bag and check out with Razorpay in the app.`;
  }
  if (/clinic|opd|doctor|hospital/.test(q)) {
    if (!clinics.length) return "No clinics are in the published feed yet. Open Clinics once the Foundation publishes hours.";
    return `Foundation clinics: ${clinics.slice(0, 3).map((item) => `“${String((item as { name?: string }).name)}”`).join("; ")}.`;
  }
  if (/certificate|verify/.test(q)) return "Open Certificates in the app menu and enter your VGMF certificate number to verify workshop, fellowship or seminar credentials.";
  if (/account|login|sign ?in|sign ?up|otp|password/.test(q)) {
    return "Create one Foundation account from Sign up with your name, email and phone. We verify email with a 6-digit OTP and issue a 12-digit Account ID. Sign in uses the same email, phone or Account ID plus your Foundation password and email OTP — the same flow as the website.";
  }
  if (/ticket|support|help|chat/.test(q)) return "Open Chat or Support from the app menu. I can answer Foundation questions here, or you can raise a ticket. We reply by email.";
  if (/about|gogate|anagha|legacy|history|trustee/.test(q)) {
    return "Vaidya Gogate Memorial Foundation shares the work of Vd. Ramchandra Ballal Gogate (1933–2015) and Dr. Anagha Gogate (1936–2019). Open About for biographies, awards, books and research, history and trustees.";
  }
  if (/contact|email|phone|address|pune/.test(q)) {
    return `${feed.site?.address || "Vaidya Gogate Memorial Foundation, Pune"}. ${feed.site?.email || "info@vaidyagogate.org"} · ${feed.site?.phone || ""}`.trim();
  }
  return "I can help with events, shop and Razorpay checkout, tickets, sign-in, certificates, clinics and Foundation info. Ask another question, or open Support to talk to a person.";
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { message?: string } | null;
  const message = String(body?.message ?? "").trim().slice(0, 500);
  if (!message) return json({ ok: false, error: "Type a question." }, 400);
  return json({ ok: true, reply: answer(message) });
}
