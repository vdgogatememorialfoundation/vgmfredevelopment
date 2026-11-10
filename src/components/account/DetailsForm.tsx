import { useEffect, useState } from "react";
import { SALUTATIONS } from "@/lib/admin-store";
import { countryByCode } from "@/lib/geo";
import { usePlatformCountries } from "@/lib/use-platform-countries";
import { useSiteText } from "@/lib/use-site-text";
import { builtinField, type BuiltinKey } from "@/lib/site-extras";

interface DetailsFormProps {
  form: {
    salutation: string;
    firstName: string;
    middleName: string;
    lastName: string;
    email: string;
    phone: string;
    whatsapp: string;
    alternatePhone: string;
    birthDate?: string;
    extraFields?: string;
    country?: string;
    countryCode?: string;
  };
  onChange: (field: string, value: string) => void;
  onSubmit: () => void;
  busy?: boolean;
}

export default function DetailsForm({
  form,
  onChange,
  onSubmit,
  busy,
}: DetailsFormProps) {
  const [sameAsPhone, setSameAsPhone] = useState(true);
  const signup = useSiteText().signup;
  const f = (key: BuiltinKey) => builtinField(signup, key);
  const shown = (key: BuiltinKey) => f(key).mode !== "hidden";
  const opt = (key: BuiltinKey) => (f(key).mode === "optional" && !/optional/i.test(f(key).label) ? " (optional)" : "");
  const extra = readExtra(form.extraFields);
  const setExtra = (id: string, value: string) => onChange("extraFields", JSON.stringify({ ...extra, [id]: value }));
  const { countries, allowInternational } = usePlatformCountries();
  const country = countries.find((item) => item.code === form.countryCode) ?? countries[0] ?? countryByCode("IN");

  useEffect(() => {
    if (!countries.length) return;
    if (form.countryCode && countries.some((item) => item.code === form.countryCode)) return;
    onChange("countryCode", country.code);
    onChange("country", country.name);
  }, [countries, country.code, country.name, form.countryCode, onChange]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      noValidate
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {shown("salutation") ? <div>
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="salutation">
            {f("salutation").label}
          </label>
          <select
            id="salutation"
            value={form.salutation}
            onChange={(event) => onChange("salutation", event.target.value)}
            className="input-field"
          >
            {SALUTATIONS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div> : null}
        <div>
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="first-name">
            {f("firstName").label}
          </label>
          <input
            id="first-name"
            type="text"
            placeholder={f("firstName").placeholder}
            value={form.firstName}
            onChange={(event) => onChange("firstName", event.target.value)}
            required
            className="input-field"
          />
        </div>
        {shown("middleName") ? <div>
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="middle-name">
            {f("middleName").label}{opt("middleName")}
          </label>
          <input
            id="middle-name"
            type="text"
            placeholder={f("middleName").placeholder}
            value={form.middleName}
            onChange={(event) => onChange("middleName", event.target.value)}
            required={f("middleName").mode === "required"}
            className="input-field"
          />
        </div> : null}
        <div>
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="last-name">
            {f("lastName").label}
          </label>
          <input
            id="last-name"
            type="text"
            placeholder={f("lastName").placeholder}
            value={form.lastName}
            onChange={(event) => onChange("lastName", event.target.value)}
            required
            className="input-field"
          />
        </div>
      </div>

      <div className="mt-5">
        <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="email">
          {f("email").label}
        </label>
        <input
          id="email"
          type="email"
          placeholder={f("email").placeholder}
          value={form.email}
          onChange={(event) => onChange("email", event.target.value)}
          required
          className="input-field"
        />
      </div>

      <div className="mt-5">
        <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="country">
          Country
        </label>
        <select
          id="country"
          value={country.code}
          onChange={(event) => {
            const next = countryByCode(event.target.value);
            onChange("countryCode", next.code);
            onChange("country", next.name);
          }}
          className="input-field"
        >
          {countries.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name} ({item.dial})
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-text-muted">
          {allowInternational
            ? "International customers can create an account with their local phone number and country."
            : "New accounts are currently open for India only."}
        </p>
      </div>

      <div className="mt-5">
        <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="phone">
          {f("phone").label} {allowInternational ? "(international)" : ""}
        </label>
        <input
          id="phone"
          type="tel"
          placeholder={f("phone").placeholder || `${country.dial} 98765 43210`}
          value={form.phone}
          onChange={(event) => {
            onChange("phone", event.target.value);
            onChange("whatsapp", event.target.value);
            if (sameAsPhone) onChange("alternatePhone", event.target.value);
          }}
          required
          className="input-field"
        />
      </div>

      {shown("alternatePhone") ? <div className="mt-5">
        <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="alternate-phone">
          {f("alternatePhone").label}{opt("alternatePhone")}
        </label>
        <input
          id="alternate-phone"
          type="tel"
          placeholder={f("alternatePhone").placeholder || `${country.dial} 98765 43210`}
          value={form.alternatePhone}
          onChange={(event) => {
            setSameAsPhone(false);
            onChange("alternatePhone", event.target.value);
          }}
          disabled={sameAsPhone}
          className="input-field disabled:bg-paper"
        />
        <label className="mt-3 flex items-start gap-3 text-sm text-text-muted">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-border"
            checked={sameAsPhone}
            onChange={(event) => {
              const checked = event.target.checked;
              setSameAsPhone(checked);
              if (checked) onChange("alternatePhone", form.phone);
            }}
          />
          <span>Same as the phone number above</span>
        </label>
      </div> : null}

      <div className="mt-5">
        {shown("whatsapp") ? <>
        <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="whatsapp">
          {f("whatsapp").label}{opt("whatsapp")}
        </label>
        <input
          id="whatsapp"
          type="tel"
          placeholder={f("whatsapp").placeholder || `${country.dial} 98765 43210`}
          value={form.whatsapp}
          onChange={(event) => onChange("whatsapp", event.target.value)}
          required={f("whatsapp").mode === "required"}
          className="input-field"
        />
        </> : null}

        <p className="mt-2 text-xs text-text-muted">
          We use this number for order and ticket updates. One email and phone can create only one account.
        </p>
      </div>

      {signup?.birthDate !== "hidden" ? (
        <div className="mt-5">
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="birth-date">
            Date of birth{signup?.birthDate === "required" ? "" : " (optional)"}
          </label>
          <input
            id="birth-date"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={form.birthDate ?? ""}
            onChange={(event) => onChange("birthDate", event.target.value)}
            className="input-field"
          />
          <p className="mt-2 text-xs text-text-muted">We send you a birthday wish.</p>
        </div>
      ) : null}

      {(signup?.fields ?? [])
        .filter((field) => field.enabled)
        .map((field) => (
          <div key={field.id} className="mt-5">
            <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor={`extra-${field.id}`}>
              {field.label}
              {field.required ? "" : " (optional)"}
            </label>
            {field.type === "textarea" ? (
              <textarea
                id={`extra-${field.id}`}
                rows={3}
                placeholder={field.placeholder}
                value={extra[field.id] ?? ""}
                onChange={(event) => setExtra(field.id, event.target.value)}
                className="input-field"
              />
            ) : field.type === "select" ? (
              <select
                id={`extra-${field.id}`}
                value={extra[field.id] ?? ""}
                onChange={(event) => setExtra(field.id, event.target.value)}
                className="input-field"
              >
                <option value="">Select</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : (
              <input
                id={`extra-${field.id}`}
                type={field.type}
                placeholder={field.placeholder}
                value={extra[field.id] ?? ""}
                onChange={(event) => setExtra(field.id, event.target.value)}
                className="input-field"
              />
            )}
          </div>
        ))}

      <label className="mt-6 flex items-start gap-3 text-sm text-text-muted">
        <input
          type="checkbox"
          required
          className="mt-1 h-4 w-4 rounded border-border"
        />
        <span>
          {signup?.terms || "I agree to the Foundation\u2019s Terms, Privacy Policy (including cookies) and store policies. An acknowledgement with a Form ID is kept on record."}
        </span>
      </label>

      <button type="submit" className="btn-primary mt-7 w-full" disabled={busy}>
        {busy ? "Checking…" : signup?.submit || "Continue & Verify"}
      </button>
    </form>
  );
}

function readExtra(raw?: string): Record<string, string> {
  try {
    const value = JSON.parse(raw || "{}") as unknown;
    return value && typeof value === "object" ? (value as Record<string, string>) : {};
  } catch {
    return {};
  }
}
