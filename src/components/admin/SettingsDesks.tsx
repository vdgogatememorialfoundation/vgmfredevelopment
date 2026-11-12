"use client";

import { deliveryDatePhrase } from "@/lib/delivery-expectation";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChangePasswordForm } from "@/components/account/PasswordResetForm";
import { getSession } from "@/lib/auth";
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
  type MessageCopy,
  type NotificationEventId,
  type CustomMessageTemplate,
  type OrderSettings,
  type ShippingProviderId,
  type WhatsAppTemplate, nextStoreWorkingDay, serverSavedSecrets } from "@/lib/integrations";
import { defaultMessageCopy } from "@/lib/message-templates";
import { ConnectionBadge } from "@/components/admin/AdminUI";
import { clearNotifications, deliver, eventLabel, getNotifications, markNotification, queueNotification, type NotificationRecord } from "@/lib/notify";
import { pushPaymentVault, testPaytmEdc, testRazorpay } from "@/lib/payments-client";
import { applyShiprocketWebhooks, fetchCourierRates, listPickupLocations, syncPickupAddress, testConfiguredShippingProviders, testShippingProvider, type RateQuote, connectGoswiftUpdates } from "@/lib/shipping-client";
import { ImageField } from "@/components/admin/ImageField";
import { fileToDataUrl } from "@/lib/images";
import { subscribeCms } from "@/lib/cms";
import { publishLiveSite } from "@/lib/mobile-publish";
import type { SiteChrome, SiteChromeLink, SiteSettings } from "@/types";
import { FOOTER_STYLES, HEADER_STYLES } from "@/lib/site-chrome";
import { SOCIAL_NETWORKS, emptySocial } from "@/lib/social";

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

const SettingsSaveContext = createContext<(() => void) | null>(null);

function SettingsSave({ save, children }: { save: () => void; children: ReactNode }) {
  return <SettingsSaveContext.Provider value={save}>{children}</SettingsSaveContext.Provider>;
}

function Card({ title, text, children, right, badge, onSave }: { title: string; text?: string; children: ReactNode; right?: ReactNode; badge?: ReactNode; onSave?: () => void }) {
  const contextSave = useContext(SettingsSaveContext);
  const save = onSave ?? contextSave;
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
      {save ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <button type="button" className={primary} onClick={save}>
            Save
          </button>
        </div>
      ) : null}
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

type PickupLocation = { nickname: string; city: string; pincode: string; phone?: string; address?: string };

export function GeneralSettingsDesk() {
  const [settings, setSettings] = useState<SiteSettings>(() => getSettings());
  const [note, setNote] = useState("");
  const set = (patch: Partial<SiteSettings>) => setSettings((current) => ({ ...current, ...patch }));
  const setChrome = (patch: Partial<SiteChrome>) => setSettings((current) => ({ ...current, chrome: { ...current.chrome, ...patch } }));
  const chrome = settings.chrome ?? {};

  const save = () => {
    try {
      const current = getSettings();
      saveSettings({
        ...current,
        ...pickGeneral(settings),
        apiKeys: {
          ...current.apiKeys,
          googleMaps: settings.apiKeys.googleMaps,
          googleAnalytics: settings.apiKeys.googleAnalytics,
        },
      });
      window.dispatchEvent(new Event("vgmf-cms"));
      void publishLiveSite();
      setNote(
        settings.maintenanceMode
          ? "Saved. Visitors now see the maintenance page; admins and staff still see the site."
          : "Saved. The logo and site details now load on phones and other devices."
      );
    } catch {
      setNote("Could not save: browser storage is full. Use a smaller logo.");
    }
  };

  const until = settings.maintenanceUntil ? Date.parse(settings.maintenanceUntil) : NaN;
  const preset = (minutes: number) => set({ maintenanceMode: true, maintenanceUntil: minutesFromNow(minutes) });

  const session = typeof window === "undefined" ? null : getSession();

  return (
    <div className="space-y-5">
      <Header title="General & maintenance" text="Site name, logo and contact details shown in the header and footer, and the maintenance switch with an automatic end time." action={<button type="button" className={primary} onClick={save}>Save settings</button>} />
      <Saved text={note} />
      <SettingsSave save={save}>
      <Card title="Branding" text="The logo replaces the Foundation badge in the header, footer, sign-in and maintenance pages.">
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

      <Card title="Social media" text="Footer always shows these icons. Paste an https URL to make an icon open that profile. Leave a field blank to keep the icon visible but inactive.">
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIAL_NETWORKS.map((network) => (
            <Text
              key={network.id}
              label={network.label}
              value={settings.social?.[network.id] ?? ""}
              placeholder={network.placeholder}
              onChange={(value) => set({ social: { ...emptySocial(), ...settings.social, [network.id]: value } })}
            />
          ))}
        </div>
      </Card>

      <Card title="Shloka strip" text="A slim line above the header for shlokas, quotes or a welcome. Put one per line; several lines take turns every few seconds. Saving publishes it with the rest of the site.">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={Boolean(settings.shlokaBar)} onChange={(event) => set({ shlokaBar: event.target.checked })} />
          Show the strip above the header
        </label>
        <textarea
          rows={4}
          className="mt-3 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-text-primary"
          placeholder={"सर्वे भवन्तु सुखिनः सर्वे सन्तु निरामयाः ।\nधर्मार्थकाममोक्षाणाम् आरोग्यं मूलमुत्तमम् ।"}
          value={(settings.shlokas ?? []).join("\n")}
          onChange={(event) => set({ shlokas: event.target.value.split("\n") })}
        />
      </Card>

      <Card title="WhatsApp query button" text="A round WhatsApp button on the right side of every public page. Visitors tap it to message this number. Saving publishes it with the rest of the site.">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={Boolean(settings.queryButton)} onChange={(event) => set({ queryButton: event.target.checked })} />
          Show the WhatsApp button
        </label>
        <label className="mt-3 block text-sm text-slate-700">
          WhatsApp number with country code
          <input
            className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-text-primary"
            placeholder="919876543210"
            inputMode="tel"
            value={settings.queryNumber ?? ""}
            onChange={(event) => set({ queryNumber: event.target.value })}
          />
        </label>
        <label className="mt-3 block text-sm text-slate-700">
          First message (optional)
          <input
            className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-text-primary"
            placeholder="Namaskar, I have a question about…"
            value={settings.queryMessage ?? ""}
            onChange={(event) => set({ queryMessage: event.target.value })}
          />
        </label>
      </Card>

      <Card title="Header & footer" text="Text, shape and extra navigation links for the public header and footer. Saving publishes it with the rest of the site.">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm text-slate-700">
            Header text (a slim line above the header; blank hides it)
            <input className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-text-primary" value={chrome.headerText ?? ""} onChange={(event) => setChrome({ headerText: event.target.value })} placeholder="Admissions open for Manas Rog 4" />
          </label>
          <label className="block text-sm text-slate-700">
            Header text link (optional)
            <input className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-text-primary" value={chrome.headerTextHref ?? ""} onChange={(event) => setChrome({ headerTextHref: event.target.value })} placeholder="/events or https://…" />
          </label>
          <label className="block text-sm text-slate-700">
            Header style
            <select className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-text-primary" value={chrome.headerStyle ?? "classic"} onChange={(event) => setChrome({ headerStyle: event.target.value })}>
              {HEADER_STYLES.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
            <input type="checkbox" checked={Boolean(chrome.headerSticky)} onChange={(event) => setChrome({ headerSticky: event.target.checked })} />
            Keep the header visible while scrolling
          </label>
          <LinksField label="Extra header menu links" links={chrome.navLinks} onChange={(navLinks) => setChrome({ navLinks })} />
          <LinksField label="Extra footer links" links={chrome.footerLinks} onChange={(footerLinks) => setChrome({ footerLinks })} />
          <label className="block text-sm text-slate-700">
            Footer text (replaces the line under the footer logo; blank keeps the default)
            <textarea rows={3} className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-text-primary" value={chrome.footerText ?? ""} onChange={(event) => setChrome({ footerText: event.target.value })} />
          </label>
          <div className="space-y-3">
            <label className="block text-sm text-slate-700">
              Footer note (small line under the copyright)
              <input className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-text-primary" value={chrome.footerNote ?? ""} onChange={(event) => setChrome({ footerNote: event.target.value })} />
            </label>
            <label className="block text-sm text-slate-700">
              Footer style
              <select className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-text-primary" value={chrome.footerStyle ?? "classic"} onChange={(event) => setChrome({ footerStyle: event.target.value })}>
                {FOOTER_STYLES.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </Card>

      <Card title="Announcement ticker" text="How fast the bar under the header moves. A lower number is faster. Saving publishes it with the rest of the site.">
        <label className="block text-sm text-slate-700">
          Speed · {Math.min(90, Math.max(12, settings.tickerSeconds || 36))} seconds for one pass
          <input
            type="range"
            min={12}
            max={90}
            step={2}
            className="mt-2 w-full"
            value={Math.min(90, Math.max(12, settings.tickerSeconds || 36))}
            onChange={(event) => set({ tickerSeconds: Number(event.target.value) })}
          />
        </label>
      </Card>

      <Card title="Product text sizes" text="Font sizes on shop product cards and the product page. Saving publishes them to the site and app.">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-slate-700">
            Product card · title · {settings.productText?.cardTitle || 14}px
            <input type="range" min={10} max={32} step={1} className="mt-2 w-full" value={settings.productText?.cardTitle || 14} onChange={(event) => set({ productText: { ...settings.productText, cardTitle: Number(event.target.value) } })} />
          </label>
          <label className="block text-sm text-slate-700">
            Product card · author / publisher · {settings.productText?.cardMeta || 12}px
            <input type="range" min={10} max={32} step={1} className="mt-2 w-full" value={settings.productText?.cardMeta || 12} onChange={(event) => set({ productText: { ...settings.productText, cardMeta: Number(event.target.value) } })} />
          </label>
          <label className="block text-sm text-slate-700">
            Product card · language · {settings.productText?.cardLanguage || 20}px
            <input type="range" min={10} max={32} step={1} className="mt-2 w-full" value={settings.productText?.cardLanguage || 20} onChange={(event) => set({ productText: { ...settings.productText, cardLanguage: Number(event.target.value) } })} />
          </label>
          <label className="block text-sm text-slate-700">
            Product card · price · {settings.productText?.cardPrice || 14}px
            <input type="range" min={10} max={32} step={1} className="mt-2 w-full" value={settings.productText?.cardPrice || 14} onChange={(event) => set({ productText: { ...settings.productText, cardPrice: Number(event.target.value) } })} />
          </label>
          <label className="block text-sm text-slate-700">
            Product page · language · {settings.productText?.pageLanguage || 24}px
            <input type="range" min={10} max={32} step={1} className="mt-2 w-full" value={settings.productText?.pageLanguage || 24} onChange={(event) => set({ productText: { ...settings.productText, pageLanguage: Number(event.target.value) } })} />
          </label>
        </div>
      </Card>

      <Card title="Google Maps" text="Used on clinics, events, live tracking and the analytics live map. Paste a Maps URL if you leave this blank.">
        <Secret
          label="Google Maps JavaScript API key"
          value={settings.apiKeys.googleMaps}
          onChange={(googleMaps) => set({ apiKeys: { ...settings.apiKeys, googleMaps } })}
        />
      </Card>

      <Card title="Google Analytics" text="GA4 measurement ID is injected on the public site. Visitor counts also appear under Reports → Analytics.">
        <Text
          label="GA4 measurement ID"
          value={settings.apiKeys.googleAnalytics ?? ""}
          placeholder="G-XXXXXXXXXX"
          onChange={(googleAnalytics) => set({ apiKeys: { ...settings.apiKeys, googleAnalytics } })}
        />
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
      </SettingsSave>
      {session?.role === "admin" ? (
        <Card title="Admin password" text="Administrators can reset their own password here." onSave={undefined}>
          <ChangePasswordForm email={session.email} />
        </Card>
      ) : null}
    </div>
  );
}

function pickGeneral(settings: SiteSettings): Partial<SiteSettings> {
  const { siteName, tagline, logoText, logoUrl, faviconUrl, supportEmail, supportPhone, maintenanceMode, maintenanceMessage, maintenanceUntil, social, tickerSeconds, shlokaBar, shlokas, queryButton, queryNumber, queryMessage, chrome } = settings;
  return { siteName, tagline, logoText, logoUrl, faviconUrl, supportEmail, supportPhone, maintenanceMode, maintenanceMessage, maintenanceUntil, social, tickerSeconds, shlokaBar, shlokas, queryButton, queryNumber, queryMessage, chrome };
}

/* ---------------- Payments ---------------- */

export function PaymentSettingsDesk() {
  const razorpay = useIntegrationSlice("razorpay");
  const paytm = useIntegrationSlice("paytm");
  const payu = useIntegrationSlice("payu");
  const easebuzz = useIntegrationSlice("easebuzz");
  const cashfree = useIntegrationSlice("cashfree");
  const phonepe = useIntegrationSlice("phonepe");
  const { value, setValue, note, setNote, save } = razorpay;
  const [busy, setBusy] = useState("");
  const set = (patch: Partial<typeof value>) => setValue({ ...value, ...patch });
  const setPaytm = (patch: Partial<typeof paytm.value>) => paytm.setValue({ ...paytm.value, ...patch });
  const hosted = [
    ["payu", "PayU", payu],
    ["easebuzz", "Easebuzz", easebuzz],
    ["cashfree", "Cashfree", cashfree],
    ["phonepe", "PhonePe", phonepe],
  ] as const;

  const saveAll = () => {
    save();
    paytm.save();
    payu.save();
    easebuzz.save();
    cashfree.save();
    phonepe.save();
    void pushPaymentVault().then(() => setNote("Saved. Checkout on other devices can use PayU, Easebuzz, Cashfree and PhonePe once each one is switched on and the keys are filled in."));
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
      <SettingsSave save={saveAll}>
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
          <Text label="Payment link valid for (minutes, 15 or more)" type="number" value={value.linkExpiryMinutes ?? 30} onChange={(minutes) => set({ linkExpiryMinutes: Math.max(15, Number(minutes) || 30) })} />
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
      <Card title="PayU, Easebuzz, Cashfree and PhonePe" text="Switch a gateway on, choose test or live, and save the merchant key. Checkout shows it after the keys are stored on this server. PhonePe uses the merchant id and salt. Cashfree uses the app id as the key and the secret as the salt.">
        <div className="space-y-6">
          {hosted.map(([id, label, slice]) => (
            <div key={id} className="rounded-xl border border-slate-200 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Check label={`Accept ${label}`} checked={slice.value.enabled} onChange={(enabled) => slice.setValue({ ...slice.value, enabled })} />
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Mode</span>
                  <select className={input} value={slice.value.mode} onChange={(event) => slice.setValue({ ...slice.value, mode: event.target.value === "live" ? "live" : "test" })}>
                    <option value="test">Test</option>
                    <option value="live">Live</option>
                  </select>
                </label>
                {id === "phonepe" ? (
                  <Text label="Merchant id" value={slice.value.merchantId} onChange={(merchantId) => slice.setValue({ ...slice.value, merchantId })} />
                ) : (
                  <Text label={id === "cashfree" ? "App id" : "Merchant key"} value={slice.value.key} onChange={(key) => slice.setValue({ ...slice.value, key })} />
                )}
                <Secret label={id === "cashfree" ? "Secret key" : "Salt"} value={slice.value.salt} onChange={(salt) => slice.setValue({ ...slice.value, salt })} />
                {id === "phonepe" && <Text label="Salt index" value={slice.value.saltIndex} onChange={(saltIndex) => slice.setValue({ ...slice.value, saltIndex })} />}
              </div>
            </div>
          ))}
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
      </SettingsSave>
    </div>
  );
}

/* ---------------- Email ---------------- */

async function sendTest(to: string, template: string, subject: string, phone?: string) {
  const record = queueNotification({ to, phone, name: "Test", params: ["Test", "FOUNDATION-TEST", "Test"], subject, template, body: "This is a test message from Vaidya Gogate Memorial Foundation." });
  if (!record) return "Nothing was queued. For WhatsApp, map a template to this event first.";
  for (let i = 0; i < 20; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const latest = getNotifications().filter((item) => item.sentAt === record.sentAt);
    if (latest.every((item) => item.status !== "Queued")) {
      return latest.map((item) => `${item.channel === "whatsapp" ? "WhatsApp" : item.channel === "sms" ? "SMS" : "Email"}: ${item.status}${item.error ? ` (${item.error})` : ""}`).join(" · ");
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
      <Header title="Email: Zoho CPaaS, ZeptoMail & Zoho Mail" text="Signup, login OTP and account emails go through this provider. The working India endpoint is POST https://cpaas.zoho.in/v1.1/email with Authorization: Zoho-enczapikey." action={<button type="button" className={primary} onClick={() => save()}>Save</button>} />
      <Saved text={note} />
      <SettingsSave save={save}>
      <Card title="Sender">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Provider</span>
            <select className={input} value={value.provider} onChange={(event) => set({ provider: event.target.value as typeof value.provider })}>
              <option value="cpaas">Zoho CPaaS email (cpaas.zoho.in)</option>
              <option value="zeptomail">ZeptoMail (api.zeptomail.*)</option>
              <option value="zoho">Zoho Mail (OAuth)</option>
            </select>
          </label>
          <Text label="From address" value={value.fromAddress} onChange={(fromAddress) => set({ fromAddress })} hint="Must be a verified sender domain." />
          <Text label="From name" value={value.fromName} onChange={(fromName) => set({ fromName })} />
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Zoho CPaaS / ZeptoMail token" text="Same Agent Send Mail token used by curl to https://cpaas.zoho.in/v1.1/email. Signup, OTP and account emails use this automatically after Save.">
          <div className="space-y-3">
            <Secret label="Send mail token" value={value.zeptoToken} placeholder="Zoho-enczapikey …" onChange={(zeptoToken) => set({ zeptoToken })} />
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Email API host</span>
              <select className={input} value={value.zeptoHost} onChange={(event) => set({ zeptoHost: event.target.value })}>
                <option value="cpaas.zoho.in">India CPaaS (cpaas.zoho.in)</option>
                <option value="cpaas.zoho.com">Global CPaaS (cpaas.zoho.com)</option>
                <option value="cpaas.zoho.eu">EU CPaaS (cpaas.zoho.eu)</option>
                <option value="api.zeptomail.in">ZeptoMail India (api.zeptomail.in)</option>
                <option value="api.zeptomail.com">ZeptoMail Global</option>
                <option value="api.zeptomail.eu">ZeptoMail EU</option>
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
              setNote(await sendTest(to, "zeptomail-test", "Foundation email test"));
              setBusy(false);
            }}
          >
            {busy ? "Sending…" : "Send test"}
          </button>
        </div>
      </Card>
      </SettingsSave>
    </div>
  );
}

/* ---------------- SMS / MSG91 ---------------- */

export function SmsSettingsDesk() {
  const { value, setValue, note, setNote, save } = useIntegrationSlice("sms");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof value>) => setValue({ ...value, ...patch });

  return (
    <div className="space-y-5">
      <Header
        title="SMS: MSG91"
        text="Used when SMS login is turned on under Registration settings. OTP is sent with the MSG91 OTP API. Ticket and order updates also go by SMS when MSG91 is on."
        action={<button type="button" className={primary} onClick={() => save()}>Save</button>}
      />
      <Saved text={note} />
      <SettingsSave save={save}>
        <Card title="Provider">
          <div className="grid gap-3 md:grid-cols-2">
            {([
              ["none", "Off", "No SMS is sent. Email OTP still works."],
              ["msg91", "MSG91", "OTP and transactional SMS through MSG91."],
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
        <Card title="MSG91 credentials" text="control.msg91.com → Authkey, sender ID and DLT OTP template. Turn on SMS login under Settings → Registration.">
          <div className="grid gap-3 sm:grid-cols-3">
            <Secret label="Auth key" value={value.msg91AuthKey} onChange={(msg91AuthKey) => set({ msg91AuthKey })} />
            <Text label="Sender ID" value={value.msg91SenderId} onChange={(msg91SenderId) => set({ msg91SenderId })} placeholder="VGMFIN" />
            <Text label="Default OTP template ID" value={value.msg91TemplateId} onChange={(msg91TemplateId) => set({ msg91TemplateId })} hint="Used when an event has no DLT template ID." />
          </div>
        </Card>
        <Card title="SMS template IDs" text="Optional MSG91 / DLT template ID for each automated SMS. Leave blank to use the default OTP template.">
          <div className="grid gap-3 md:grid-cols-2">
            {notificationEvents.map((item) => (
              <Text
                key={item.id}
                label={item.label}
                value={value.mapping?.[item.id] ?? ""}
                onChange={(next) => set({ mapping: { ...value.mapping, [item.id]: next } })}
                placeholder="DLT template ID"
              />
            ))}
          </div>
        </Card>
        <Card title="Send a test SMS">
          <div className="flex flex-wrap gap-2">
            <input className={`${input} max-w-sm`} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="91XXXXXXXXXX" />
            <button
              type="button"
              className={ghost}
              disabled={busy}
              onClick={async () => {
                save();
                setBusy(true);
                setNote(await sendTest("", "otp", "Foundation SMS test", phone));
                setBusy(false);
              }}
            >
              {busy ? "Sending…" : "Send test OTP SMS"}
            </button>
          </div>
        </Card>
      </SettingsSave>
    </div>
  );
}

/* ---------------- Firebase (push notifications) ---------------- */

function parseJson(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function FileField({ label, hint, accept, value, saved, onChange }: { label: string; hint: string; accept: string; value: string; saved?: boolean; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <input
        type="file"
        accept={accept}
        className="mb-2 block text-sm"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (file) onChange(await file.text());
        }}
      />
      <textarea
        className={`${input} h-28 font-mono text-xs`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={saved ? "Saved on the server. Upload or paste a new file to replace it." : "Upload the file or paste its contents"}
      />
      <span className="mt-1 block text-xs text-slate-500">{hint}</span>
    </label>
  );
}

export function FirebaseSettingsDesk() {
  const { value, setValue, note, setNote, save } = useIntegrationSlice("firebase");
  const set = (patch: Partial<typeof value>) => setValue({ ...value, ...patch });
  const keySaved = serverSavedSecrets().includes("firebase.serviceAccountSecret");
  const check = () => {
    if (value.serviceAccountSecret.trim()) {
      const key = parseJson(value.serviceAccountSecret);
      if (!key?.project_id || !key.client_email || !key.private_key) return "The service account key must be the JSON file from Firebase → Project settings → Service accounts → Generate new private key.";
    }
    if (value.androidConfig.trim() && !parseJson(value.androidConfig)?.project_info) return "google-services.json does not look right. Download it again from Firebase → Project settings → Your apps → Android.";
    if (value.iosConfig.trim() && !value.iosConfig.includes("GOOGLE_APP_ID")) return "GoogleService-Info.plist does not look right. Download it again from Firebase → Project settings → Your apps → iOS.";
    return "";
  };
  const submit = () => {
    const problem = check();
    if (problem) return setNote(problem);
    save();
  };
  const project = String(parseJson(value.serviceAccountSecret)?.project_id ?? "");

  return (
    <div className="space-y-5">
      <Header
        title="Firebase: app push notifications"
        text="Order-stage and other notifications are sent to the customer app through Firebase Cloud Messaging. The key is kept on the server and never shown again after saving."
        action={<button type="button" className={primary} onClick={submit}>Save</button>}
      />
      <Saved text={note} />
      <SettingsSave save={submit}>
        <Card title="Server key (sending)" text={keySaved || project ? `Status: ${project ? `key for project ${project} ready to save` : "key saved on the server"}. Push sending is on.` : "Status: no key yet. Push notifications are off until a key is saved."}>
          <FileField
            label="Service account key (.json)"
            accept=".json,application/json"
            hint="Firebase console → Project settings → Service accounts → Generate new private key."
            value={value.serviceAccountSecret}
            saved={keySaved}
            onChange={(serviceAccountSecret) => set({ serviceAccountSecret })}
          />
        </Card>
        <Card title="App files (used when the app is built)" text="Android package org.vaidyagogate.customer. For iPhone push, upload your APNs .p8 key in Firebase → Project settings → Cloud Messaging → Apple app configuration.">
          <div className="grid gap-4 md:grid-cols-2">
            <FileField label="Android: google-services.json" accept=".json,application/json" hint="Firebase → Project settings → Your apps → Android app." value={value.androidConfig} onChange={(androidConfig) => set({ androidConfig })} />
            <FileField label="iOS: GoogleService-Info.plist" accept=".plist" hint="Firebase → Project settings → Your apps → iOS app." value={value.iosConfig} onChange={(iosConfig) => set({ iosConfig })} />
          </div>
        </Card>
      </SettingsSave>
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
      <Header title="WhatsApp" text="Two business numbers stay live together. Chats on the Meta number are answered through Meta. Chats on the AiSensy number are answered through AiSensy. The choice below is only which line sends order and account alerts." action={<button type="button" className={primary} onClick={() => save()}>Save</button>} />
      <Saved text={note} />
      <SettingsSave save={save}>
      <Card title="Provider">
        <div className="grid gap-3 md:grid-cols-4">
          {([
            ["none", "Off", "Only email is sent."],
            ["meta", "Meta Cloud API", "Order alerts from the Meta number."],
            ["zoho", "Zoho CPaaS", "Zoho CPaaS WhatsApp channel."],
            ["aisensy", "AiSensy", "Order alerts from the AiSensy number."],
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
            <Text label="Meta WhatsApp number" value={value.metaDisplayNumber} onChange={(metaDisplayNumber) => set({ metaDisplayNumber })} placeholder="+91…" hint="The first business number. Customers who message this number are answered through Meta." />
            <Secret label="Access token" value={value.metaAccessToken} onChange={(metaAccessToken) => set({ metaAccessToken })} />
            <Secret label="App secret (optional)" value={value.metaAppSecret} onChange={(metaAppSecret) => set({ metaAppSecret })} />
            <Text label="Graph API version" value={value.metaApiVersion} onChange={(metaApiVersion) => set({ metaApiVersion })} />
            <Text label="Verify token" value={value.metaVerifyToken} onChange={(metaVerifyToken) => set({ metaVerifyToken })} hint="Type a private word, Save, then paste the same word into Meta → WhatsApp → Configuration." />
            <Text label="Reply template after 24 hours" value={value.metaReplyTemplate} onChange={(metaReplyTemplate) => set({ metaReplyTemplate })} placeholder="one variable, e.g. desk_reply" hint="Used when the customer has not written in the last 24 hours." />
            <button type="button" className={ghost} disabled={busy} onClick={sync}>{busy ? "Syncing…" : "Sync templates from Meta"}</button>
            <p className="text-xs text-slate-500">
              Callback URL for Meta App → WhatsApp → Configuration:{" "}
              <span className="font-mono break-all">{typeof window === "undefined" ? "/api/notify/webhook" : `${window.location.origin}/api/notify/webhook`}</span>
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
        <Card title="AiSensy" text="Manage → API Keys. The API key sends campaigns. The project id and app password let the desk reply in the 24-hour window.">
          <div className="space-y-3">
            <Secret label="API key" value={value.aisensyApiKey} onChange={(aisensyApiKey) => set({ aisensyApiKey })} />
            <Text label="Project ID" value={value.aisensyProjectId} onChange={(aisensyProjectId) => set({ aisensyProjectId })} />
            <Text label="AiSensy WhatsApp number" value={value.aisensyDisplayNumber} onChange={(aisensyDisplayNumber) => set({ aisensyDisplayNumber })} placeholder="+91…" hint="The second business number. Customers who message this number are answered through AiSensy." />
            <Secret label="Project app password" value={value.aisensyAppPassword} onChange={(aisensyAppPassword) => set({ aisensyAppPassword })} />
            <Text label="Reply campaign after 24 hours" value={value.aisensyReplyCampaign} onChange={(aisensyReplyCampaign) => set({ aisensyReplyCampaign })} placeholder="Live API campaign name" hint="The campaign template needs one variable. The desk reply is that variable." />
            <Text label="Webhook token (optional)" value={value.aisensyWebhookToken} onChange={(aisensyWebhookToken) => set({ aisensyWebhookToken })} hint="If set, AiSensy must call the URL below, which includes this token." />
            <p className="text-xs text-slate-500">
              Webhook URL for AiSensy → Manage → Webhooks:{" "}
              <span className="font-mono break-all">
                {typeof window === "undefined"
                  ? "/api/whatsapp/aisensy"
                  : `${window.location.origin}/api/whatsapp/aisensy${value.aisensyWebhookToken ? `?token=${encodeURIComponent(value.aisensyWebhookToken)}` : ""}`}
              </span>
            </p>
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
      </SettingsSave>
    </div>
  );
}

export function MessageTemplatesDesk() {
  const [messages, setMessages] = useState<Partial<Record<NotificationEventId, MessageCopy>>>(() => getIntegrations().messages ?? {});
  const [whatsapp, setWhatsapp] = useState(() => getIntegrations().whatsapp);
  const [sms, setSms] = useState(() => getIntegrations().sms);
  const [open, setOpen] = useState<NotificationEventId>("otp");
  const [customs, setCustoms] = useState<CustomMessageTemplate[]>(() => getIntegrations().customTemplates ?? []);
  const [openCustom, setOpenCustom] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const custom = customs.find((item) => item.id === openCustom) ?? null;
  const patchCustom = (patch: Partial<CustomMessageTemplate>) =>
    setCustoms((list) => list.map((item) => (item.id === openCustom ? { ...item, ...patch } : item)));
  const addCustom = () => {
    const id = `custom-${Date.now().toString(36)}`;
    setCustoms((list) => [
      ...list,
      {
        id,
        label: "New template",
        emailSubject: "A message from Vaidya Gogate Memorial Foundation",
        emailBody: "Dear {name},\n\nNamaste, and greetings from Vaidya Gogate Memorial Foundation.\n\n\n\nWith warm regards,\nVaidya Gogate Memorial Foundation",
        smsBody: "Vaidya Gogate Memorial Foundation: ",
        smsTemplateId: "",
        whatsappTemplate: "",
      },
    ]);
    setOpenCustom(id);
    setNote("New template added. Name it, fill the copy, then click Save templates.");
  };
  const removeCustom = () => {
    setCustoms((list) => list.filter((item) => item.id !== openCustom));
    setOpenCustom(null);
    setNote("Template removed. Click Save templates to keep this change.");
  };

  const save = () => {
    const current = getIntegrations();
    saveIntegrations({
      ...current,
      messages,
      customTemplates: customs.filter((item) => item.label.trim()),
      whatsapp: { ...current.whatsapp, mapping: whatsapp.mapping },
      sms: { ...current.sms, mapping: sms.mapping },
    });
    setNote("Templates saved. Signup, OTP and account emails use these copies.");
  };

  const restoreDefaults = () => {
    setMessages(defaultMessageCopy);
    setNote("Restored Vaidya Gogate Memorial Foundation greeting templates. Click Save templates to keep them.");
  };

  const copy = (id: NotificationEventId): MessageCopy => ({
    emailSubject: messages[id]?.emailSubject ?? defaultMessageCopy[id].emailSubject,
    emailBody: messages[id]?.emailBody ?? defaultMessageCopy[id].emailBody,
    smsBody: messages[id]?.smsBody ?? defaultMessageCopy[id].smsBody,
  });

  const setCopy = (id: NotificationEventId, patch: Partial<MessageCopy>) => {
    setMessages((current) => ({ ...current, [id]: { ...copy(id), ...patch } }));
  };

  const selected = copy(open);

  return (
    <div className="space-y-5">
      <Header
        title="Email, SMS and WhatsApp templates"
        text="Greet the customer by name and sign as Vaidya Gogate Memorial Foundation — not VGMF. Placeholders: {name} {code} {purpose} {email} {phone} {accountId} {signin} {orderId} {status} {amount} {link}."
        action={
          <span className="flex flex-wrap gap-2">
            <button type="button" className={ghost} onClick={restoreDefaults}>Restore Foundation defaults</button>
            <button type="button" className={primary} onClick={save}>Save templates</button>
          </span>
        }
      />
      <Saved text={note} />
      <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
        <Card title="Events">
          <div className="space-y-1">
            {notificationEvents.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${!custom && open === item.id ? "bg-burgundy/10 font-semibold text-burgundy" : "text-slate-700 hover:bg-slate-50"}`}
                onClick={() => { setOpen(item.id); setOpenCustom(null); }}
              >
                {item.label}
              </button>
            ))}
            <p className="px-3 pt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Your templates</p>
            {customs.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${openCustom === item.id ? "bg-burgundy/10 font-semibold text-burgundy" : "text-slate-700 hover:bg-slate-50"}`}
                onClick={() => setOpenCustom(item.id)}
              >
                {item.label || "Untitled template"}
              </button>
            ))}
            <button type="button" className={`${ghost} mt-2 w-full`} onClick={addCustom}>+ Add template</button>
          </div>
        </Card>
        {custom ? (
          <div className="space-y-5">
            <Card title="Template">
              <div className="space-y-3">
                <Text label="Template name" value={custom.label} onChange={(label) => patchCustom({ label })} />
                <button type="button" className={ghost} onClick={removeCustom}>Delete template</button>
              </div>
            </Card>
            <Card title="Email">
              <div className="space-y-3">
                <Text label="Email subject" value={custom.emailSubject} onChange={(emailSubject) => patchCustom({ emailSubject })} />
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Email body</span>
                  <textarea className={input} rows={10} value={custom.emailBody} onChange={(event) => patchCustom({ emailBody: event.target.value })} />
                </label>
              </div>
            </Card>
            <Card title="SMS">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">SMS body</span>
                <textarea className={input} rows={4} value={custom.smsBody} onChange={(event) => patchCustom({ smsBody: event.target.value })} />
              </label>
              <div className="mt-3">
                <Text label="MSG91 / DLT template ID (optional)" value={custom.smsTemplateId} onChange={(smsTemplateId) => patchCustom({ smsTemplateId })} />
              </div>
            </Card>
            <Card title="WhatsApp">
              <Text
                label="WhatsApp template / campaign / CPaaS alias"
                value={custom.whatsappTemplate}
                onChange={(whatsappTemplate) => patchCustom({ whatsappTemplate })}
                hint="Must match an approved template on Meta, Zoho CPaaS or AiSensy."
              />
            </Card>
          </div>
        ) : (
        <div className="space-y-5">
          <Card title={`${notificationEvents.find((item) => item.id === open)?.label} · Email`}>
            <div className="space-y-3">
              <Text label="Email subject" value={selected.emailSubject} onChange={(emailSubject) => setCopy(open, { emailSubject })} />
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Email body</span>
                <textarea className={input} rows={10} value={selected.emailBody} onChange={(event) => setCopy(open, { emailBody: event.target.value })} />
              </label>
            </div>
          </Card>
          <Card title="SMS">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">SMS body</span>
              <textarea className={input} rows={4} value={selected.smsBody} onChange={(event) => setCopy(open, { smsBody: event.target.value })} />
            </label>
            <div className="mt-3">
              <Text
                label="MSG91 / DLT template ID (optional)"
                value={sms.mapping?.[open] ?? ""}
                onChange={(next) => setSms({ ...sms, mapping: { ...sms.mapping, [open]: next } })}
              />
            </div>
          </Card>
          <Card title="WhatsApp">
            <Text
              label="WhatsApp template / campaign / CPaaS alias"
              value={whatsapp.mapping?.[open] ?? ""}
              onChange={(next) => setWhatsapp({ ...whatsapp, mapping: { ...whatsapp.mapping, [open]: next } })}
              hint="Must match an approved template on Meta, Zoho CPaaS or AiSensy."
            />
          </Card>
        </div>
        )}
      </div>
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

  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);
  const pickup = value.pickup;
  const setPickup = (patch: Partial<typeof pickup>) => set({ pickup: { ...pickup, ...patch } });
  const applyPickupLocation = (location: PickupLocation) =>
    setPickup({
      nickname: location.nickname,
      city: location.city || pickup.city,
      pincode: location.pincode || pickup.pincode,
      phone: location.phone || pickup.phone,
      line1: location.address || pickup.line1,
    });

  return (
    <div className="space-y-5">
      <Header
        title="Shipping APIs"
        text="Checkout and packing book the live account whose key is saved here. Tookan is offered for same-city tasks and for parcel deliveries. Shipday is offered for same-city deliveries. Shiprocket, Nimbuspost, iThink and Shipyaari are offered when their keys are saved. Staging and the live site do not create demo AWBs."
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
      <SettingsSave save={save}>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Shipday" text="docs.shipday.com — POST /orders to create, GET /orders to track, DELETE /orders/{id} to cancel. Authorization: Basic {API key}." badge={<ProviderStatus id="shipday" />} right={<Check label="Use" checked={value.shipday.enabled} onChange={(enabled) => set({ shipday: { ...value.shipday, enabled } })} />}>
          <div className="space-y-3">
            <Secret label="Shipday API key" value={value.shipday.apiKey} onChange={(apiKey) => set({ shipday: { ...value.shipday, apiKey } })} />
            <button type="button" className={primary} disabled={busy === "shipday"} onClick={() => test("shipday")}>{busy === "shipday" ? "Checking live…" : "Save & test"}</button>
          </div>
        </Card>
        <Card title="Courier website tracking" text="Orders sent with Amazon Shipping, Ekart, Delhivery, Blue Dart, DTDC, India Post and other couriers fetch their status from the courier's own tracking site. When a site gives no scans, this tracking service is asked instead." right={<Check label="Use" checked={value.tracker?.enabled !== false} onChange={(enabled) => set({ tracker: { ...(value.tracker ?? { service: "aftership", apiKey: "" }), enabled } })} />}>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Fallback tracking service
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                value={value.tracker?.service ?? "aftership"}
                onChange={(event) => set({ tracker: { ...(value.tracker ?? { apiKey: "", enabled: true }), service: event.target.value as "aftership" | "trackingmore" | "17track" } })}
              >
                <option value="aftership">AfterShip</option>
                <option value="trackingmore">TrackingMore</option>
                <option value="17track">17TRACK</option>
              </select>
            </label>
            <Secret label="Tracking service API key (optional)" value={value.tracker?.apiKey ?? ""} onChange={(apiKey) => set({ tracker: { ...(value.tracker ?? { service: "aftership", enabled: true }), apiKey } })} />
            <p className="text-xs text-slate-500">Status is checked again every few minutes while customers, support or admin view the order.</p>
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
        <Card title="Shipyaari" text="API key or email/password. Wallet is checked before every booking — low credits block the AWB." badge={<ProviderStatus id="shipyaari" />} right={<Check label="Use" checked={value.shipyaari.enabled} onChange={(enabled) => set({ shipyaari: { ...value.shipyaari, enabled } })} />}>
          <div className="space-y-3">
            <Secret label="API key" value={value.shipyaari.apiKey} onChange={(apiKey) => set({ shipyaari: { ...value.shipyaari, apiKey } })} />
            <Text label="Email (if no API key)" value={value.shipyaari.email} onChange={(email) => set({ shipyaari: { ...value.shipyaari, email } })} />
            <Secret label="Password" value={value.shipyaari.password} onChange={(password) => set({ shipyaari: { ...value.shipyaari, password } })} />
            <button type="button" className={primary} disabled={busy === "shipyaari"} onClick={() => test("shipyaari")}>{busy === "shipyaari" ? "Checking live…" : "Save & test"}</button>
          </div>
        </Card>
        <Card title="GoSwift" text="app.goswift.in/api/docs — client ID from Swift onboarding plus the API username and password. Books shipments, prints labels, tracks every scan and sends re-attempt or RTO requests for undelivered parcels. Swift has no rate API, so set the charge shown at checkout." badge={<ProviderStatus id="goswift" />} right={<Check label="Use" checked={value.goswift.enabled} onChange={(enabled) => set({ goswift: { ...value.goswift, enabled } })} />}>
          <div className="space-y-3">
            <Text label="Client ID" value={value.goswift.clientId} onChange={(clientId) => set({ goswift: { ...value.goswift, clientId } })} />
            <Text label="API username" value={value.goswift.username} onChange={(username) => set({ goswift: { ...value.goswift, username } })} />
            <Secret label="API password" value={value.goswift.password} onChange={(password) => set({ goswift: { ...value.goswift, password } })} />
            <Text label="Pickup address alias" value={value.goswift.pickupAlias} onChange={(pickupAlias) => set({ goswift: { ...value.goswift, pickupAlias } })} hint="As saved in the Swift dashboard. Leave blank to send the pickup address from Settings." />
            <Text label="Charge shown at checkout (₹)" value={value.goswift.rate} onChange={(rate) => set({ goswift: { ...value.goswift, rate } })} hint="Default ₹79" />
            <Text label="Delivery days shown" value={value.goswift.etaDays} onChange={(etaDays) => set({ goswift: { ...value.goswift, etaDays } })} hint="Default 4" />
            <Text label="Service" value={value.goswift.service} onChange={(service) => set({ goswift: { ...value.goswift, service: service.toUpperCase() } })} hint="SURFACE, EXPRESS, NDD or SDD" />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={primary} disabled={busy === "goswift"} onClick={() => test("goswift")}>{busy === "goswift" ? "Checking live…" : "Save & test"}</button>
              <button
                type="button"
                className={primary}
                disabled={busy === "goswift-hook"}
                onClick={async () => {
                  save();
                  setBusy("goswift-hook");
                  const result = await connectGoswiftUpdates().catch((error: Error) => ({ ok: false, error: error.message, message: "" }));
                  setBusy("");
                  setNote(result.ok ? `GoSwift: ${result.message}` : `GoSwift live updates failed: ${result.error}`);
                }}
              >
                {busy === "goswift-hook" ? "Connecting…" : "Connect live status updates"}
              </button>
            </div>
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
                setPickupLocations(result.locations ?? []);
                setNote(result.locations?.length ? `Shiprocket has ${result.locations.length} pickup address(es). Pick one below.` : "Shiprocket returned no pickup locations.");
              }}
            >
              List locations
            </button>
          </div>
        }
      >
        {pickupLocations.length ? (
          <div className="mb-4 space-y-2">
            <p className="text-sm font-medium text-text-primary">Pickup addresses on Shiprocket</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {pickupLocations.map((location) => (
                <button
                  key={location.nickname}
                  type="button"
                  onClick={() => applyPickupLocation(location)}
                  className={`rounded-xl border p-3 text-left text-sm ${location.nickname === pickup.nickname ? "border-burgundy bg-burgundy/5" : "border-border bg-white hover:border-burgundy"}`}
                >
                  <span className="block font-semibold text-text-primary">{location.nickname}{location.nickname === pickup.nickname ? " · in use" : ""}</span>
                  <span className="block text-text-muted">{[location.address, location.city, location.pincode].filter(Boolean).join(", ")}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
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
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Shipping label</span>
            <select className={input} value={value.labelSource ?? "aggregator"} onChange={(event) => set({ labelSource: event.target.value === "foundation" ? "foundation" : "aggregator" })}>
              <option value="aggregator">Aggregator label (Shiprocket, Nimbuspost, iThink, Shipyaari) when available</option>
              <option value="foundation">Foundation label for every courier</option>
            </select>
            <span className="mt-1 block text-xs text-slate-500">Aggregator labels print in the paper size set in that aggregator&apos;s panel (for Shiprocket: Settings → Label). Otherwise the Foundation label is printed.</span>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Foundation label paper</span>
            <select className={input} value={value.labelSize ?? "4x6"} onChange={(event) => set({ labelSize: event.target.value as typeof value.labelSize })}>
              <option value="printer">Choose paper in print dialog</option>
              <option value="4x6">4×6 in tag (thermal)</option>
              <option value="roll">Paper roll 80 mm</option>
              <option value="a5">A5 sheet</option>
              <option value="a4">A4 sheet</option>
            </select>
            <span className="mt-1 block text-xs text-slate-500">Default for every device. Each device can still pick a size next to the Print label button.</span>
          </label>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Text label="Minimum wallet (₹) to allow booking" type="number" value={value.minWalletRupees} onChange={(min) => set({ minWalletRupees: Number(min) || 0 })} hint="Shiprocket, Nimbuspost, iThink and Shipyaari bookings stop if credits are below this or below the courier rate." />
          <Text label="Hyperlocal map ping (seconds)" type="number" value={value.hyperlocalPingSeconds} onChange={(seconds) => set({ hyperlocalPingSeconds: Math.min(15, Math.max(8, Number(seconds) || 8)) })} hint="How often the live map asks Tookan or Shipday for the rider. 8 to 15 seconds." />
        </div>
        <div className="mt-4">
          <ImageField
            label="Rider bike icon"
            value={value.scooterImage}
            onChange={(scooterImage) => set({ scooterImage })}
            hint="Upload the bike picture. The live map uses it for the rider and turns it to follow the road."
          />
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
      </SettingsSave>
    </div>
  );
}

export function RatesTable({ quote, onPick, picked }: { quote: RateQuote; onPick?: (index: number) => void; picked?: number }) {
  const [pickupDay] = useState(() => new Date(nextStoreWorkingDay(Date.now())).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }));
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
              <span className="text-right text-slate-600">
                <span className="block">
                  {rate.etaDays} day{rate.etaDays === 1 ? "" : "s"} · <b>₹{Math.round(rate.rate)}</b>
                  {rate.rating ? <span className="ml-1 text-amber-600">★ {rate.rating}</span> : null}
                </span>
                <span className="block text-xs text-slate-500">
                  Pickup {pickupDay} · delivery {rate.deliverBy ? deliveryDatePhrase(rate.deliverBy) : `in ${rate.etaDays} day${rate.etaDays === 1 ? "" : "s"}`}
                </span>
              </span>
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
    setNote("Saving. Phones and other browsers will pick this up in a moment.");
    void publishLiveSite().then((result) => {
      setNote(
        result?.ok
          ? "Saved. Cash on delivery, shipping and pickup now load on phones and other browsers. Refresh those devices."
          : "Saved on this browser. Publish the site again so other devices receive cash on delivery and shipping."
      );
    });
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
      <Header title="Orders, returns & refunds" text="Customers cannot cancel or return. They may request a damaged-item replacement with photos. The desk cancels, modifies, refunds, opens a return, or places a free replacement." action={<button type="button" className={primary} onClick={save}>Save</button>} />
      <Saved text={note} />
      <SettingsSave save={save}>
      <Card title="Fulfilment options at checkout">
        <div className="grid gap-4 md:grid-cols-3">
          <Check label="Home delivery" checked={value.deliveryEnabled} onChange={(deliveryEnabled) => set({ deliveryEnabled })} />
          <Check label="Pickup from store (off: customers can't choose store pickup)" checked={value.pickupEnabled} onChange={(pickupEnabled) => set({ pickupEnabled })} />
          <Check label="Store pickup: show a ready date for in-stock items (off: no date; the desk marks it ready)" checked={value.pickupDates.inStock} onChange={(inStock) => set({ pickupDates: { ...value.pickupDates, inStock } })} />
          <Check label="Store pickup: show a ready date for pre-orders (off: no date; the desk marks it ready)" checked={value.pickupDates.preorder} onChange={(preorder) => set({ pickupDates: { ...value.pickupDates, preorder } })} />
          <Check label="Customer chooses the delivery partner" hint="Shows couriers and rates at checkout." checked={value.showCourierChoice} onChange={(showCourierChoice) => set({ showCourierChoice })} />
          <Check label="Hide Gogate Products-Tookan at checkout" checked={value.hideTookanAtCheckout} onChange={(hideTookanAtCheckout) => set({ hideTookanAtCheckout })} />
          <Check label="Hide Gogate Products-Shipday at checkout" checked={value.hideShipdayAtCheckout} onChange={(hideShipdayAtCheckout) => set({ hideShipdayAtCheckout })} />
          <Text label="Hide these couriers on the site (comma separated, e.g. Ekart, Xpressbees)" value={value.hiddenCouriers.join(",")} onChange={(text) => set({ hiddenCouriers: String(text).split(",") })} />
          <Text label="Courier charge buffer shown to customers (%)" type="number" value={value.courierMarkup.percent} onChange={(percent) => set({ courierMarkup: { ...value.courierMarkup, percent: Math.max(0, Number(percent) || 0) } })} />
          <Text label="Courier charge buffer shown to customers (₹ added)" type="number" value={value.courierMarkup.rupees} onChange={(rupees) => set({ courierMarkup: { ...value.courierMarkup, rupees: Math.max(0, Number(rupees) || 0) } })} />
          <Check label="Charge the highest courier rate" hint="Customers pay the highest rate among the available couriers for their pincode (packing included), so you can book any courier if the cheaper one doesn't pick up." checked={value.courierMarkup.chargeHighest} onChange={(chargeHighest) => set({ courierMarkup: { ...value.courierMarkup, chargeHighest } })} />
          <Text label="Minimum courier charge shown (₹)" type="number" value={value.courierMarkup.minimum} onChange={(minimum) => set({ courierMarkup: { ...value.courierMarkup, minimum: Math.max(0, Number(minimum) || 0) } })} />
          <Check label="Confirm in-stock orders automatically (off: every order waits as Awaiting confirmation for the desk)" checked={value.confirmMode !== "manual"} onChange={(auto) => set({ confirmMode: auto ? "auto" : "manual" })} />
          <Check label="Cash on delivery" checked={value.codEnabled} onChange={(codEnabled) => set({ codEnabled })} />
          <Check label="Coupons at checkout (customers can enter a coupon code)" checked={value.promoCodes.coupons} onChange={(coupons) => set({ promoCodes: { ...value.promoCodes, coupons } })} />
          <Check label="Gift cards at checkout (customers can redeem a gift card)" checked={value.promoCodes.giftCards} onChange={(giftCards) => set({ promoCodes: { ...value.promoCodes, giftCards } })} />
          <Check label="Hide delivery dates on the site (product cards, product page, bag, checkout and tracking until a courier is booked)" checked={value.hideDeliveryDates} onChange={(hideDeliveryDates) => set({ hideDeliveryDates })} />
          <Check label="Cash at Store (store pickup orders pay at the counter)" checked={value.cashAtStoreEnabled} onChange={(cashAtStoreEnabled) => set({ cashAtStoreEnabled })} />
          <Text label="Packing / processing time (hours)" type="number" value={value.processingHours} onChange={(hours) => set({ processingHours: Math.max(0, Number(hours) || 0) })} />
          <Text label="Dispatch cut-off (India time, HH:MM)" value={value.dispatchCutoff} onChange={(dispatchCutoff) => set({ dispatchCutoff })} />
          <Text label="Picker time per order (minutes)" type="number" value={value.pickSchedule.pickMinutes} onChange={(minutes) => set({ pickSchedule: { ...value.pickSchedule, pickMinutes: Math.max(1, Number(minutes) || 1) } })} />
          <Text label="Packer time per order (minutes)" type="number" value={value.pickSchedule.packMinutes} onChange={(minutes) => set({ pickSchedule: { ...value.pickSchedule, packMinutes: Math.max(1, Number(minutes) || 1) } })} />
          <div className="md:col-span-3 rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Picker / packer scans (ticked = required, unticked = optional)</p>
            <div className="grid gap-2 md:grid-cols-3">
              <Check label="Picker: order code" checked={value.scanRules.pick.orderCode} onChange={(orderCode) => set({ scanRules: { ...value.scanRules, pick: { ...value.scanRules.pick, orderCode } } })} />
              <Check label="Picker: product code / barcode" checked={value.scanRules.pick.productCode} onChange={(productCode) => set({ scanRules: { ...value.scanRules, pick: { ...value.scanRules.pick, productCode } } })} />
              <Check label="Picker: SKU" checked={value.scanRules.pick.sku} onChange={(sku) => set({ scanRules: { ...value.scanRules, pick: { ...value.scanRules.pick, sku } } })} />
              <Check label="Packer: box code" checked={value.scanRules.pack.boxCode} onChange={(boxCode) => set({ scanRules: { ...value.scanRules, pack: { ...value.scanRules.pack, boxCode } } })} />
              <Check label="Packer: order code" checked={value.scanRules.pack.orderCode} onChange={(orderCode) => set({ scanRules: { ...value.scanRules, pack: { ...value.scanRules.pack, orderCode } } })} />
              <Check label="Packer: SKU" checked={value.scanRules.pack.sku} onChange={(sku) => set({ scanRules: { ...value.scanRules, pack: { ...value.scanRules.pack, sku } } })} />
              <Check label="Packer: ISBN (books)" checked={value.scanRules.pack.isbn} onChange={(isbn) => set({ scanRules: { ...value.scanRules, pack: { ...value.scanRules.pack, isbn } } })} />
              <Check label="Packer: packing photos" checked={value.scanRules.pack.photos} onChange={(photos) => set({ scanRules: { ...value.scanRules, pack: { ...value.scanRules.pack, photos } } })} />
              <Check label="Packer: confirm items match description" checked={value.scanRules.pack.confirm} onChange={(confirm) => set({ scanRules: { ...value.scanRules, pack: { ...value.scanRules.pack, confirm } } })} />
            </div>
            <p className="mt-2 text-xs text-slate-500">Each copy is still counted once. Admin can skip any step on an order from the pick &amp; pack desk.</p>
          </div>
          <Check label="Saturday is a working day" hint="Off: Saturday orders are processed on the next working day." checked={value.workingDays.saturday} onChange={(saturday) => set({ workingDays: { ...value.workingDays, saturday } })} />
          <Check label="Sunday is a working day" hint="Off: Sunday orders are processed on the next working day." checked={value.workingDays.sunday} onChange={(sunday) => set({ workingDays: { ...value.workingDays, sunday } })} />
          <label className="block md:col-span-3">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Holidays (one date per line, YYYY-MM-DD)</span>
            <textarea
              className={input}
              rows={3}
              defaultValue={value.workingDays.holidays.join("\n")}
              placeholder={"2026-11-14\n2026-12-25"}
              onBlur={(event) => set({ workingDays: { ...value.workingDays, holidays: event.target.value.split(/[\s,]+/).map((day) => day.trim()).filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)) } })}
            />
            <span className="mt-1 block text-xs text-slate-500">Processing, store-pickup ready dates, courier pickups and every delivery date shown skip these days and the weekly offs.</span>
          </label>
          {value.codEnabled && <Text label="COD fee (₹)" type="number" value={value.codFee} onChange={(fee) => set({ codFee: Number(fee) || 0 })} />}
        </div>
      </Card>
      <Card title="Store pickup returns & pre-order payments" text="Pickup orders have no return or replacement unless switched on here. Pre-orders take an advance now (default 50%); the balance and courier charge are paid by payment link later.">
        <div className="grid gap-4 md:grid-cols-3">
          <Check label="Allow returns on store-pickup orders" checked={value.returns.pickupReturns} onChange={(pickupReturns) => set({ returns: { ...value.returns, pickupReturns } })} />
          <Check label="Allow replacements on store-pickup orders" checked={value.returns.pickupReplacement} onChange={(pickupReplacement) => set({ returns: { ...value.returns, pickupReplacement } })} />
          <div className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Pre-order payment</span>
            <p className="text-sm text-slate-700">Advance at checkout; the rest plus the courier charge is paid by payment link. Full payment and cash on delivery are not offered for pre-orders.</p>
          </div>
          <Check label="Show packing and delivery dates on pre-order tracking (off: shown only once a courier is booked)" checked={value.showPreorderStepDates} onChange={(showPreorderStepDates) => set({ showPreorderStepDates })} />
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Advance type</span>
            <select className={input} value={value.preorderPayment.advanceType} onChange={(event) => set({ preorderPayment: { ...value.preorderPayment, mode: "advance", advanceType: event.target.value === "amount" ? "amount" : "percent", advanceValue: event.target.value === "amount" ? 100 : 50 } })}>
              <option value="amount">Fixed ₹ per copy</option>
              <option value="percent">% of the order</option>
            </select>
          </label>
          {value.preorderPayment.advanceType === "amount" ? (
            <Text label="Advance per copy (₹)" type="number" value={value.preorderPayment.advanceValue} onChange={(amount) => set({ preorderPayment: { ...value.preorderPayment, mode: "advance", advanceType: "amount", advanceValue: Math.max(1, Math.round(Number(amount) || 100)) } })} />
          ) : (
            <Text label="Advance (%) — 1 to 99" type="number" value={value.preorderPayment.advanceValue} onChange={(amount) => set({ preorderPayment: { ...value.preorderPayment, mode: "advance", advanceType: "percent", advanceValue: Math.min(99, Math.max(1, Math.round(Number(amount) || 50))) } })} />
          )}
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Balance due</span>
                <select className={input} value={value.preorderPayment.balanceWhen} onChange={(event) => set({ preorderPayment: { ...value.preorderPayment, balanceWhen: event.target.value === "on_ready" ? "on_ready" : "before_dispatch" } })}>
                  <option value="before_dispatch">Before dispatch</option>
                  <option value="on_ready">When the item is ready</option>
                </select>
              </label>
        </div>
      </Card>
      <Card title="Order status names & extra tracking statuses" text="Rename any status or tracking step the customer sees (leave blank to keep the built-in name). Extra statuses are added by the desk from an order's Status box and show inside the chosen tracking step.">
        <div className="grid gap-3 md:grid-cols-3">
          {["Awaiting Confirmation", "Ordered", "Packed", "Shipped", "Out for Delivery", "Delivered", "Ready for Pickup", "Picked Up", "Failed", "Cancelled"].map((name) => (
            <Text key={name} label={name} placeholder={name} value={value.statusLabels[name] ?? ""} onChange={(text) => set({ statusLabels: { ...value.statusLabels, [name]: text } })} />
          ))}
        </div>
        <div className="mt-5 space-y-2">
          {value.customStatuses.map((row, index) => (
            <div key={row.id} className="flex flex-wrap items-end gap-2">
              <div className="min-w-56 flex-1">
                <Text label="Extra status" placeholder="e.g. Reached Pune hub" value={row.label} onChange={(label) => set({ customStatuses: value.customStatuses.map((item, at) => (at === index ? { ...item, label } : item)) })} />
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Shows under</span>
                <select className={input} value={row.stage} onChange={(event) => set({ customStatuses: value.customStatuses.map((item, at) => (at === index ? { ...item, stage: event.target.value } : item)) })}>
                  {[["ordered", "Ordered"], ["packed", "Packed"], ["shipped", "Shipped"], ["out", "Out for Delivery"], ["delivered", "Delivered"], ["ready", "Ready for Pickup"], ["picked", "Picked Up"]].map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
              </label>
              <button type="button" className="px-2 py-2 text-sm font-semibold text-red-600" onClick={() => set({ customStatuses: value.customStatuses.filter((_, at) => at !== index) })}>Remove</button>
            </div>
          ))}
          <button type="button" className={primary} onClick={() => set({ customStatuses: [...value.customStatuses, { id: String(Date.now()), label: "", stage: "shipped" }] })}>+ Add status</button>
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
          <Check label="Add a packing charge" hint="Added into the courier charge for normal orders and pre-orders (on a pre-order it joins the balance with the courier charge). Customers never see it on its own." checked={value.packingCharge.enabled} onChange={(enabled) => set({ packingCharge: { ...value.packingCharge, enabled } })} />
          {value.packingCharge.enabled && (
            <>
              <Text label="Packing charge (₹)" type="number" value={value.packingCharge.amount} onChange={(amount) => set({ packingCharge: { ...value.packingCharge, amount: Math.max(0, Number(amount) || 0) } })} />
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Packing charge per</span>
                <select className={input} value={value.packingCharge.per} onChange={(event) => set({ packingCharge: { ...value.packingCharge, per: event.target.value === "copy" ? "copy" : "order" } })}>
                  <option value="order">Order</option>
                  <option value="copy">Copy</option>
                </select>
              </label>
            </>
          )}
        </div>
      </Card>
      <Card title="Platform fee">
        <div className="grid gap-4 md:grid-cols-2">
          <Check label="Add a platform fee at checkout" hint="Charged once per order: with the pre-order advance, never again on the balance. Kept on refunds." checked={value.platformFee.enabled} onChange={(enabled) => set({ platformFee: { ...value.platformFee, enabled } })} />
          <Text label="Amount (₹)" type="number" value={value.platformFee.amount} onChange={(amount) => set({ platformFee: { ...value.platformFee, amount: Number(amount) || 0 } })} />
          <p className="text-sm text-slate-700">The platform fee is non-refundable for customers: it is kept on every cancellation, refund and return. To give it back on a particular order, tick "Also refund the platform fee" when you refund that order.</p>
        </div>
      </Card>
      <Card title="GST" text="Leave this off until the Foundation is GST compliant. Turning on GST adds it to checkout. Turning on invoices lets a customer print a GST invoice after payment.">
        <div className="grid gap-4 md:grid-cols-2">
          <Check label="Charge GST" checked={value.gst.enabled} onChange={(enabled) => set({ gst: { ...value.gst, enabled } })} />
          <Text label="GST rate (%)" type="number" value={value.gst.ratePercent} onChange={(rate) => set({ gst: { ...value.gst, ratePercent: Number(rate) || 0 } })} />
          <Check label="Issue a GST invoice" checked={value.gst.invoiceEnabled} onChange={(invoiceEnabled) => set({ gst: { ...value.gst, invoiceEnabled } })} />
          <Text label="Legal name on the invoice" value={value.gst.legalName} onChange={(legalName) => set({ gst: { ...value.gst, legalName } })} />
          <Text label="GSTIN" value={value.gst.gstin} onChange={(gstin) => set({ gst: { ...value.gst, gstin } })} />
          <Text label="State" value={value.gst.stateName} onChange={(stateName) => set({ gst: { ...value.gst, stateName } })} />
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Returns">
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Customer returns stay off. The desk can still open a return from an order.</p>
            <Check label="Accept customer returns" checked={false} onChange={() => set({ returns: { ...value.returns, enabled: false } })} />
            <Check label="Offer damaged-item replacements" checked={value.returns.replacementAllowed} onChange={(replacementAllowed) => set({ returns: { ...value.returns, replacementAllowed } })} />
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
            <Check label="Enable refunds" checked={value.refunds.enabled} onChange={(enabled) => set({ refunds: { ...value.refunds, enabled } })} />
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
            <p className="text-xs text-slate-500">Customers cannot cancel. The desk cancels from the order and the customer sees cancellation tracking.</p>
            <Check label="Customers can cancel" checked={false} onChange={() => set({ cancellation: { ...value.cancellation, enabled: false } })} />
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
      <Card title="Admin order actions">
        <p className="mb-3 text-sm text-slate-500">
          Customers cannot cancel or return. From the admin order desk you can cancel, modify, refund (full or partial), open a return, or place a free replacement — including after delivery.
        </p>
        <Check
          label="Admin can cancel, refund or replace even after delivery"
          checked={value.adminActions.processAfterDelivery}
          onChange={(processAfterDelivery) => set({ adminActions: { ...value.adminActions, processAfterDelivery } })}
        />
      </Card>
      </SettingsSave>
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
  const [draft, setDraft] = useState({ to: "", phone: "", subject: "", body: "", images: [] as string[] });
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
            <div className="sm:col-span-2 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Images</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className={input}
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    void Promise.all(files.slice(0, 6).map((file) => fileToDataUrl(file, 1000))).then((images) => {
                      setDraft((current) => ({ ...current, images: [...current.images, ...images].slice(0, 6) }));
                    });
                  }}
                />
                <span className="mt-1 block text-xs text-slate-500">Up to six images are embedded in the email.</span>
              </label>
              {draft.images.length > 0 ? (
                <ul className="flex flex-wrap gap-3">
                  {draft.images.map((src, index) => (
                    <li key={`${index}-${src.slice(0, 24)}`} className="relative h-20 w-28 overflow-hidden rounded-lg border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        className="absolute right-1 top-1 rounded bg-white/90 px-1 text-[10px] font-bold text-red-700"
                        onClick={() => setDraft((current) => ({ ...current, images: current.images.filter((_, itemIndex) => itemIndex !== index) }))}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              className={primary}
              onClick={() => {
                if (!draft.to || !draft.subject) return setNote("Add an email address and subject.");
                queueNotification({
                  to: draft.to,
                  phone: draft.phone || undefined,
                  subject: draft.subject,
                  body: draft.body,
                  template: "custom",
                  images: draft.images,
                  html: draft.images.length > 0,
                });
                setDraft({ to: "", phone: "", subject: "", body: "", images: [] });
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
          <option value="sms">SMS</option>
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
        <td className="py-2 text-xs">{item.channel === "whatsapp" ? "WhatsApp" : item.channel === "sms" ? "SMS" : "Email"}<span className="block text-slate-400">{item.provider}</span></td>
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

function LinksField({ label, links, onChange }: { label: string; links?: SiteChromeLink[]; onChange: (links: SiteChromeLink[]) => void }) {
  const [text, setText] = useState(() => (links ?? []).map((link) => `${link.label} | ${link.href}${link.newTab ? " | new tab" : ""}`).join("\n"));
  return (
    <label className="block text-sm text-slate-700">
      {label} — one per line: Label | /path or https://… | new tab (optional)
      <textarea
        rows={4}
        className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-text-primary"
        value={text}
        placeholder={"Autism programme | /autism\nSeminar site | https://seminar.vaidyagogate.org | new tab"}
        onChange={(event) => {
          setText(event.target.value);
          onChange(
            event.target.value
              .split("\n")
              .map((row) => row.split("|").map((part) => part.trim()))
              .filter(([name, href]) => name && href)
              .map(([name, href, tab]) => ({ label: name, href, newTab: /new/i.test(tab ?? "") }))
          );
        }}
      />
    </label>
  );
}
