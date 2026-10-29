"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getSettings, saveSettings } from "@/lib/admin-store";
import { getPolicy, savePolicy } from "@/lib/fulfillment";
import {
  getIntegrations,
  getOrderSettings,
  getShippingConnection,
  hasShippingCredentials,
  mask,
  notificationEvents,
  saveIntegrations,
  saveOrderSettings,
  type IntegrationSettings,
  type OrderSettings,
  type ShippingProviderId,
  type WhatsAppTemplate,
} from "@/lib/integrations";
import { ConnectionBadge } from "@/components/admin/AdminUI";
import { clearNotifications, deliver, eventLabel, getNotifications, markNotification, queueNotification, type NotificationRecord } from "@/lib/notify";
import { testPaytmEdc, testRazorpay } from "@/lib/payments-client";
import { applyShiprocketWebhooks, fetchCourierRates, listPickupLocations, syncPickupAddress, testConfiguredShippingProviders, testShippingProvider, type RateQuote } from "@/lib/shipping-client";
import { ImageField } from "@/components/admin/ImageField";
import { subscribeCms } from "@/lib/cms";
import type { SiteSettings } from "@/types";

const input = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";
const primary = "rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const ghost = "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50";

function Header({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">{text}</p>
      </div>
      {action}
    </div>
  );
}

function Card({ title, text, children, right, badge }: { title: string; text?: string; children: ReactNode; right?: ReactNode; badge?: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-slate-900">{title}</h2>
            {badge}
          </div>
          {text && <p className="mt-0.5 text-sm text-slate-500">{text}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Text({ label, value, onChange, type = "text", placeholder, hint }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; placeholder?: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <input className={input} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} autoComplete="off" />
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

function Secret({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
        {value && (
          <button type="button" className="normal-case tracking-normal text-burgundy" onClick={() => setShow((current) => !current)}>
            {show ? "Hide" : "Show"}
          </button>
        )}
      </span>
      <input className={input} type={show ? "text" : "password"} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" />
      {value && !show && <span className="mt-1 block font-mono text-[11px] text-slate-400">{mask(value)}</span>}
    </label>
  );
}

function Check({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (value: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-burgundy" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <span className="font-semibold text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

function Saved({ text }: { text: string }) {
  if (!text) return null;
  const bad = /fail|error|could not|refused|missing|not configured|invalid/i.test(text);
  return <p className={`text-sm ${bad ? "text-red-700" : "text-emerald-700"}`}>{text}</p>;
}

function useIntegrationSlice<K extends keyof IntegrationSettings>(key: K) {
  const [value, setValue] = useState<IntegrationSettings[K]>(() => getIntegrations()[key]);
  const [note, setNote] = useState("");
  const save = (next = value) => {
    saveIntegrations({ ...getIntegrations(), [key]: next });
    setNote("Saved.");
  };
  return { value, setValue, note, setNote, save };
}

/* ---------------- General ---------------- */

function toLocalInput(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function minutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60000).toISOString();
}

export function GeneralSettingsDesk() {
  const [settings, setSettings] = useState<SiteSettings>(() => getSettings());
  const [note, setNote] = useState("");
  const set = (patch: Partial<SiteSettings>) => setSettings((current) => ({ ...current, ...patch }));

  const save = () => {
    try {
      saveSettings({ ...getSettings(), ...pickGeneral(settings) });
      window.dispatchEvent(new Event("vgmf-cms"));
      setNote(settings.maintenanceMode ? "Saved. Visitors now see the maintenance page; admins and staff still see the site." : "Saved. The site is live.");
    } catch {
      setNote("Could not save: browser storage is full. Use a smaller logo.");
    }
  };

  const until = settings.maintenanceUntil ? Date.parse(settings.maintenanceUntil) : NaN;
  const preset = (minutes: number) => set({ maintenanceMode: true, maintenanceUntil: minutesFromNow(minutes) });

  return (
    <div className="space-y-5">
      <Header title="General & maintenance" text="Site name, logo and contact details shown in the header and footer, and the maintenance switch with an automatic end time." action={<button type="button" className={primary} onClick={save}>Save settings</button>} />
      <Saved text={note} />

      <Card title="Branding" text="The logo replaces the VGMF badge in the header, footer, sign-in and maintenance pages.">
        <div className="grid gap-5 lg:grid-cols-2">
          <ImageField label="Site logo" value={settings.logoUrl} maxWidth={400} hint="Square or wide PNG/SVG works best. Uploads are resized to 400px." onChange={(logoUrl) => set({ logoUrl })} />
          <ImageField label="Favicon / app icon" value={settings.faviconUrl} maxWidth={128} hint="Shown in the browser tab." onChange={(faviconUrl) => set({ faviconUrl })} />
          <Text label="Site name" value={settings.siteName} onChange={(siteName) => set({ siteName })} />
          <Text label="Logo text (when no logo image)" value={settings.logoText} onChange={(logoText) => set({ logoText })} />
          <Text label="Tagline" value={settings.tagline} onChange={(tagline) => set({ tagline })} />
          <Text label="Support email" value={settings.supportEmail} onChange={(supportEmail) => set({ supportEmail })} />
          <Text label="Support phone" value={settings.supportPhone} onChange={(supportPhone) => set({ supportPhone })} />
        </div>
      </Card>

      <Card title="Maintenance mode" text="Visitors see a maintenance page with a countdown. Admins and staff can still browse the site.">
        <div className="space-y-4">
          <Check label="Put the site in maintenance" checked={settings.maintenanceMode} onChange={(maintenanceMode) => set({ maintenanceMode })} />
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Message for visitors</span>
            <textarea className={input} rows={2} value={settings.maintenanceMessage} onChange={(event) => set({ maintenanceMessage: event.target.value })} />
          </label>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Back online at (your local time)</span>
              <input
                className={input}
                type="datetime-local"
                value={toLocalInput(settings.maintenanceUntil)}
                onChange={(event) => set({ maintenanceUntil: event.target.value ? new Date(event.target.value).toISOString() : "" })}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {[30, 60, 120, 240, 1440].map((minutes) => (
                <button key={minutes} type="button" className={ghost} onClick={() => preset(minutes)}>
                  {minutes < 60 ? `${minutes} min` : minutes === 1440 ? "1 day" : `${minutes / 60} h`}
                </button>
              ))}
              <button type="button" className={ghost} onClick={() => set({ maintenanceUntil: "" })}>No timer</button>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            {settings.maintenanceMode
              ? Number.isFinite(until)
                ? `The site switches back on automatically at ${new Date(until).toLocaleString("en-IN")}.`
                : "No end time: the site stays in maintenance until you switch it off."
              : "The site is live."}
          </p>
        </div>
      </Card>
    </div>
  );
}

function pickGeneral(settings: SiteSettings): Partial<SiteSettings> {
  const { siteName, tagline, logoText, logoUrl, faviconUrl, supportEmail, supportPhone, maintenanceMode, maintenanceMessage, maintenanceUntil } = settings;
  return { siteName, tagline, logoText, logoUrl, faviconUrl, supportEmail, supportPhone, maintenanceMode, maintenanceMessage, maintenanceUntil };
}

/* ---------------- Payments ---------------- */

export function PaymentSettingsDesk() {
  const razorpay = useIntegrationSlice("razorpay");
  const paytm = useIntegrationSlice("paytm");
  const { value, setValue, note, setNote, save } = razorpay;
  const [busy, setBusy] = useState("");
  const set = (patch: Partial<typeof value>) => setValue({ ...value, ...patch });
  const setPaytm = (patch: Partial<typeof paytm.value>) => paytm.setValue({ ...paytm.value, ...patch });

  const saveAll = () => {
    save();
    paytm.save();
    setNote("Saved.");
  };

  const test = async () => {
    saveAll();
    setBusy("razorpay");
    const result = await testRazorpay().catch((error: Error) => ({ ok: false, error: error.message, message: "" }));
    setBusy("");
    setNote(result.ok ? result.message || "Connected." : `Test failed: ${result.error}`);
  };

  const testPaytm = async () => {
    saveAll();
    setBusy("paytm");
    const result = await testPaytmEdc().catch((error: Error) => ({ ok: false, error: error.message, message: "" }));
    setBusy("");
    paytm.setNote(result.ok ? result.message || "Connected." : `Test failed: ${result.error}`);
    setNote(result.ok ? result.message || "Connected." : `Test failed: ${result.error}`);
  };

  const modes = [
    { id: "demo", title: "Demo", text: "No money moves. Checkout and payment links simulate a successful payment." },
    { id: "test", title: "Test mode", text: "Razorpay test keys (rzp_test_…). Use Razorpay test cards and UPI." },
    { id: "live", title: "Live mode", text: "Razorpay live keys (rzp_live_…). Real payments and refunds." },
  ] as const;

  return (
    <div className="space-y-5">
      <Header title="Payments & Razorpay" text="Choose demo, test or live mode and store the Razorpay keys used by checkout, POS UPI, payment links and refunds. Add Razorpay and Paytm EDC details for the counter." action={<button type="button" className={primary} onClick={() => saveAll()}>Save</button>} />
      <Saved text={note} />
      <Card title="Mode">
        <div className="grid gap-3 md:grid-cols-3">
          {modes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => set({ mode: mode.id })}
              className={`rounded-xl border-2 p-4 text-left transition ${value.mode === mode.id ? "border-burgundy bg-burgundy/5" : "border-slate-200 hover:border-burgundy/40"}`}
            >
              <p className="font-semibold text-slate-900">{mode.title}</p>
              <p className="mt-1 text-xs text-slate-500">{mode.text}</p>
            </button>
          ))}
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Test keys">
          <div className="space-y-3">
            <Text label="Key ID" value={value.testKeyId} placeholder="rzp_test_…" onChange={(testKeyId) => set({ testKeyId })} />
            <Secret label="Key secret" value={value.testKeySecret} onChange={(testKeySecret) => set({ testKeySecret })} />
          </div>
        </Card>
        <Card title="Live keys">
          <div className="space-y-3">
            <Text label="Key ID" value={value.liveKeyId} placeholder="rzp_live_…" onChange={(liveKeyId) => set({ liveKeyId })} />
            <Secret label="Key secret" value={value.liveKeySecret} onChange={(liveKeySecret) => set({ liveKeySecret })} />
          </div>
        </Card>
      </div>
      <Card title="Payment links & webhooks">
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="Payment link expiry (hours)" type="number" value={value.linkExpiryHours} onChange={(hours) => set({ linkExpiryHours: Number(hours) || 72 })} />
          <Secret label="Webhook secret" value={value.webhookSecret} onChange={(webhookSecret) => set({ webhookSecret })} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className={ghost} disabled={Boolean(busy) || value.mode === "demo"} onClick={() => void test()}>
            {busy === "razorpay" ? "Testing…" : "Test connection"}
          </button>
          <p className="text-xs text-slate-500">
            Customers on other devices use the keys set on the host as RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, because these settings are saved in this browser.
          </p>
        </div>
      </Card>
      <Card title="Razorpay EDC" text="In-store POS pushes the bill to this Razorpay POS machine. Device ID is required for wireless mode.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="POS device ID" value={value.posDeviceId} placeholder="2841158834" onChange={(posDeviceId) => set({ posDeviceId })} />
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Device mode</span>
            <select
              className={input}
              value={value.posDeviceMode}
              onChange={(event) => set({ posDeviceMode: event.target.value === "wired" ? "wired" : "wireless" })}
            >
              <option value="wireless">Wireless</option>
              <option value="wired">Wired</option>
            </select>
          </label>
        </div>
      </Card>
      <Card title="Paytm EDC" text="Counter sales on Paytm card machines use Sale + Status Enquiry. Amount is in paise. Staging: securestage.paytmpayments.com · Live: securegw-edc.paytmpayments.in.">
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          {([
            { id: "demo", title: "Demo", text: "POS records a simulated Paytm EDC payment." },
            { id: "staging", title: "Staging", text: "Paytm test MID, key and TID." },
            { id: "live", title: "Live", text: "Production Paytm EDC credentials." },
          ] as const).map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setPaytm({ mode: mode.id })}
              className={`rounded-xl border-2 p-4 text-left transition ${paytm.value.mode === mode.id ? "border-burgundy bg-burgundy/5" : "border-slate-200 hover:border-burgundy/40"}`}
            >
              <p className="font-semibold text-slate-900">{mode.title}</p>
              <p className="mt-1 text-xs text-slate-500">{mode.text}</p>
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="Merchant ID (MID)" value={paytm.value.mid} placeholder="YOURMID" onChange={(mid) => setPaytm({ mid })} />
          <Text label="Terminal ID (TID)" value={paytm.value.tid} placeholder="12345678" onChange={(tid) => setPaytm({ tid })} />
          <Secret label="Merchant key" value={paytm.value.merchantKey} onChange={(merchantKey) => setPaytm({ merchantKey })} />
          <Text label="Channel ID" value={paytm.value.channelId} placeholder="WEB" onChange={(channelId) => setPaytm({ channelId })} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className={ghost} disabled={Boolean(busy) || paytm.value.mode === "demo"} onClick={() => void testPaytm()}>
            {busy === "paytm" ? "Testing…" : "Test Paytm EDC"}
          </button>
          <p className="text-xs text-slate-500">Host keys: PAYTM_MID, PAYTM_MERCHANT_KEY, PAYTM_TID, PAYTM_CHANNEL_ID.</p>
        </div>
      </Card>
    </div>
  );
}

/* ---------------- Email ---------------- */

async function sendTest(to: string, template: string, subject: string, phone?: string) {
  const record = queueNotification({ to, phone, name: "Test", params: ["Test", "VGMF-TEST", "Test"], subject, template, body: "This is a test message from the VGMF admin console." });
  if (!record) return "Nothing was queued. For WhatsApp, map a template to this event first.";
  for (let i = 0; i < 20; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const latest = getNotifications().filter((item) => item.sentAt === record.sentAt);
    if (latest.every((item) => item.status !== "Queued")) {
      return latest.map((item) => `${item.channel === "whatsapp" ? "WhatsApp" : "Email"}: ${item.status}${item.error ? ` (${item.error})` : ""}`).join(" · ");
    }
  }
  return "Still sending. Check the notification log.";
}

export function EmailSettingsDesk() {
  const { value, setValue, note, setNote, save } = useIntegrationSlice("email");
  const [to, setTo] = useState(() => getSettings().supportEmail);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof value>) => setValue({ ...value, ...patch });

  return (
    <div className="space-y-5">
      <Header title="Email: ZeptoMail & Zoho Mail" text="Pick the provider that sends order, account and support emails, and store its credentials." action={<button type="button" className={primary} onClick={() => save()}>Save</button>} />
      <Saved text={note} />
      <Card title="Sender">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Provider</span>
            <select className={input} value={value.provider} onChange={(event) => set({ provider: event.target.value as typeof value.provider })}>
              <option value="zeptomail">ZeptoMail (transactional)</option>
              <option value="zoho">Zoho Mail</option>
            </select>
          </label>
          <Text label="From address" value={value.fromAddress} onChange={(fromAddress) => set({ fromAddress })} hint="Must be a verified sender domain." />
          <Text label="From name" value={value.fromName} onChange={(fromName) => set({ fromName })} />
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="ZeptoMail" text="Mail Agents → SMTP/API → Send Mail token.">
          <div className="space-y-3">
            <Secret label="Send mail token" value={value.zeptoToken} placeholder="Zoho-enczapikey …" onChange={(zeptoToken) => set({ zeptoToken })} />
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Data centre</span>
              <select className={input} value={value.zeptoHost} onChange={(event) => set({ zeptoHost: event.target.value })}>
                <option value="api.zeptomail.in">India (api.zeptomail.in)</option>
                <option value="api.zeptomail.com">Global (api.zeptomail.com)</option>
                <option value="api.zeptomail.eu">EU (api.zeptomail.eu)</option>
              </select>
            </label>
          </div>
        </Card>
        <Card title="Zoho Mail" text="Create a Self Client in the Zoho API console with scope ZohoMail.messages.CREATE.">
          <div className="space-y-3">
            <Text label="Client ID" value={value.zohoClientId} onChange={(zohoClientId) => set({ zohoClientId })} />
            <Secret label="Client secret" value={value.zohoClientSecret} onChange={(zohoClientSecret) => set({ zohoClientSecret })} />
            <Secret label="Refresh token" value={value.zohoRefreshToken} onChange={(zohoRefreshToken) => set({ zohoRefreshToken })} />
            <Text label="Account ID" value={value.zohoAccountId} onChange={(zohoAccountId) => set({ zohoAccountId })} />
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Zoho domain</span>
              <select className={input} value={value.zohoDomain} onChange={(event) => set({ zohoDomain: event.target.value })}>
                <option value="zoho.in">zoho.in</option>
                <option value="zoho.com">zoho.com</option>
                <option value="zoho.eu">zoho.eu</option>
              </select>
            </label>
          </div>
        </Card>
      </div>
      <Card title="Send a test email">
        <div className="flex flex-wrap gap-2">
          <input className={`${input} max-w-sm`} value={to} onChange={(event) => setTo(event.target.value)} />
          <button
            type="button"
            className={ghost}
            disabled={busy}
            onClick={async () => {
              save();
              setBusy(true);
              setNote(await sendTest(to, "zeptomail-test", "VGMF email test"));
              setBusy(false);
            }}
          >
            {busy ? "Sending…" : "Send test"}
          </button>
        </div>
      </Card>
    </div>
  );
}

/* ---------------- WhatsApp ---------------- */

export function WhatsAppSettingsDesk() {
  const { value, setValue, note, setNote, save } = useIntegrationSlice("whatsapp");
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [event, setEvent] = useState<string>("order-placed");
  const set = (patch: Partial<typeof value>) => setValue({ ...value, ...patch });

  const sync = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "templates", creds: value }),
      });
      const result = (await response.json()) as { ok: boolean; templates?: WhatsAppTemplate[]; error?: string };
      if (!result.ok) throw new Error(result.error);
      const next = { ...value, templates: result.templates ?? [], templatesSyncedAt: new Date().toISOString() };
      setValue(next);
      save(next);
      setNote(`Synced ${next.templates.length} templates from Meta.`);
    } catch (error) {
      setNote(`Sync failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const approved = value.templates.filter((template) => template.status === "APPROVED");

  return (
    <div className="space-y-5">
      <Header title="WhatsApp" text="Send order and account messages through Meta Cloud API (developers.facebook.com) or Zoho CPaaS (Agent API key). Sync Meta templates and map each site event to a template name or Zoho template alias." action={<button type="button" className={primary} onClick={() => save()}>Save</button>} />
      <Saved text={note} />
      <Card title="Provider">
        <div className="grid gap-3 md:grid-cols-4">
          {([
            ["none", "Off", "Only email is sent."],
            ["meta", "Meta Cloud API", "Direct from your WhatsApp Business Account."],
            ["zoho", "Zoho CPaaS", "Zoho CPaaS WhatsApp channel."],
            ["aisensy", "AiSensy", "Through AiSensy API campaigns."],
          ] as const).map(([provider, label, hint]) => (
            <button
              key={provider}
              type="button"
              onClick={() => set({ provider })}
              className={`rounded-xl border-2 p-4 text-left ${value.provider === provider ? "border-burgundy bg-burgundy/5" : "border-slate-200"}`}
            >
              <p className="font-semibold text-slate-900">{label}</p>
              <p className="mt-1 text-xs text-slate-500">{hint}</p>
            </button>
          ))}
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Meta Cloud API" text="developers.facebook.com/docs → WhatsApp Cloud API. Phone number ID + permanent System User token. Templates are sent as Graph /{phone-number-id}/messages.">
          <div className="space-y-3">
            <Text label="App ID" value={value.metaAppId} onChange={(metaAppId) => set({ metaAppId })} />
            <Text label="WhatsApp Business Account ID" value={value.metaWabaId} onChange={(metaWabaId) => set({ metaWabaId })} />
            <Text label="Phone number ID" value={value.metaPhoneNumberId} onChange={(metaPhoneNumberId) => set({ metaPhoneNumberId })} />
            <Secret label="Access token" value={value.metaAccessToken} onChange={(metaAccessToken) => set({ metaAccessToken })} />
            <Text label="Graph API version" value={value.metaApiVersion} onChange={(metaApiVersion) => set({ metaApiVersion })} />
            <button type="button" className={ghost} disabled={busy} onClick={sync}>{busy ? "Syncing…" : "Sync templates from Meta"}</button>
            <p className="text-xs text-slate-500">
              Callback URL for Meta App → WhatsApp → Configuration:{" "}
              <span className="font-mono break-all">{typeof window === "undefined" ? "/api/notify/webhook" : `${window.location.origin}/api/notify/webhook`}</span>
              . Verify token env: <span className="font-mono">META_WA_VERIFY_TOKEN</span>.
            </p>
          </div>
        </Card>
        <Card title="Zoho CPaaS" text="docs.zoho.com/cpaas — WhatsApp send is POST https://cpaas.zoho.com/v1.1/whatsapp with the Agent API key (Authorization: Zoho-enczapikey). From and to numbers must include the country code.">
          <div className="space-y-3">
            <Secret label="Agent API key" value={value.zohoCpaasApiKey} onChange={(zohoCpaasApiKey) => set({ zohoCpaasApiKey })} />
            <Text
              label="WhatsApp sender number"
              value={value.zohoCpaasFrom}
              onChange={(zohoCpaasFrom) => set({ zohoCpaasFrom })}
              placeholder="+91…"
              hint="The WABA number linked to this Agent, including country code."
            />
            <label className="block text-xs font-semibold text-slate-500">
              CPaaS host
              <select className={`${input} mt-1`} value={value.zohoCpaasDomain} onChange={(event) => set({ zohoCpaasDomain: event.target.value })}>
                <option value="zoho.com">cpaas.zoho.com</option>
                <option value="zoho.in">cpaas.zoho.in</option>
                <option value="zoho.eu">cpaas.zoho.eu</option>
              </select>
            </label>
          </div>
        </Card>
        <Card title="AiSensy" text="AiSensy → Manage → API key. Create one API campaign per message.">
          <div className="space-y-3">
            <Secret label="API key" value={value.aisensyApiKey} onChange={(aisensyApiKey) => set({ aisensyApiKey })} />
            <Text label="Project ID (optional)" value={value.aisensyProjectId} onChange={(aisensyProjectId) => set({ aisensyProjectId })} />
          </div>
        </Card>
      </div>

      <Card
        title="Templates"
        text={value.templatesSyncedAt ? `Last synced ${new Date(value.templatesSyncedAt).toLocaleString("en-IN")}` : "Not synced yet."}
      >
        {value.templates.length === 0 ? (
          <p className="text-sm text-slate-500">Sync from Meta to list templates here. For AiSensy, type campaign names in the mapping below.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="py-2">Name</th><th>Language</th><th>Category</th><th>Status</th><th>Variables</th><th>Body</th>
                </tr>
              </thead>
              <tbody>
                {value.templates.map((template) => (
                  <tr key={`${template.name}-${template.language}`} className="border-b border-slate-100 align-top">
                    <td className="py-2 font-mono text-xs">{template.name}</td>
                    <td>{template.language}</td>
                    <td>{template.category}</td>
                    <td className={template.status === "APPROVED" ? "text-emerald-700" : "text-amber-700"}>{template.status}</td>
                    <td>{template.variables}</td>
                    <td className="max-w-xs truncate text-xs text-slate-500">{template.body}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Link templates to site notifications" text="Variables are filled in order: customer name, order ID, then status, amount or link.">
        <datalist id="wa-templates">
          {approved.map((template) => (
            <option key={template.name} value={template.name} />
          ))}
        </datalist>
        <div className="grid gap-3 md:grid-cols-2">
          {notificationEvents.map((item) => (
            <label key={item.id} className="flex items-center gap-3 text-sm">
              <span className="w-44 shrink-0 font-medium text-slate-700">{item.label}</span>
              <input
                className={input}
                list="wa-templates"
                placeholder={
                  value.provider === "aisensy"
                    ? "AiSensy campaign name"
                    : value.provider === "zoho"
                      ? "Zoho template alias or template key"
                      : "Meta template name"
                }
                value={value.mapping[item.id] ?? ""}
                onChange={(eventInput) => set({ mapping: { ...value.mapping, [item.id]: eventInput.target.value } })}
              />
            </label>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <input className={`${input} max-w-[200px]`} placeholder="Test phone, e.g. 9198…" value={phone} onChange={(eventInput) => setPhone(eventInput.target.value)} />
          <select className={`${input} max-w-[220px]`} value={event} onChange={(eventInput) => setEvent(eventInput.target.value)}>
            {notificationEvents.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          <button
            type="button"
            className={ghost}
            disabled={busy || value.provider === "none"}
            onClick={async () => {
              save();
              setBusy(true);
              setNote(await sendTest("", event, "WhatsApp test", phone));
              setBusy(false);
            }}
          >
            Send test WhatsApp
          </button>
        </div>
      </Card>
    </div>
  );
}

/* ---------------- Shipping APIs ---------------- */

function ProviderStatus({ id }: { id: ShippingProviderId }) {
  const connection = getShippingConnection(id);
  return (
    <div>
      <ConnectionBadge status={connection.status} hasKeys={hasShippingCredentials(id)} />
      {connection.message && (connection.status === "success" || connection.status === "failed") && (
        <p className={`mt-1 text-xs ${connection.status === "success" ? "text-emerald-700" : "text-red-700"}`}>{connection.message}</p>
      )}
    </div>
  );
}

export function ShippingApisDesk() {
  const { value, setValue, note, setNote, save } = useIntegrationSlice("shipping");
  const [busy, setBusy] = useState("");
  const [pincode, setPincode] = useState("110001");
  const [quote, setQuote] = useState<RateQuote | null>(null);
  const [, setStamp] = useState(0);
  const set = (patch: Partial<typeof value>) => setValue({ ...value, ...patch });

  useEffect(() => subscribeCms(() => setStamp((current) => current + 1)), []);

  const test = async (provider: string) => {
    save();
    setBusy(provider);
    const result = await testShippingProvider(provider).catch((error: Error) => ({ ok: false, error: error.message, message: "" }));
    setBusy("");
    setNote(result.ok ? `${provider}: ${result.message}` : `${provider} failed from this site: ${result.error}`);
    setStamp((current) => current + 1);
    return result;
  };

  const saveAndTestAll = async () => {
    save();
    setBusy("all");
    const results = await testConfiguredShippingProviders().catch((error: Error) => [{ id: "shipping", ok: false, error: error.message }]);
    setBusy("");
    if (!results.length) {
      setNote("Save a key first, then Save & test. The check runs through /api/shipping on this site.");
      return;
    }
    const ok = results.filter((item) => item.ok).map((item) => item.id);
    const bad = results.filter((item) => !item.ok).map((item) => `${item.id}: ${item.error || "failed"}`);
    setNote(bad.length ? `Live check: ${bad.join(" · ")}${ok.length ? ` · OK: ${ok.join(", ")}` : ""}` : `Live from this site: ${ok.join(", ")}.`);
    setStamp((current) => current + 1);
  };

  const pickup = value.pickup;
  const setPickup = (patch: Partial<typeof pickup>) => set({ pickup: { ...pickup, ...patch } });

  return (
    <div className="space-y-5">
      <Header
        title="Shipping APIs"
        text="This is the only courier integration page. Save a key, then Save & test — the request goes through this site’s /api/shipping route first, so Success or Failed is a live check from our server. Hyperlocal orders book Tookan create_task; standard orders book Tookan create_multiple_tasks (parcel)."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={ghost} onClick={() => save()}>Save</button>
            <button type="button" className={primary} disabled={Boolean(busy)} onClick={() => saveAndTestAll()}>
              {busy === "all" ? "Checking live…" : "Save & test all"}
            </button>
          </div>
        }
      />
      <Saved text={note} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Shipday" text="docs.shipday.com — POST /orders to create, GET /orders to track, DELETE /orders/{id} to cancel. Authorization: Basic {API key}." badge={<ProviderStatus id="shipday" />} right={<Check label="Use" checked={value.shipday.enabled} onChange={(enabled) => set({ shipday: { ...value.shipday, enabled } })} />}>
          <div className="space-y-3">
            <Secret label="Shipday API key" value={value.shipday.apiKey} onChange={(apiKey) => set({ shipday: { ...value.shipday, apiKey } })} />
            <button type="button" className={primary} disabled={busy === "shipday"} onClick={() => test("shipday")}>{busy === "shipday" ? "Checking live…" : "Save & test"}</button>
          </div>
        </Card>
        <Card title="Shiprocket" text="apidocs.shiprocket.in — Settings → API → Create an API user. Login, serviceability, adhoc order, assign AWB, generate pickup, label, invoice, manifest, track AWB, cancel and reverse pickup all use this account." badge={<ProviderStatus id="shiprocket" />} right={<Check label="Use" checked={value.shiprocket.enabled} onChange={(enabled) => set({ shiprocket: { ...value.shiprocket, enabled } })} />}>
          <div className="space-y-3">
            <Text label="API user email" value={value.shiprocket.email} onChange={(email) => set({ shiprocket: { ...value.shiprocket, email } })} />
            <Secret label="API user password" value={value.shiprocket.password} onChange={(password) => set({ shiprocket: { ...value.shiprocket, password } })} />
            <Text label="Channel ID (optional)" value={value.shiprocket.channelId} onChange={(channelId) => set({ shiprocket: { ...value.shiprocket, channelId } })} />
            <button type="button" className={primary} disabled={busy === "shiprocket"} onClick={() => test("shiprocket")}>{busy === "shiprocket" ? "Checking live…" : "Save & test"}</button>
            <p className="text-xs text-slate-500">
              Webhook URL for Shiprocket Settings → API → Webhooks:{" "}
              <span className="font-mono break-all text-slate-700">{typeof window === "undefined" ? "/api/shipping/webhook" : `${window.location.origin}/api/shipping/webhook`}</span>
              . Optional header <span className="font-mono">x-api-key</span> = <span className="font-mono">SHIPROCKET_WEBHOOK_TOKEN</span>.
            </p>
            <button
              type="button"
              className={ghost}
              disabled={busy === "webhooks"}
              onClick={async () => {
                setBusy("webhooks");
                setNote(await applyShiprocketWebhooks().catch((error: Error) => error.message));
                setBusy("");
              }}
            >
              Apply Shiprocket tracking updates
            </button>
          </div>
        </Card>
        <Card title="iThink Logistics" text="docs.ithinklogistics.com v3 — access token + secret key. Rate check, order add, track, cancel, label, invoice and manifest." badge={<ProviderStatus id="ithink" />} right={<Check label="Use" checked={value.ithink.enabled} onChange={(enabled) => set({ ithink: { ...value.ithink, enabled } })} />}>
          <div className="space-y-3">
            <Secret label="Access token" value={value.ithink.accessToken} onChange={(accessToken) => set({ ithink: { ...value.ithink, accessToken } })} />
            <Secret label="Secret key" value={value.ithink.secretKey} onChange={(secretKey) => set({ ithink: { ...value.ithink, secretKey } })} />
            <Text label="Pickup warehouse / address ID" value={value.ithink.pickupAddressId} onChange={(pickupAddressId) => set({ ithink: { ...value.ithink, pickupAddressId } })} />
            <Text label="API host" value={value.ithink.host} onChange={(host) => set({ ithink: { ...value.ithink, host } })} hint="https://my.ithinklogistics.com/api_v3/" />
            <button type="button" className={primary} disabled={busy === "ithink"} onClick={() => test("ithink")}>{busy === "ithink" ? "Checking live…" : "Save & test"}</button>
          </div>
        </Card>
        <Card title="Tookan" text="One API key. Hyperlocal (same-city) books Tookan create_task. Standard / intercity books Tookan create_multiple_tasks (parcel: pickup + delivery). Save & test calls get_all_fleets through this site." badge={<ProviderStatus id="tookan" />}>
          <div className="space-y-3">
            <Secret label="Tookan API key" value={value.tookan.apiKey} onChange={(apiKey) => set({ tookan: { ...value.tookan, apiKey } })} />
            <Text label="Team ID" value={value.tookan.teamId} onChange={(teamId) => set({ tookan: { ...value.tookan, teamId } })} />
            <Check label="Offer hyperlocal as Tookan tasks" hint="Same-city pincodes book create_task (delivery only)." checked={value.tookan.hyperlocal} onChange={(hyperlocal) => set({ tookan: { ...value.tookan, hyperlocal } })} />
            <Check label="Offer standard as Tookan parcel" hint="Other pincodes book create_multiple_tasks with pickup + delivery." checked={value.tookan.parcel} onChange={(parcel) => set({ tookan: { ...value.tookan, parcel } })} />
            <button type="button" className={primary} disabled={busy === "tookan"} onClick={() => test("tookan")}>{busy === "tookan" ? "Checking live…" : "Save & test"}</button>
          </div>
        </Card>
        <Card title="Nimbuspost" text="Nimbuspost login email and password, used as a second aggregator if you keep that account." badge={<ProviderStatus id="nimbuspost" />} right={<Check label="Use" checked={value.nimbuspost.enabled} onChange={(enabled) => set({ nimbuspost: { ...value.nimbuspost, enabled } })} />}>
          <div className="space-y-3">
            <Text label="Email" value={value.nimbuspost.email} onChange={(email) => set({ nimbuspost: { ...value.nimbuspost, email } })} />
            <Secret label="Password" value={value.nimbuspost.password} onChange={(password) => set({ nimbuspost: { ...value.nimbuspost, password } })} />
            <button type="button" className={primary} disabled={busy === "nimbuspost"} onClick={() => test("nimbuspost")}>{busy === "nimbuspost" ? "Checking live…" : "Save & test"}</button>
          </div>
        </Card>
      </div>

      <Card
        title="Pickup address"
        text="Couriers collect parcels here. The nickname must match the pickup location name in Shiprocket."
        right={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={ghost}
              disabled={busy === "pickup"}
              onClick={async () => {
                save();
                setBusy("pickup");
                const result = await syncPickupAddress().catch((error: Error) => ({ ok: false, error: error.message }));
                setBusy("");
                setNote(result.ok ? "Pickup address added to Shiprocket." : `Shiprocket pickup sync: ${result.error}`);
              }}
            >
              Add to Shiprocket
            </button>
            <button
              type="button"
              className={ghost}
              disabled={busy === "pickup-list"}
              onClick={async () => {
                save();
                setBusy("pickup-list");
                const result = await listPickupLocations().catch((error: Error) => ({ ok: false, error: error.message, locations: [] as { nickname: string; city: string; pincode: string }[] }));
                setBusy("");
                if (!result.ok) {
                  setNote(`Shiprocket pickup list: ${result.error}`);
                  return;
                }
                const names = (result.locations ?? []).map((location) => `${location.nickname} (${location.city} ${location.pincode})`);
                setNote(names.length ? `Shiprocket pickup locations: ${names.join(" · ")}` : "Shiprocket returned no pickup locations.");
              }}
            >
              List locations
            </button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Text label="Nickname" value={pickup.nickname} onChange={(nickname) => setPickup({ nickname })} />
          <Text label="Contact name" value={pickup.contactName} onChange={(contactName) => setPickup({ contactName })} />
          <Text label="Phone" value={pickup.phone} onChange={(phone) => setPickup({ phone })} />
          <Text label="Email" value={pickup.email} onChange={(email) => setPickup({ email })} />
          <Text label="Address line 1" value={pickup.line1} onChange={(line1) => setPickup({ line1 })} />
          <Text label="Address line 2" value={pickup.line2} onChange={(line2) => setPickup({ line2 })} />
          <Text label="City" value={pickup.city} onChange={(city) => setPickup({ city })} />
          <Text label="State" value={pickup.state} onChange={(state) => setPickup({ state })} />
          <Text label="Pincode" value={pickup.pincode} onChange={(pin) => setPickup({ pincode: pin.replace(/\D/g, "").slice(0, 6) })} />
        </div>
      </Card>

      <Card title="Parcel defaults & automation">
        <div className="grid gap-3 sm:grid-cols-4">
          <Text label="Weight per item (kg)" type="number" value={value.defaultWeightKg} onChange={(weight) => set({ defaultWeightKg: Number(weight) || 0.5 })} />
          <Text label="Length (cm)" type="number" value={value.packageCm.length} onChange={(length) => set({ packageCm: { ...value.packageCm, length: Number(length) || 1 } })} />
          <Text label="Breadth (cm)" type="number" value={value.packageCm.breadth} onChange={(breadth) => set({ packageCm: { ...value.packageCm, breadth: Number(breadth) || 1 } })} />
          <Text label="Height (cm)" type="number" value={value.packageCm.height} onChange={(height) => set({ packageCm: { ...value.packageCm, height: Number(height) || 1 } })} />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Check label="Book the courier when an order is packed" hint="Uses the courier the customer chose, or the rule below." checked={value.autoBookOnPack} onChange={(autoBookOnPack) => set({ autoBookOnPack })} />
          <Check label="Schedule pickup automatically" hint="Shiprocket gets a pickup request right after the AWB." checked={value.autoSchedulePickup} onChange={(autoSchedulePickup) => set({ autoSchedulePickup })} />
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">When the customer did not choose</span>
            <select className={input} value={value.rateChoice} onChange={(event) => set({ rateChoice: event.target.value as typeof value.rateChoice })}>
              <option value="customer">Cheapest (customer picks at checkout)</option>
              <option value="cheapest">Always cheapest</option>
              <option value="fastest">Always fastest</option>
            </select>
          </label>
        </div>
      </Card>

      <Card title="Check rates for a pincode">
        <div className="flex flex-wrap gap-2">
          <input className={`${input} max-w-[160px]`} value={pincode} onChange={(event) => setPincode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
          <button
            type="button"
            className={ghost}
            disabled={busy === "rates"}
            onClick={async () => {
              save();
              setBusy("rates");
              setQuote(await fetchCourierRates({ deliveryPincode: pincode, weightKg: value.defaultWeightKg, declaredValue: 500 }));
              setBusy("");
            }}
          >
            {busy === "rates" ? "Checking…" : "Get rates"}
          </button>
        </div>
        {quote && <RatesTable quote={quote} />}
      </Card>
    </div>
  );
}

export function RatesTable({ quote, onPick, picked }: { quote: RateQuote; onPick?: (index: number) => void; picked?: number }) {
  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs text-slate-500">
        {quote.live ? "Live rates from the aggregator." : "Estimated from the Delivery Partners table (no live aggregator credentials)."}
      </p>
      {quote.notes.map((item) => (
        <p key={item} className="text-xs text-amber-700">{item}</p>
      ))}
      {quote.rates.length === 0 ? (
        <p className="text-sm text-slate-500">No courier services this pincode.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {quote.rates.map((rate, index) => (
            <li key={`${rate.provider}-${rate.courierId}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <label className="flex items-center gap-2">
                {onPick && <input type="radio" checked={picked === index} onChange={() => onPick(index)} />}
                <span className="font-medium text-slate-800">{rate.courierName}</span>
                <span className="text-xs uppercase text-slate-400">{rate.provider === "local" ? "estimate" : rate.provider}</span>
              </label>
              <span className="text-slate-600">{rate.etaDays} day{rate.etaDays === 1 ? "" : "s"} · <b>₹{Math.round(rate.rate)}</b></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- Orders ---------------- */

export function OrderSettingsDesk() {
  const [value, setValue] = useState<OrderSettings>(() => getOrderSettings());
  const [note, setNote] = useState("");
  const set = (patch: Partial<OrderSettings>) => setValue((current) => ({ ...current, ...patch }));

  const save = () => {
    saveOrderSettings(value);
    savePolicy({ ...getPolicy(), storePickupEnabled: value.pickupEnabled });
    setNote("Saved. Checkout, product pages and customer orders use these rules now.");
  };

  const feeModes = [
    { id: "free", label: "Free shipping on every order" },
    { id: "flat", label: "Flat fee per order" },
    { id: "per_item", label: "Fee per item" },
    { id: "free_above", label: "Flat fee, free above an order value" },
    { id: "courier_rate", label: "Charge the courier's rate for the pincode" },
  ] as const;

  return (
    <div className="space-y-5">
      <Header title="Orders, returns & refunds" text="Which fulfilment options customers can pick, how shipping is charged, and the return, refund and cancellation rules." action={<button type="button" className={primary} onClick={save}>Save</button>} />
      <Saved text={note} />
      <Card title="Fulfilment options at checkout">
        <div className="grid gap-4 md:grid-cols-3">
          <Check label="Home delivery" checked={value.deliveryEnabled} onChange={(deliveryEnabled) => set({ deliveryEnabled })} />
          <Check label="Pickup from store" checked={value.pickupEnabled} onChange={(pickupEnabled) => set({ pickupEnabled })} />
          <Check label="Customer chooses the delivery partner" hint="Shows couriers and rates at checkout." checked={value.showCourierChoice} onChange={(showCourierChoice) => set({ showCourierChoice })} />
          <Check label="Cash on delivery" checked={value.codEnabled} onChange={(codEnabled) => set({ codEnabled })} />
          {value.codEnabled && <Text label="COD fee (₹)" type="number" value={value.codFee} onChange={(fee) => set({ codFee: Number(fee) || 0 })} />}
        </div>
      </Card>
      <Card title="Shipping fee">
        <div className="space-y-2">
          {feeModes.map((mode) => (
            <label key={mode.id} className="flex items-center gap-3 text-sm">
              <input type="radio" className="accent-burgundy" checked={value.shippingFeeMode === mode.id} onChange={() => set({ shippingFeeMode: mode.id })} />
              {mode.label}
            </label>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(value.shippingFeeMode === "flat" || value.shippingFeeMode === "free_above" || value.shippingFeeMode === "courier_rate") && (
            <Text label={value.shippingFeeMode === "courier_rate" ? "Fallback fee (₹)" : "Flat fee (₹)"} type="number" value={value.flatFee} onChange={(fee) => set({ flatFee: Number(fee) || 0 })} />
          )}
          {value.shippingFeeMode === "per_item" && <Text label="Fee per item (₹)" type="number" value={value.perItemFee} onChange={(fee) => set({ perItemFee: Number(fee) || 0 })} />}
          {value.shippingFeeMode === "free_above" && <Text label="Free above (₹)" type="number" value={value.freeAbove} onChange={(amount) => set({ freeAbove: Number(amount) || 0 })} />}
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Returns">
          <div className="space-y-3">
            <Check label="Accept returns" checked={value.returns.enabled} onChange={(enabled) => set({ returns: { ...value.returns, enabled } })} />
            <Check label="Offer replacements" checked={value.returns.replacementAllowed} onChange={(replacementAllowed) => set({ returns: { ...value.returns, replacementAllowed } })} />
            <Text label="Return window (days after delivery)" type="number" value={value.returns.windowDays} onChange={(days) => set({ returns: { ...value.returns, windowDays: Number(days) || 0 } })} />
            <Text label="Return pickup charge (₹)" type="number" value={value.returns.pickupCharge} onChange={(charge) => set({ returns: { ...value.returns, pickupCharge: Number(charge) || 0 } })} />
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Return reasons (one per line)</span>
              <textarea className={input} rows={4} value={value.returns.reasons.join("\n")} onChange={(event) => set({ returns: { ...value.returns, reasons: event.target.value.split("\n") } })} />
            </label>
          </div>
        </Card>
        <Card title="Refunds">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Refund to</span>
              <select className={input} value={value.refunds.method} onChange={(event) => set({ refunds: { ...value.refunds, method: event.target.value as OrderSettings["refunds"]["method"] } })}>
                <option value="original">Original payment method (Razorpay)</option>
                <option value="manual">Manual bank transfer</option>
              </select>
            </label>
            <Text label="Processing time (business days)" type="number" value={value.refunds.processingDays} onChange={(days) => set({ refunds: { ...value.refunds, processingDays: Number(days) || 1 } })} />
            <Check label="Refund automatically when the return is picked up" checked={value.refunds.autoRefundOnReturnPickup} onChange={(autoRefundOnReturnPickup) => set({ refunds: { ...value.refunds, autoRefundOnReturnPickup } })} />
          </div>
        </Card>
        <Card title="Cancellations">
          <div className="space-y-3">
            <Check label="Customers can cancel" checked={value.cancellation.enabled} onChange={(enabled) => set({ cancellation: { ...value.cancellation, enabled } })} />
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Allowed until the order is</span>
              <select className={input} value={value.cancellation.allowedUntil} onChange={(event) => set({ cancellation: { ...value.cancellation, allowedUntil: event.target.value as OrderSettings["cancellation"]["allowedUntil"] } })}>
                <option value="Ordered">Ordered (before packing)</option>
                <option value="Packed">Packed (before courier pickup)</option>
                <option value="Shipped">Shipped</option>
              </select>
            </label>
            <Text label="Within hours of ordering (0 = any time)" type="number" value={value.cancellation.windowHours} onChange={(hours) => set({ cancellation: { ...value.cancellation, windowHours: Number(hours) || 0 } })} />
            <Text label="Cancellation fee (₹)" type="number" value={value.cancellation.fee} onChange={(fee) => set({ cancellation: { ...value.cancellation, fee: Number(fee) || 0 } })} />
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- Notifications ---------------- */

function useNotifications() {
  const [list, setList] = useState<NotificationRecord[]>(() => getNotifications());
  useEffect(() => subscribeCms(() => setList(getNotifications())), []);
  return list;
}

const statusTone: Record<string, string> = {
  Queued: "bg-slate-100 text-slate-700",
  Sent: "bg-sky-50 text-sky-700",
  Delivered: "bg-emerald-50 text-emerald-700",
  Failed: "bg-red-50 text-red-700",
};

export function NotificationsDesk({ compose = false }: { compose?: boolean }) {
  const list = useNotifications();
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState({ to: "", phone: "", subject: "", body: "" });
  const [note, setNote] = useState("");

  const filtered = useMemo(
    () =>
      list.filter(
        (item) =>
          (channel === "all" || (item.channel ?? "email") === channel) &&
          (status === "all" || item.status === status) &&
          (!search || `${item.to} ${item.subject} ${item.template}`.toLowerCase().includes(search.toLowerCase()))
      ),
    [list, channel, status, search]
  );

  const count = (value: string) => list.filter((item) => item.status === value).length;

  return (
    <div className="space-y-5">
      <Header title="Notifications" text="Every email and WhatsApp message the site sends, with its delivery status. Retry failures after fixing credentials." />
      <div className="grid gap-3 sm:grid-cols-4">
        {(["Sent", "Delivered", "Failed", "Queued"] as const).map((value) => (
          <button key={value} type="button" onClick={() => setStatus(status === value ? "all" : value)} className={`rounded-xl border p-4 text-left ${status === value ? "border-burgundy" : "border-slate-200"} bg-white`}>
            <p className="text-xs uppercase tracking-wider text-slate-400">{value}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{count(value)}</p>
          </button>
        ))}
      </div>

      {compose && (
        <Card title="Send a message" text="Goes through the email provider, and WhatsApp too when a template is mapped for custom messages.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Text label="To email" value={draft.to} onChange={(to) => setDraft({ ...draft, to })} />
            <Text label="WhatsApp number (optional)" value={draft.phone} onChange={(phone) => setDraft({ ...draft, phone })} />
            <div className="sm:col-span-2"><Text label="Subject" value={draft.subject} onChange={(subject) => setDraft({ ...draft, subject })} /></div>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Message</span>
              <textarea className={input} rows={4} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} />
            </label>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              className={primary}
              onClick={() => {
                if (!draft.to || !draft.subject) return setNote("Add an email address and subject.");
                queueNotification({ to: draft.to, phone: draft.phone || undefined, subject: draft.subject, body: draft.body, template: "custom" });
                setDraft({ to: "", phone: "", subject: "", body: "" });
                setNote("Queued. The status updates below.");
              }}
            >
              Send
            </button>
            <Saved text={note} />
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <select className={`${input} max-w-[160px]`} value={channel} onChange={(event) => setChannel(event.target.value)}>
          <option value="all">All channels</option>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
        <select className={`${input} max-w-[160px]`} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          <option>Sent</option>
          <option>Delivered</option>
          <option>Failed</option>
          <option>Queued</option>
        </select>
        <input className={`${input} max-w-xs`} placeholder="Search recipient or subject" value={search} onChange={(event) => setSearch(event.target.value)} />
        <button type="button" className={ghost} onClick={() => filtered.filter((item) => item.status === "Failed").forEach((item) => void deliver(item.id))}>
          Retry failed
        </button>
        <button type="button" className={ghost} onClick={() => clearNotifications((item) => item.status === "Failed")}>
          Clear failed
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wider text-slate-400">
              <th className="px-4 py-2">When</th><th>Channel</th><th>To</th><th>Message</th><th>Status</th><th className="pr-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No notifications match.</td></tr>
            )}
            {filtered.slice(0, 200).map((item) => (
              <FragmentRow key={item.id} item={item} open={open === item.id} onToggle={() => setOpen(open === item.id ? null : item.id)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentRow({ item, open, onToggle }: { item: NotificationRecord; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="border-b border-slate-100 align-top">
        <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">{new Date(item.updatedAt ?? item.sentAt).toLocaleString("en-IN")}</td>
        <td className="py-2 text-xs">{item.channel === "whatsapp" ? "WhatsApp" : "Email"}<span className="block text-slate-400">{item.provider}</span></td>
        <td className="py-2 text-xs">{item.to || "—"}</td>
        <td className="py-2">
          <button type="button" className="text-left font-medium text-slate-800 hover:text-burgundy" onClick={onToggle}>{item.subject}</button>
          <span className="block text-xs text-slate-400">{eventLabel(item.template)}</span>
          {item.error && <span className="block text-xs text-red-600">{item.error}</span>}
        </td>
        <td className="py-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone[item.status] ?? statusTone.Queued}`}>{item.status}</span>
        </td>
        <td className="space-x-3 whitespace-nowrap pr-4 text-right text-xs font-semibold">
          {item.status !== "Delivered" && <button type="button" className="text-burgundy" onClick={() => void deliver(item.id)}>{item.status === "Failed" ? "Retry" : "Resend"}</button>}
          {item.status === "Sent" && <button type="button" className="text-emerald-700" onClick={() => markNotification(item.id, "Delivered")}>Mark delivered</button>}
        </td>
      </tr>
      {open && (
        <tr className="border-b border-slate-100 bg-slate-50">
          <td colSpan={6} className="whitespace-pre-wrap px-4 py-3 text-xs text-slate-600">{item.body}</td>
        </tr>
      )}
    </>
  );
}
