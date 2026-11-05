"use client";

import { useState, type ReactNode } from "react";
import { publishLiveSite } from "@/lib/mobile-publish";
import { uploadMediaFile } from "@/lib/media-client";
import { getSiteText, saveSiteText } from "@/lib/site-text";
import {
  BUILTIN_FIELDS,
  normalizeBirthday,
  normalizeSignup,
  reelEmbed,
  type BirthdayControls,
  type BuiltinField,
  type BuiltinKey,
  type LoginCopy,
  type InstagramReel,
  type SignupControls,
  type SignupField,
  type SiteDisclaimer,
} from "@/lib/site-extras";

const input = "mt-1 w-full rounded-lg border border-border bg-white px-2 py-1.5 text-sm text-ink";
const small = "rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-semibold text-ink hover:bg-paper";
const newId = () => String(Date.now());

function Card({ title, help, children }: { title: string; help: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-white p-4">
      <h2 className="font-serif text-lg text-ink">{title}</h2>
      <p className="mt-1 text-sm text-text-muted">{help}</p>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function SiteExtrasDesk() {
  const start = getSiteText();
  const [disclaimers, setDisclaimers] = useState<SiteDisclaimer[]>(start.disclaimers ?? []);
  const [reels, setReels] = useState<InstagramReel[]>(start.reels ?? []);
  const [reelNote, setReelNote] = useState("");
  const [signup, setSignup] = useState<SignupControls>(normalizeSignup(start.signup));
  const [birthday, setBirthday] = useState<BirthdayControls>(normalizeBirthday(start.birthday));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const patchField = (id: string, patch: Partial<SignupField>) =>
    setSignup((current) => ({ ...current, fields: current.fields.map((field) => (field.id === id ? { ...field, ...patch } : field)) }));

  function save() {
    setBusy(true);
    saveSiteText({ ...getSiteText(), disclaimers, reels, signup, birthday });
    void publishLiveSite().then((result) => {
      setBusy(false);
      setNote(result.ok ? "Saved and published to the website and app." : "Saved in this browser. Publishing did not complete; save again to retry.");
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl text-ink">Disclaimers, reels, signup &amp; birthdays</h1>
        <p className="mt-1 text-sm text-text-muted">Changes go live on the website and mobile app when you save.</p>
      </div>

      <Card title="Disclaimers" help="Choose where each one shows: at the top of every public page, at the bottom above the copyright line, or both.">
        {disclaimers.map((row, index) => (
          <div key={row.id} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <input type="checkbox" checked={row.enabled} onChange={(event) => setDisclaimers((list) => list.map((item, i) => (i === index ? { ...item, enabled: event.target.checked } : item)))} />
                Show
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">Position
                <select className="rounded-lg border border-border bg-white px-2 py-1 text-sm" value={row.placement ?? "bottom"} onChange={(event) => setDisclaimers((list) => list.map((item, i) => (i === index ? { ...item, placement: event.target.value as SiteDisclaimer["placement"] } : item)))}>
                  <option value="top">Top of page</option>
                  <option value="bottom">Bottom of page</option>
                  <option value="both">Top and bottom</option>
                </select>
              </label>
              <button type="button" className="ml-auto text-sm font-semibold text-red-700" onClick={() => setDisclaimers((list) => list.filter((_, i) => i !== index))}>Remove</button>
            </div>
            <label className="mt-2 block text-xs text-text-muted">Heading
              <input className={input} value={row.title} onChange={(event) => setDisclaimers((list) => list.map((item, i) => (i === index ? { ...item, title: event.target.value } : item)))} />
            </label>
            <label className="mt-2 block text-xs text-text-muted">Text
              <textarea rows={3} className={input} value={row.body} onChange={(event) => setDisclaimers((list) => list.map((item, i) => (i === index ? { ...item, body: event.target.value } : item)))} />
            </label>
          </div>
        ))}
        <button type="button" className={small} onClick={() => setDisclaimers((list) => [...list, { id: newId(), title: "", body: "", enabled: true, placement: "bottom" }])}>+ Add disclaimer</button>
      </Card>

      <Card title="Reels" help="Upload a video file, or paste an Instagram, YouTube or Facebook link to embed it. They show in the reels section on the homepage; move or hide that section under Colours & site text.">
        {reels.map((row, index) => (
          <div key={row.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
            <div className="text-xs text-text-muted">
              <label className="block">Video link
                <input className={input} value={row.url} placeholder="Instagram / YouTube / Facebook link" onChange={(event) => setReels((list) => list.map((item, i) => (i === index ? { ...item, url: event.target.value } : item)))} />
              </label>
              <label className="mt-2 block">…or upload a video
                <input type="file" accept="video/mp4,video/webm,video/quicktime" className="mt-1 block text-xs" onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setReelNote("Uploading…");
                  try {
                    const url = await uploadMediaFile(file);
                    setReels((list) => list.map((item, i) => (i === index ? { ...item, video: url } : item)));
                    setReelNote("Video uploaded. Save to publish it.");
                  } catch (error) {
                    setReelNote(error instanceof Error ? error.message : "Upload failed.");
                  }
                }} />
              </label>
              {row.video ? (
                <p className="mt-1 text-ink">Uploaded video set. <button type="button" className="font-semibold text-red-700" onClick={() => setReels((list) => list.map((item, i) => (i === index ? { ...item, video: undefined } : item)))}>Remove video</button></p>
              ) : null}
            </div>
            <label className="text-xs text-text-muted">Caption (optional)
              <input className={input} value={row.caption ?? ""} onChange={(event) => setReels((list) => list.map((item, i) => (i === index ? { ...item, caption: event.target.value } : item)))} />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={row.enabled} onChange={(event) => setReels((list) => list.map((item, i) => (i === index ? { ...item, enabled: event.target.checked } : item)))} />
              Show
            </label>
            <button type="button" className="text-sm font-semibold text-red-700" onClick={() => setReels((list) => list.filter((_, i) => i !== index))}>Remove</button>
            {(row.url || row.video) && !reelEmbed(row) ? <p className="text-xs text-red-700 sm:col-span-4">This link can&apos;t be embedded; use an Instagram, YouTube or Facebook link, or upload the video.</p> : null}
          </div>
        ))}
        <button type="button" className={small} onClick={() => setReels((list) => [...list, { id: newId(), url: "", enabled: true }])}>+ Add reel</button>
        {reelNote ? <p className="text-xs text-text-muted">{reelNote}</p> : null}
      </Card>

      <Card title="Login form" help="Leave a box empty to keep the standard wording.">
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            ["heading", "Heading", "Welcome back"],
            ["intro", "Intro text (password sign-in)", "Sign in with your Foundation website password…"],
            ["identifierLabel", "Account field label", "Email, Phone or Account ID"],
            ["identifierPlaceholder", "Account field placeholder", "name@example.com / +91 98765 43210 / 12-digit Account ID"],
            ["passwordLabel", "Password label", "Password"],
            ["passwordPlaceholder", "Password placeholder", "Your password"],
            ["button", "Sign-in button text", "Sign in"],
          ] as [keyof LoginCopy, string, string][]).map(([key, label, hint]) => (
            <label key={key} className={`block text-xs text-text-muted${key === "intro" ? " sm:col-span-2" : ""}`}>{label}
              <input className={input} value={signup.login?.[key] ?? ""} placeholder={hint} onChange={(event) => setSignup((current) => ({ ...current, login: { ...current.login, [key]: event.target.value } }))} />
            </label>
          ))}
        </div>
      </Card>

      <Card title="Signup form" help="Change the label, placeholder and whether each standard field is asked. First/last name, email and phone are always required. Add your own questions below; answers are saved on the account.">
        <div className="space-y-2">
          {BUILTIN_FIELDS.map((base) => {
            const row = signup.builtins?.[base.key] ?? {};
            const patch = (next: Partial<BuiltinField>) => setSignup((current) => ({ ...current, builtins: { ...current.builtins, [base.key as BuiltinKey]: { ...current.builtins?.[base.key as BuiltinKey], ...next } } }));
            return (
              <div key={base.key} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-3 sm:items-end">
                <label className="text-xs text-text-muted">{base.label} — label
                  <input className={input} value={row.label ?? ""} placeholder={base.label} onChange={(event) => patch({ label: event.target.value })} />
                </label>
                <label className="text-xs text-text-muted">Placeholder
                  <input className={input} value={row.placeholder ?? ""} placeholder={base.placeholder || "—"} onChange={(event) => patch({ placeholder: event.target.value })} />
                </label>
                <label className="text-xs text-text-muted">Asked
                  {base.fixed ? (
                    <span className="mt-1 block py-1.5 text-sm text-ink">Always, required</span>
                  ) : (
                    <select className={input} value={row.mode ?? (base.key === "whatsapp" ? "required" : "optional")} onChange={(event) => patch({ mode: event.target.value as BuiltinField["mode"] })}>
                      <option value="optional">Ask, optional</option>
                      <option value="required">Ask, required</option>
                      <option value="hidden">Don&apos;t ask</option>
                    </select>
                  )}
                </label>
              </div>
            );
          })}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs text-text-muted">Terms checkbox text
            <input className={input} value={signup.terms ?? ""} placeholder="I agree to the Foundation's terms and privacy policy." onChange={(event) => setSignup((current) => ({ ...current, terms: event.target.value }))} />
          </label>
          <label className="block text-xs text-text-muted">Signup button text
            <input className={input} value={signup.submit ?? ""} placeholder="Create account" onChange={(event) => setSignup((current) => ({ ...current, submit: event.target.value }))} />
          </label>
        </div>
        <label className="block text-xs text-text-muted">Date of birth
          <select className={input} value={signup.birthDate} onChange={(event) => setSignup((current) => ({ ...current, birthDate: event.target.value as SignupControls["birthDate"] }))}>
            <option value="optional">Ask, optional</option>
            <option value="required">Ask, required</option>
            <option value="hidden">Don&apos;t ask</option>
          </select>
        </label>
        {signup.fields.map((field) => (
          <div key={field.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-4 sm:items-end">
            <label className="text-xs text-text-muted sm:col-span-2">Question
              <input className={input} value={field.label} onChange={(event) => patchField(field.id, { label: event.target.value })} />
            </label>
            <label className="text-xs text-text-muted">Answer type
              <select className={input} value={field.type} onChange={(event) => patchField(field.id, { type: event.target.value as SignupField["type"] })}>
                <option value="text">Short text</option>
                <option value="textarea">Long text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="select">Choose from a list</option>
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-3 text-sm text-ink">
              <label className="flex items-center gap-1"><input type="checkbox" checked={field.required} onChange={(event) => patchField(field.id, { required: event.target.checked })} />Required</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={field.enabled} onChange={(event) => patchField(field.id, { enabled: event.target.checked })} />Show</label>
              <button type="button" className="font-semibold text-red-700" onClick={() => setSignup((current) => ({ ...current, fields: current.fields.filter((item) => item.id !== field.id) }))}>Remove</button>
            </div>
            {field.type === "select" ? (
              <label className="text-xs text-text-muted sm:col-span-4">Choices, one per line
                <textarea rows={3} className={input} value={(field.options ?? []).join("\n")} onChange={(event) => patchField(field.id, { options: event.target.value.split("\n") })} />
              </label>
            ) : null}
          </div>
        ))}
        <button type="button" className={small} onClick={() => setSignup((current) => ({ ...current, fields: [...current.fields, { id: `f${newId()}`, label: "", type: "text", required: false, enabled: true }] }))}>+ Add question</button>
      </Card>

      <Card title="Birthday wishes" help="On a member's birthday (India time) their dashboard shows this wish, and an email goes out once that morning. Use {name} for the first name.">
        <label className="flex items-center gap-2 text-sm font-semibold text-ink">
          <input type="checkbox" checked={birthday.enabled} onChange={(event) => setBirthday((current) => ({ ...current, enabled: event.target.checked }))} />
          Wish members on their birthday
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={birthday.email} onChange={(event) => setBirthday((current) => ({ ...current, email: event.target.checked }))} />
          Also send a birthday email
        </label>
        <label className="block text-xs text-text-muted">Message
          <textarea rows={3} className={input} value={birthday.message} onChange={(event) => setBirthday((current) => ({ ...current, message: event.target.value }))} />
        </label>
      </Card>

      <button type="button" className="rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} onClick={save}>
        {busy ? "Saving…" : "Save and publish"}
      </button>
      {note ? <p className="text-sm text-text-muted">{note}</p> : null}
    </div>
  );
}
