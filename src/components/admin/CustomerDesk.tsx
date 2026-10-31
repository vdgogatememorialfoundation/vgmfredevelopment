"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  adjustStoreCredit,
  createCustomerAccount,
  displayName,
  ensureBootstrapped,
  getStoreCredit,
  getStoreCreditLedger,
  SALUTATIONS,
  sendAccountDetails,
  setAccountStatus,
  updateCustomer,
} from "@/lib/admin-store";
import { useAccounts } from "@/lib/use-cms";
import { matchesAccountQuery } from "@/lib/account-search";
import type { AccountStatus, User } from "@/types";
import { Button, EmptyState, Field, Panel, SelectInput, TextInput } from "@/components/admin/AdminUI";
import { AdminModal } from "@/components/admin/AdminModal";
import { PartnerPortalBadges } from "@/components/account/PartnerPortalBadges";
import { COUNTRIES, countryByCode, isIndia, isValidPhone, statesFor } from "@/lib/geo";
import { fetchPostalPlace, postalLooksComplete } from "@/lib/postal-lookup";

ensureBootstrapped();

const emptyForm = {
  salutation: "Dr.",
  firstName: "",
  middleName: "",
  lastName: "",
  phone: "",
  alternatePhone: "",
  email: "",
  line1: "",
  landmark: "",
  city: "",
  state: "Maharashtra",
  pincode: "",
  country: "India",
  countryCode: "IN",
};

export function CustomerDesk() {
  const accounts = useAccounts().filter((account) => {
    if (account.role === "admin" || account.role === "coadmin" || account.role === "staff") return false;
    return !account.role || account.role === "customer" || account.role === "doctor" || Boolean(account.partnerPortals?.length);
  });
  const [query, setQuery] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const shown = useMemo(
    () => accounts.filter((account) => matchesAccountQuery(account, query)),
    [accounts, query]
  );

  const selected = accounts.find((account) => account.email === selectedEmail);

  const create = () => {
    setError("");
    try {
      if (!isValidPhone(form.phone) || (form.alternatePhone && !isValidPhone(form.alternatePhone))) {
        setError("Enter a valid international phone number, including the country code.");
        return;
      }
      const created = createCustomerAccount({
        salutation: form.salutation,
        firstName: form.firstName,
        middleName: form.middleName,
        lastName: form.lastName,
        phone: form.phone,
        alternatePhone: form.alternatePhone || form.phone,
        email: form.email,
        address: {
          line1: form.line1,
          landmark: form.landmark,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          country: form.country,
          countryCode: form.countryCode,
        },
      });
      setNote(`Created Account ID ${created.accountId}. Login details were emailed to ${created.email}.`);
      setForm(emptyForm);
      setCreating(false);
      setSelectedEmail(created.email);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not create the account.");
    }
  };

  const selectedEmails = Object.entries(picked).filter(([, on]) => on).map(([email]) => email);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Customers</h1>
          <p className="text-sm text-text-muted">
            Seminar doctors, Autism applicants, Fellowship applicants and website customers in one list. Search, update details, and resend login information.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreating(true)}>+ Create customer</Button>
          <Button
            variant="outline"
            disabled={!selectedEmails.length}
            onClick={() => {
              selectedEmails.forEach((email) => sendAccountDetails(email));
              setNote(`Login details resent to ${selectedEmails.length} account${selectedEmails.length === 1 ? "" : "s"}.`);
            }}
          >
            Email login details ({selectedEmails.length || "selected"})
          </Button>
        </div>
      </div>
      {note && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{note}</p>}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {creating && (
        <AdminModal title="New customer" wide onClose={() => setCreating(false)}>
          <CustomerFields form={form} setForm={setForm} />
          <div className="mt-4">
            <Button onClick={create}>Create account & email details</Button>
          </div>
        </AdminModal>
      )}

      {selected ? (
        <AdminModal title={`${displayName(selected, true)} · ${selected.accountId}`} wide onClose={() => setSelectedEmail(null)}>
          <CustomerDetail key={selected.email} account={selected} onNote={setNote} />
        </AdminModal>
      ) : null}

      <div className="grid gap-5">
        <div>
          <Panel title={`Accounts (${shown.length})`}>
            <TextInput placeholder="Search name, email, phone or 12-digit ID" value={query} onChange={(event) => setQuery(event.target.value)} />
            {shown.length === 0 ? (
              <EmptyState text="No customers match." />
            ) : (
              <ul className="mt-3 max-h-[70vh] divide-y divide-border overflow-y-auto">
                {shown.map((account) => (
                  <li key={account.email} className="flex items-start gap-2 py-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={Boolean(picked[account.email])}
                      onChange={(event) => setPicked((current) => ({ ...current, [account.email]: event.target.checked }))}
                    />
                    <div className="min-w-0 flex-1">
                      <button type="button" className="w-full text-left" onClick={() => setSelectedEmail(account.email)}>
                        <p className="font-semibold text-text-primary">{displayName(account, true) || account.email}</p>
                        <PartnerPortalBadges user={account} className="mt-1" />
                        <p className="font-mono text-xs text-text-muted">{account.accountId} · {account.email}</p>
                        <p className="text-xs text-text-muted">{account.phone}{account.alternatePhone && account.alternatePhone !== account.phone ? ` · Alt ${account.alternatePhone}` : ""} · {(account.status ?? "active")}</p>
                      </button>
                      <PasswordReveal account={account} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function CustomerFields({
  form,
  setForm,
}: {
  form: typeof emptyForm;
  setForm: (next: typeof emptyForm) => void;
}) {
  const set = (patch: Partial<typeof emptyForm>) => setForm({ ...form, ...patch });
  const country = countryByCode(form.countryCode);
  const states = statesFor(country.code);
  const [lookupNote, setLookupNote] = useState("");
  const lastLookup = useRef("");
  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    const pin = form.pincode.trim();
    if (!postalLooksComplete(pin, form.countryCode)) {
      setLookupNote("");
      return;
    }
    const key = `${form.countryCode}:${pin}`;
    if (lastLookup.current === key) return;
    const timer = window.setTimeout(() => {
      lastLookup.current = key;
      void fetchPostalPlace(pin, form.countryCode)
        .then((place) => {
          if (!place) {
            setLookupNote("Postal code not found. Enter city, state and country.");
            return;
          }
          const current = formRef.current;
          const nextStates = statesFor(place.countryCode);
          lastLookup.current = `${place.countryCode}:${place.pincode || pin}`;
          setForm({
            ...current,
            city: place.city || current.city,
            state: nextStates.includes(place.state) ? place.state : place.state || current.state,
            country: place.country,
            countryCode: place.countryCode,
            pincode: place.pincode || pin,
          });
          setLookupNote(`${place.city}${place.state ? `, ${place.state}` : ""}, ${place.country}`);
        })
        .catch(() => setLookupNote("Could not look up this postal code."));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [form.countryCode, form.pincode, setForm]);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Salutation">
        <SelectInput value={form.salutation} onChange={(event) => set({ salutation: event.target.value })}>
          {SALUTATIONS.map((item) => <option key={item}>{item}</option>)}
        </SelectInput>
      </Field>
      <Field label="First name"><TextInput value={form.firstName} onChange={(event) => set({ firstName: event.target.value })} /></Field>
      <Field label="Middle name (optional)"><TextInput value={form.middleName} onChange={(event) => set({ middleName: event.target.value })} /></Field>
      <Field label="Last name"><TextInput value={form.lastName} onChange={(event) => set({ lastName: event.target.value })} /></Field>
      <Field label="Phone (international)">
        <TextInput value={form.phone} onChange={(event) => set({ phone: event.target.value, alternatePhone: form.alternatePhone || event.target.value })} placeholder={`${country.dial} 98765 43210`} />
      </Field>
      <Field label="Alternate phone">
        <TextInput value={form.alternatePhone} onChange={(event) => set({ alternatePhone: event.target.value })} placeholder={`${country.dial} 98765 43210`} />
      </Field>
      <Field label="Email"><TextInput value={form.email} onChange={(event) => set({ email: event.target.value })} /></Field>
      <Field label="Country">
        <SelectInput
          value={country.code}
          onChange={(event) => {
            const next = countryByCode(event.target.value);
            const nextStates = statesFor(next.code);
            lastLookup.current = "";
            set({
              countryCode: next.code,
              country: next.name,
              state: nextStates.includes(form.state) ? form.state : nextStates[0] || "",
              pincode: isIndia(next.code) ? form.pincode.replace(/\D/g, "").slice(0, 6) : form.pincode,
            });
          }}
        >
          {COUNTRIES.map((item) => (
            <option key={item.code} value={item.code}>{item.name} ({item.dial})</option>
          ))}
        </SelectInput>
      </Field>
      <Field label="Address"><TextInput value={form.line1} onChange={(event) => set({ line1: event.target.value })} /></Field>
      <Field label="Landmark"><TextInput value={form.landmark} onChange={(event) => set({ landmark: event.target.value })} /></Field>
      <Field label={isIndia(country.code) ? "Pincode" : "Postal code"}>
        <TextInput
          value={form.pincode}
          onChange={(event) => {
            lastLookup.current = "";
            set({
              pincode: isIndia(country.code)
                ? event.target.value.replace(/\D/g, "").slice(0, 6)
                : event.target.value.slice(0, 12),
            });
          }}
          placeholder={isIndia(country.code) ? "6-digit PIN fills city, state, country" : "Postal code fills city, state, country"}
        />
      </Field>
      <Field label="City"><TextInput value={form.city} onChange={(event) => set({ city: event.target.value })} /></Field>
      <Field label="State / region">
        {states.length ? (
          <SelectInput value={form.state} onChange={(event) => set({ state: event.target.value })}>
            <option value="">Select</option>
            {states.map((state) => <option key={state} value={state}>{state}</option>)}
          </SelectInput>
        ) : (
          <TextInput value={form.state} onChange={(event) => set({ state: event.target.value })} />
        )}
      </Field>
      {lookupNote ? <p className="sm:col-span-2 text-xs text-text-muted">{lookupNote}</p> : null}
    </div>
  );
}

function PasswordReveal({ account }: { account: User }) {
  const [open, setOpen] = useState(false);
  const sisterOnly = Boolean(account.partnerPortals?.length && !account.foundationPasswordSet);
  return (
    <p className="mt-1 text-xs text-text-muted">
      Password:{" "}
      {sisterOnly ? (
        <span>not set on this website. Seminar / Autism / Fellowship passwords are not used here — the customer must use Forgot password on this site.</span>
      ) : open ? (
        <span className="font-mono">{account.password || "Not set"}</span>
      ) : (
        "••••••••"
      )}{" "}
      {!sisterOnly && (
        <button type="button" className="font-semibold text-burgundy" onClick={() => setOpen((value) => !value)}>
          {open ? "Hide" : "Show"}
        </button>
      )}
    </p>
  );
}

function CustomerDetail({ account, onNote }: { account: User; onNote: (text: string) => void }) {
  const [form, setForm] = useState({
    salutation: account.salutation ?? "Dr.",
    firstName: account.firstName,
    middleName: account.middleName ?? "",
    lastName: account.lastName,
    phone: account.phone,
    alternatePhone: account.alternatePhone ?? account.phone,
    email: account.email,
    line1: account.address?.line1 ?? "",
    landmark: account.address?.landmark ?? "",
    city: account.address?.city ?? "",
    state: account.address?.state ?? "Maharashtra",
    pincode: account.address?.pincode ?? "",
    country: account.address?.country ?? "India",
    countryCode: account.address?.countryCode ?? "IN",
  });
  const [credit, setCredit] = useState("");
  const [creditNote, setCreditNote] = useState("Admin adjustment");
  const ledger = getStoreCreditLedger(account.email);
  const status = (account.status ?? "active") as AccountStatus;

  return (
    <Panel title={`${displayName(account, true)} · ${account.accountId}`} description={`Store credit ${formatInr(getStoreCredit(account.email))}`}>
      <CustomerFields form={form} setForm={setForm} />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          onClick={() => {
            if (!isValidPhone(form.phone) || (form.alternatePhone && !isValidPhone(form.alternatePhone))) {
              onNote("Enter a valid international phone number, including the country code.");
              return;
            }
            updateCustomer(account.email, {
              salutation: form.salutation,
              firstName: form.firstName,
              middleName: form.middleName,
              lastName: form.lastName,
              phone: form.phone,
              alternatePhone: form.alternatePhone || form.phone,
              email: form.email,
              address: { line1: form.line1, landmark: form.landmark, city: form.city, state: form.state, pincode: form.pincode, country: form.country, countryCode: form.countryCode },
            });
            onNote("Customer details saved.");
          }}
        >
          Save changes
        </Button>
        <PasswordReveal account={account} />
        <Button variant="outline" onClick={() => { sendAccountDetails(account.email); onNote(`Login details emailed to ${account.email}.`); }}>
          Resend login details
        </Button>
        {status === "active" ? (
          <>
            <Button variant="outline" onClick={() => { setAccountStatus(account.email, "disabled"); onNote("Customer disabled."); }}>Disable</Button>
            <Button variant="danger" onClick={() => { setAccountStatus(account.email, "banned", "Banned by admin"); onNote("Customer banned."); }}>Ban</Button>
          </>
        ) : (
          <Button variant="outline" onClick={() => { setAccountStatus(account.email, "active"); onNote("Customer reactivated."); }}>Reactivate</Button>
        )}
      </div>
      <div className="mt-6 rounded-xl border border-border p-4">
        <p className="text-sm font-semibold text-text-primary">Store credit</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <TextInput type="number" placeholder="Amount ₹" value={credit} onChange={(event) => setCredit(event.target.value)} />
          <TextInput placeholder="Note" value={creditNote} onChange={(event) => setCreditNote(event.target.value)} />
          <Button
            onClick={() => {
              const amount = Number(credit);
              if (!amount) return;
              adjustStoreCredit(account.email, amount, creditNote || "Admin adjustment");
              setCredit("");
              onNote(`Store credit ${amount > 0 ? "added" : "deducted"}.`);
            }}
          >
            Apply
          </Button>
        </div>
        <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs text-text-muted">
          {ledger.slice(0, 8).map((entry) => (
            <li key={entry.id}>{entry.at.slice(0, 16).replace("T", " ")} · {entry.amount > 0 ? "+" : ""}{formatInr(entry.amount)} · {entry.note}</li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

function formatInr(amount: number) {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}
