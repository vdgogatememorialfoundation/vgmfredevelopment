"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
import { useAccounts, useOrders } from "@/lib/use-cms";
import { hydratePartnerFeed } from "@/lib/partner-hydrate";
import { matchesAccountQuery } from "@/lib/account-search";
import { activitiesFor } from "@/lib/activity";
import type { AccountStatus, User } from "@/types";
import { Button, EmptyState, Field, Panel, SelectInput, TextInput } from "@/components/admin/AdminUI";
import { AdminModal } from "@/components/admin/AdminModal";
import { SignupFormsPanel } from "@/components/admin/SignupFormsPanel";
import { EmailComposer } from "@/components/admin/EmailComposer";
import { COUNTRIES, countryByCode, isIndia, isValidPhone, statesFor } from "@/lib/geo";
import { fetchPostalPlace, postalLooksComplete } from "@/lib/postal-lookup";
import { downloadCsv, downloadExcel } from "@/lib/export-file";
import { col, readSheetFile } from "@/lib/import-file";

ensureBootstrapped();

type MainSiteAccount = User & {
  passwordHistory?: Array<{ password: string; at: string; source?: string }>;
};

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

const PAGE = 100;
const CUSTOMER_COLUMNS = ["Salutation", "First name", "Middle name", "Last name", "Email", "Phone", "Alternate phone", "Address", "Landmark", "City", "State", "Pincode", "Country", "Country code"];

function customerRow(account: User): string[] {
  const address = account.address;
  return ([
    account.salutation ?? "", account.firstName, account.middleName ?? "", account.lastName, account.email, account.phone, account.alternatePhone ?? "",
    address?.line1 ?? "", address?.landmark ?? "", address?.city ?? "", address?.state ?? "", address?.pincode ?? "", address?.country ?? "", address?.countryCode ?? "",
  ] as (string | undefined)[]).map((value) => value ?? "");
}

export function CustomerDesk() {
  const allAccounts = useAccounts() as MainSiteAccount[];
  useEffect(() => {
    void hydratePartnerFeed({ full: true, force: true });
  }, []);

  const accounts = useMemo(
    () =>
      allAccounts.filter((account) => {
        if (account.role === "admin" || account.role === "coadmin" || account.role === "staff") return false;
        if (/^(seminar|autism|fellowship)-usr-/i.test(String(account.id || ""))) return false;
        return !account.role || account.role === "customer";
      }),
    [allAccounts]
  );

  const [limit, setLimit] = useState(PAGE);
  const [importing, setImporting] = useState(false);
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

  const exportCustomers = () => {
    const list = selectedEmails.length ? shown.filter((account) => picked[account.email]) : shown;
    downloadExcel(`website-customers-${new Date().toISOString().slice(0, 10)}`, "Customers", ["Account ID", ...CUSTOMER_COLUMNS, "Password", "Status", "Created"], list.map((account) => [account.accountId ?? "", ...customerRow(account), account.password ?? "", account.status ?? "active", account.createdAt ?? ""]));
  };

  const importCustomers = async (file: File) => {
    setImporting(true);
    setError("");
    setNote("");
    try {
      const rows = await readSheetFile(file);
      let created = 0;
      const problems: string[] = [];
      rows.forEach((row, index) => {
        const email = col(row, "Email");
        const phone = col(row, "Phone", "Mobile");
        if (!email || !phone || !col(row, "First name")) {
          problems.push(`Row ${index + 2}: first name, email and phone are required`);
          return;
        }
        try {
          createCustomerAccount(
            {
              salutation: col(row, "Salutation") || "Dr.",
              firstName: col(row, "First name"),
              middleName: col(row, "Middle name"),
              lastName: col(row, "Last name"),
              email,
              phone,
              alternatePhone: col(row, "Alternate phone") || phone,
              address: {
                line1: col(row, "Address", "Address line 1"),
                landmark: col(row, "Landmark"),
                city: col(row, "City"),
                state: col(row, "State"),
                pincode: col(row, "Pincode", "Postal code"),
                country: col(row, "Country") || "India",
                countryCode: col(row, "Country code") || "IN",
              },
            },
            { sendDetails: false }
          );
          created += 1;
        } catch (problem) {
          problems.push(`Row ${index + 2} (${email}): ${problem instanceof Error ? problem.message : "could not create"}`);
        }
      });
      setNote(`Imported ${created} of ${rows.length} customer${rows.length === 1 ? "" : "s"}.`);
      if (problems.length) setError(`${problems.length} skipped — ${problems.slice(0, 5).join("; ")}${problems.length > 5 ? "; …" : ""}`);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not read the file.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Customers</h1>
          <p className="text-sm text-text-muted">
            Main website registered customers and shoppers. Search, view passwords, track website activity and orders, update details, and resend login information.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setCreating(true)}>+ Create customer</Button>
          <Button variant="outline" onClick={() => downloadCsv("customer-import-template", CUSTOMER_COLUMNS, [["Dr.", "Asha", "", "Patil", "asha@example.com", "+91 98765 43210", "", "12 MG Road", "Near temple", "Pune", "Maharashtra", "411001", "India", "IN"]])}>
            Customer template
          </Button>
          <label className={`inline-flex cursor-pointer items-center rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-primary hover:bg-surface ${importing ? "pointer-events-none opacity-60" : ""}`}>
            {importing ? "Importing…" : "Import customers"}
            <input
              type="file"
              accept=".csv,.xls,text/csv,application/vnd.ms-excel"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void importCustomers(file);
              }}
            />
          </label>
          <Button variant="outline" onClick={exportCustomers}>Export customers</Button>
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

      <EmailComposer accounts={shown} selected={shown.filter((account) => picked[account.email])} />
      <SignupFormsPanel />

      {selected ? (
        <AdminModal title={`${displayName(selected, true)} · ${selected.accountId || "Account"}`} wide onClose={() => setSelectedEmail(null)}>
          <CustomerDetail key={selected.email} account={selected} onNote={setNote} />
        </AdminModal>
      ) : null}

      <div className="grid gap-5">
        <div>
          <Panel title={`Website Registered Customers (${shown.length})`}>
            <TextInput placeholder="Search name, email, phone or 12-digit Account ID" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(PAGE); }} />
            {shown.length === 0 ? (
              <EmptyState text="No website customers match." />
            ) : (
              <ul className="mt-3 max-h-[70vh] divide-y divide-border overflow-y-auto">
                {shown.slice(0, limit).map((account) => (
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
                        <p className="mt-0.5 font-mono text-xs text-text-muted">{account.accountId} · {account.email}</p>
                        <p className="text-xs text-text-muted">
                          {account.phone || "No phone"}{account.alternatePhone && account.alternatePhone !== account.phone ? ` · Alt ${account.alternatePhone}` : ""} · {(account.status ?? "active")}
                        </p>
                      </button>
                      <PasswordReveal account={account} />
                    </div>
                    <Button variant="outline" onClick={() => setSelectedEmail(account.email)}>
                      View / Edit Account
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {shown.length > limit && (
              <div className="mt-3 flex items-center justify-between gap-2 text-xs text-text-muted">
                <span>Showing {limit} of {shown.length}. Search to find a customer quickly.</span>
                <Button variant="outline" onClick={() => setLimit((value) => value + PAGE)}>Show {Math.min(PAGE, shown.length - limit)} more</Button>
              </div>
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

function PasswordReveal({ account }: { account: MainSiteAccount }) {
  const [open, setOpen] = useState(false);
  const hasPass = Boolean(account.password);
  return (
    <p className="mt-1 text-xs text-text-muted">
      Password:{" "}
      {hasPass ? (
        open ? (
          <span className="font-mono font-semibold text-text-primary">{account.password}</span>
        ) : (
          "••••••••"
        )
      ) : (
        <span>Not set yet (Signs in via OTP / Google)</span>
      )}{" "}
      {hasPass ? (
        <button type="button" className="ml-1 font-semibold text-burgundy underline" onClick={() => setOpen((value) => !value)}>
          {open ? "Hide" : "Show"}
        </button>
      ) : null}
    </p>
  );
}

type ServerCustomerIntel = {
  ok?: boolean;
  websitePassword?: string;
  passwordHistory?: Array<{ password: string; at: string; source: string }>;
  signupForms?: Array<{
    formId: string;
    acknowledgementId: string;
    accountId: string;
    method: string;
    createdAt: string;
    ip: string;
    userAgent: string;
  }>;
  activeCart?: { items?: Array<{ bookId: string; quantity: number }>; at?: number } | null;
  timeline?: Array<{ id: string; at: string; category: string; title: string; detail: string }>;
};

function CustomerDetail({ account, onNote }: { account: MainSiteAccount; onNote: (text: string) => void }) {
  const allOrders = useOrders();
  const [modalTab, setModalTab] = useState<"profile" | "activity">("profile");
  const [intel, setIntel] = useState<ServerCustomerIntel | null>(null);
  const [loadingIntel, setLoadingIntel] = useState(false);
  const [newPassword, setNewPassword] = useState(account.password ?? "");
  const [savingServer, setSavingServer] = useState(false);

  const loadIntel = () => {
    setLoadingIntel(true);
    fetch(`/api/admin/customer-activity?email=${encodeURIComponent(account.email)}`, { cache: "no-store", credentials: "same-origin" })
      .then((res) => res.json() as Promise<ServerCustomerIntel>)
      .then((data) => {
        if (data?.ok) {
          setIntel(data);
          if (data.websitePassword && !newPassword) setNewPassword(data.websitePassword);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoadingIntel(false));
  };

  useEffect(() => {
    loadIntel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.email]);

  const customerOrders = useMemo(() => {
    const email = (account.email || "").trim().toLowerCase();
    const digits = (account.phone || "").replace(/\D/g, "").slice(-10);
    return allOrders.filter((ord) => {
      const oEmail = (ord.accountEmail || ord.deliveryAddress?.email || ord.createdBy || "").trim().toLowerCase();
      const oPhone = (ord.deliveryAddress?.phone || "").replace(/\D/g, "").slice(-10);
      return (email && oEmail === email) || (digits.length >= 10 && oPhone === digits) || (account.id && ord.userId === account.id);
    });
  }, [allOrders, account.email, account.phone, account.id]);

  const localActivities = useMemo(() => activitiesFor(account.email), [account.email]);

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

  const allPasswords = intel?.passwordHistory?.length
    ? intel.passwordHistory
    : account.passwordHistory?.length
      ? account.passwordHistory
      : account.password
        ? [{ password: account.password, at: account.createdAt || "", source: "Website Account" }]
        : [];

  const handleSaveAll = async () => {
    if (!isValidPhone(form.phone) || (form.alternatePhone && !isValidPhone(form.alternatePhone))) {
      onNote("Enter a valid international phone number, including the country code.");
      return;
    }
    setSavingServer(true);
    try {
      const addressObj = {
        line1: form.line1,
        landmark: form.landmark,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        country: form.country,
        countryCode: form.countryCode,
      };
      updateCustomer(account.email, {
        salutation: form.salutation,
        firstName: form.firstName,
        middleName: form.middleName,
        lastName: form.lastName,
        phone: form.phone,
        alternatePhone: form.alternatePhone || form.phone,
        email: form.email,
        address: addressObj,
        ...(newPassword.trim() ? { password: newPassword.trim(), foundationPasswordSet: true } : {}),
      });
      await fetch("/api/admin/customer-activity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          currentEmail: account.email,
          salutation: form.salutation,
          firstName: form.firstName,
          middleName: form.middleName,
          lastName: form.lastName,
          phone: form.phone,
          alternatePhone: form.alternatePhone || form.phone,
          email: form.email,
          address: addressObj,
          newPassword: newPassword.trim() || undefined,
        }),
      });
      await hydratePartnerFeed({ full: true, force: true });
      loadIntel();
      onNote("Customer details, address, and website password saved.");
    } catch (e) {
      onNote(e instanceof Error ? e.message : "Could not save customer changes.");
    } finally {
      setSavingServer(false);
    }
  };

  return (
    <Panel
      title={`${displayName(account, true)} · ${account.accountId || "No ID"}`}
      description={`Store credit ${formatInr(getStoreCredit(account.email))} · Status: ${status} · Orders: ${customerOrders.length}`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-warm-cream/50 px-4 py-3 text-xs">
        <div className="space-y-1">
          <p className="font-semibold text-text-primary">
            Account ID: <span className="font-mono">{account.accountId || "—"}</span> · Email: <span className="font-mono">{account.email}</span>
          </p>
          <p className="text-text-muted">
            Phone: {account.phone || "—"}{account.alternatePhone && account.alternatePhone !== account.phone ? ` · Alt: ${account.alternatePhone}` : ""}
            {account.createdAt ? ` · Joined: ${account.createdAt.slice(0, 10)}` : ""}
          </p>
        </div>
        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
          Website Registered Customer
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setModalTab("profile")}
          className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
            modalTab === "profile" ? "bg-burgundy text-white" : "bg-surface text-text-primary hover:bg-border/50"
          }`}
        >
          1. Edit Info, Password &amp; Store Credit
        </button>
        <button
          type="button"
          onClick={() => setModalTab("activity")}
          className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
            modalTab === "activity" ? "bg-burgundy text-white" : "bg-surface text-text-primary hover:bg-border/50"
          }`}
        >
          2. Website Activity &amp; Orders ({(intel?.timeline?.length || 0) + localActivities.length})
        </button>
      </div>

      {modalTab === "profile" ? (
        <>
          <div className="mb-5 rounded-xl border border-burgundy/25 bg-burgundy/5 p-4">
            <p className="text-sm font-bold text-text-primary">Website Account Password</p>
            <div className="mt-2 rounded-lg border border-border bg-white p-2.5 text-xs">
              <span className="block text-[11px] font-semibold uppercase text-text-muted">Current Website Password</span>
              <span className="mt-0.5 block font-mono text-sm font-bold text-burgundy">
                {intel?.websitePassword || account.password || "Not set yet (OTP / Google Login)"}
              </span>
            </div>

            {allPasswords.length > 0 ? (
              <div className="mt-3">
                <p className="text-xs font-semibold text-text-muted">Website Password History ({allPasswords.length}):</p>
                <ul className="mt-1.5 flex flex-wrap gap-2">
                  {allPasswords.map((item, idx) => (
                    <li key={`${item.password}-${idx}`} className="rounded-lg border border-border bg-white px-2.5 py-1 text-xs">
                      <span className="font-mono font-bold text-text-primary">{item.password}</span>
                      <span className="ml-1.5 text-[11px] text-text-muted">({item.source || "Website"}{item.at ? ` · ${item.at.slice(0, 10)}` : ""})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] items-end">
              <Field label="Set / Update Website Password">
                <TextInput
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new website password"
                />
              </Field>
              <Button onClick={() => void handleSaveAll()} disabled={savingServer}>
                {savingServer ? "Updating…" : "Update Password"}
              </Button>
            </div>
          </div>

          <CustomerFields form={form} setForm={setForm} />

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => void handleSaveAll()} disabled={savingServer}>
              {savingServer ? "Saving…" : "Save All Customer Changes"}
            </Button>
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
        </>
      ) : (
        <div className="space-y-5">
          {intel?.signupForms && intel.signupForms.length > 0 ? (
            <div className="rounded-xl border border-border p-4">
              <p className="text-sm font-semibold text-text-primary">Signup Acknowledgement Form</p>
              {intel.signupForms.map((sf) => (
                <div key={sf.formId} className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <p className="font-semibold text-text-primary">
                      Form ID: <span className="font-mono">{sf.formId}</span> · Acknowledgement ID: <span className="font-mono">{sf.acknowledgementId}</span>
                    </p>
                    <p className="text-text-muted">
                      Accepted: {sf.createdAt.slice(0, 16).replace("T", " ")} · Method: {sf.method} · IP: {sf.ip || "—"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => window.open(`/api/admin/signup-forms?format=html&ids=${encodeURIComponent(sf.formId)}`, "_blank", "noopener")}
                  >
                    Download Form PDF
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="rounded-xl border border-border p-4">
            <p className="text-sm font-semibold text-text-primary">Website Shop Orders ({customerOrders.length})</p>
            {customerOrders.length === 0 ? (
              <p className="mt-2 text-xs text-text-muted">No shop orders placed with this email or mobile number yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border text-xs">
                {customerOrders.map((ord) => (
                  <li key={ord.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="font-semibold text-text-primary">
                        Order #{ord.id} · {formatInr(ord.total)} · <span className="text-burgundy">{ord.status}</span>
                      </p>
                      <p className="text-text-muted">
                        {ord.date?.slice(0, 10)} · {ord.deliveryMode === "store_pickup" ? "Store Pickup" : "Home Delivery"} · Payment: {ord.paymentStatus} ({ord.paymentMethod})
                      </p>
                      <p className="text-text-muted">
                        {(ord.items ?? []).map((it) => `${it.title} × ${it.quantity}`).join(", ")}
                      </p>
                    </div>
                    <Link
                      href={`/admin/commerce/orders?order=${encodeURIComponent(ord.id)}`}
                      className="rounded-lg border border-burgundy/30 bg-burgundy/5 px-3 py-1.5 font-semibold text-burgundy hover:bg-burgundy/10"
                    >
                      Open Order →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-text-primary">Website Customer Activity Timeline</p>
              <Button variant="outline" onClick={loadIntel} disabled={loadingIntel}>
                {loadingIntel ? "Refreshing…" : "Refresh Activity"}
              </Button>
            </div>
            {loadingIntel && !intel ? (
              <p className="mt-3 text-xs text-text-muted">Loading customer activity log…</p>
            ) : (intel?.timeline?.length || 0) === 0 && localActivities.length === 0 ? (
              <p className="mt-3 text-xs text-text-muted">No recorded activity events yet.</p>
            ) : (
              <ul className="mt-3 max-h-96 divide-y divide-border overflow-y-auto text-xs">
                {localActivities.map((act) => (
                  <li key={act.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-text-primary">Account {act.kind}</span>
                      <span className="font-mono text-[11px] text-text-muted">{act.at.slice(0, 16).replace("T", " ")}</span>
                    </div>
                    <p className="text-text-muted">{act.detail || act.email}{act.by ? ` · By: ${act.by}` : ""}</p>
                  </li>
                ))}
                {(intel?.timeline ?? []).map((ev) => (
                  <li key={ev.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-text-primary">{ev.title}</span>
                      <span className="font-mono text-[11px] text-text-muted">{ev.at ? ev.at.slice(0, 16).replace("T", " ") : "—"}</span>
                    </div>
                    <p className="text-text-muted">{ev.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

function formatInr(amount: number) {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}
