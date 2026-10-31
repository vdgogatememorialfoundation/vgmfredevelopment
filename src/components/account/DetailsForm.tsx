import { useEffect, useState } from "react";
import { SALUTATIONS } from "@/lib/admin-store";
import { countryByCode } from "@/lib/geo";
import { usePlatformCountries } from "@/lib/use-platform-countries";

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
        <div>
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="salutation">
            Salutation
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
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="first-name">
            First Name
          </label>
          <input
            id="first-name"
            type="text"
            placeholder="Enter first name"
            value={form.firstName}
            onChange={(event) => onChange("firstName", event.target.value)}
            required
            className="input-field"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="middle-name">
            Middle Name
          </label>
          <input
            id="middle-name"
            type="text"
            placeholder="Optional"
            value={form.middleName}
            onChange={(event) => onChange("middleName", event.target.value)}
            className="input-field"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="last-name">
            Last Name
          </label>
          <input
            id="last-name"
            type="text"
            placeholder="Enter last name"
            value={form.lastName}
            onChange={(event) => onChange("lastName", event.target.value)}
            required
            className="input-field"
          />
        </div>
      </div>

      <div className="mt-5">
        <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="email">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          placeholder="name@example.com"
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
          Phone Number {allowInternational ? "(international)" : ""}
        </label>
        <input
          id="phone"
          type="tel"
          placeholder={`${country.dial} 98765 43210`}
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

      <div className="mt-5">
        <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="alternate-phone">
          Alternate phone number
        </label>
        <input
          id="alternate-phone"
          type="tel"
          placeholder={`${country.dial} 98765 43210`}
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
      </div>

      <div className="mt-5">
        <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="whatsapp">
          WhatsApp Number
        </label>
        <input
          id="whatsapp"
          type="tel"
          placeholder={`${country.dial} 98765 43210`}
          value={form.whatsapp}
          onChange={(event) => onChange("whatsapp", event.target.value)}
          required
          className="input-field"
        />

        <p className="mt-2 text-xs text-text-muted">
          We use this number for order and ticket updates. One email and phone can create only one account.
        </p>
      </div>

      <label className="mt-6 flex items-start gap-3 text-sm text-text-muted">
        <input
          type="checkbox"
          required
          className="mt-1 h-4 w-4 rounded border-border"
        />
        <span>
          I agree to the Foundation&apos;s terms and privacy policy.
        </span>
      </label>

      <button type="submit" className="btn-primary mt-7 w-full" disabled={busy}>
        {busy ? "Checking…" : "Continue & Verify"}
      </button>
    </form>
  );
}
