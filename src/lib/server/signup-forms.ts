import { randomInt } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { NextRequest } from "next/server";
import { listAccounts, type FoundationAccount } from "@/lib/server/accounts";
import { dataFile } from "@/lib/server/paths";

export const SIGNUP_DOCUMENTS = [
  { title: "Terms & Conditions", path: "/terms" },
  { title: "Privacy Policy (including cookies)", path: "/privacy" },
  { title: "Shipping Policy", path: "/shipping-policy" },
  { title: "Return Policy", path: "/return-policy" },
  { title: "Refund Policy", path: "/refund-policy" },
  { title: "Cancellation Policy", path: "/cancellation-policy" },
];

export const SIGNUP_LAWS = [
  "Information Technology Act, 2000 and the IT (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011",
  "Digital Personal Data Protection Act, 2023 — consent to process the personal data given here for the purposes stated in the Privacy Policy",
  "Consumer Protection Act, 2019 and the Consumer Protection (E-Commerce) Rules, 2020",
  "Indian Contract Act, 1872 — electronic acceptance of these terms forms a valid agreement (IT Act, 2000, section 10A)",
];

export type SignupForm = {
  formId: string;
  acknowledgementId: string;
  accountId: string;
  createdAt: string;
  /** "existing": the account was made before acknowledgements were recorded; built from the account record. */
  method: "email" | "google" | "existing";
  salutation: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp?: string;
  alternatePhone?: string;
  birthDate?: string;
  country?: string;
  extraFields?: Record<string, string>;
  ip: string;
  userAgent: string;
  documents: string[];
  laws: string[];
};

const FILE = dataFile("signup-forms.json");

function load(): SignupForm[] {
  try {
    const rows = JSON.parse(readFileSync(FILE, "utf8")) as SignupForm[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function save(rows: SignupForm[]) {
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(rows, null, 2));
  } catch {
    /* read-only host */
  }
}

function newId(used: Set<string>) {
  let id = "";
  do id = String(randomInt(100000000000, 999999999999));
  while (used.has(id));
  used.add(id);
  return id;
}

export function listSignupForms() {
  return load().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function recordSignupForm(account: FoundationAccount, request: NextRequest, method: SignupForm["method"], country = "") {
  const rows = load();
  const existing = rows.find((row) => row.accountId === account.accountId);
  if (existing) return existing;
  const used = new Set(rows.flatMap((row) => [row.formId, row.acknowledgementId]));
  const form = formFor(account, used, {
    createdAt: new Date().toISOString(),
    method,
    ip: (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "").split(",")[0].trim() || "—",
    userAgent: (request.headers.get("user-agent") || "—").slice(0, 300),
  });
  if (country) form.country = country;
  rows.push(form);
  save(rows);
  return form;
}

function formFor(account: FoundationAccount, used: Set<string>, extra: Pick<SignupForm, "createdAt" | "method" | "ip" | "userAgent">): SignupForm {
  return {
    formId: newId(used),
    acknowledgementId: newId(used),
    accountId: account.accountId,
    salutation: account.salutation,
    firstName: account.firstName,
    middleName: account.middleName,
    lastName: account.lastName,
    email: account.email,
    phone: account.phone,
    whatsapp: account.whatsapp,
    alternatePhone: account.alternatePhone,
    birthDate: account.birthDate,
    extraFields: account.extraFields,
    documents: SIGNUP_DOCUMENTS.map((doc) => doc.title),
    laws: SIGNUP_LAWS,
    ...extra,
  };
}

/** Creates a form for every account that signed up before forms were recorded. Returns how many were added. */
export function backfillSignupForms() {
  const rows = load();
  const have = new Set(rows.map((row) => row.accountId));
  const used = new Set(rows.flatMap((row) => [row.formId, row.acknowledgementId]));
  let added = 0;
  for (const account of listAccounts()) {
    if (!account.accountId || have.has(account.accountId)) continue;
    rows.push(formFor(account, used, { createdAt: account.createdAt || new Date().toISOString(), method: "existing", ip: "—", userAgent: "—" }));
    have.add(account.accountId);
    added += 1;
  }
  if (added) save(rows);
  return added;
}

const escape = (value: unknown) =>
  String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] as string);

function istTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "long", timeStyle: "medium" }) + " IST";
}

let logoData = "";
function logoSrc(site: string) {
  if (!logoData) {
    try {
      logoData = `data:image/png;base64,${readFileSync(join(process.cwd(), "public", "icon.png")).toString("base64")}`;
    } catch {
      return `${site}/icon.png`;
    }
  }
  return logoData;
}

function renderOne(form: SignupForm, site: string) {
  const name = [form.salutation, form.firstName, form.middleName, form.lastName].filter(Boolean).join(" ");
  const rows: [string, string][] = [
    ["Full name", name],
    ["Account ID", form.accountId],
    ["Email", form.email],
    ["Mobile", form.phone],
    ["WhatsApp", form.whatsapp || "—"],
    ["Alternate phone", form.alternatePhone || "—"],
    ["Date of birth", form.birthDate || "—"],
    ["Country", form.country || "—"],
    ...Object.entries(form.extraFields ?? {}).map(([key, value]) => [key, value] as [string, string]),
    ["Signed up with", form.method === "google" ? "Google account (verified email)" : form.method === "existing" ? "Existing account (registered before online acknowledgement)" : "Email with one-time code"],
    [form.method === "existing" ? "Account created on" : "Accepted on", istTime(form.createdAt)],
    ["IP address", form.ip],
    ["Device / browser", form.userAgent],
  ];
  return `<section class="form">
  <header><div class="brand"><img src="${logoSrc(site)}" alt="Vaidya Gogate Memorial Foundation logo"><div><h1>Vaidya Gogate Memorial Foundation</h1><p>Customer Registration &amp; Acknowledgement Form</p></div></div>
  <table class="ids"><tr><th>Form ID</th><td>${escape(form.formId)}</td></tr><tr><th>Acknowledgement ID</th><td>${escape(form.acknowledgementId)}</td></tr></table></header>
  <h2>1. Customer details</h2>
  <table class="details">${rows.map(([label, value]) => `<tr><th>${escape(label)}</th><td>${escape(value)}</td></tr>`).join("")}</table>
  <h2>2. Documents accepted</h2>
  <p>By creating an account, the customer confirmed that they have read, understood and accept the following, as published at ${escape(site)} on the date above:</p>
  <ul>${SIGNUP_DOCUMENTS.map((doc) => `<li>${escape(doc.title)} — ${escape(site + doc.path)}</li>`).join("")}</ul>
  <h2>3. Applicable laws</h2>
  <ul>${form.laws.map((law) => `<li>${escape(law)}</li>`).join("")}</ul>
  <h2>4. Declaration</h2>
  <p>I declare that the details above are true and belong to me. I consent to Vaidya Gogate Memorial Foundation processing them to run my account, orders, events and support as described in the Privacy Policy. I understand I can ask for a copy, correction or deletion of my data by writing to care@vaidyagogate.org. This acknowledgement was given electronically and is valid without a physical signature.</p>
  ${form.method === "existing" ? `<p class="sign">This account was registered before the online acknowledgement was introduced. This form was generated from the account record; the customer's continued use of the account is subject to the documents and laws above.</p>` : ""}
  <p class="sign">Electronically accepted by <b>${escape(name)}</b> on ${escape(istTime(form.createdAt))} · Acknowledgement ID ${escape(form.acknowledgementId)}</p>
  <footer>Vaidya Gogate Memorial Foundation · care@vaidyagogate.org · System-generated record, Form ID ${escape(form.formId)}</footer>
</section>`;
}

export function renderSignupForms(forms: SignupForm[], site: string) {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Signup acknowledgement forms (${forms.length})</title>
<style>
body{font-family:Georgia,serif;color:#1f1a17;margin:0;background:#f4f1ec}
.form{background:#fff;max-width:800px;margin:24px auto;padding:36px 44px;box-shadow:0 1px 4px #0002;page-break-after:always}
header{display:flex;justify-content:space-between;gap:16px;border-bottom:3px solid #7a1f2b;padding-bottom:12px}
.brand{display:flex;align-items:center;gap:12px}.brand img{height:64px;width:auto;max-width:120px;object-fit:contain}h1{color:#7a1f2b;font-size:22px;margin:0}header p{margin:4px 0 0;font-weight:bold}
h2{font-size:15px;color:#7a1f2b;margin:22px 0 8px;text-transform:uppercase;letter-spacing:.05em}
table{border-collapse:collapse;font-size:13px}.details{width:100%}
th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}th{background:#faf6f0;width:34%}
.ids th{width:auto}.ids td{font-family:monospace;font-weight:bold}
li,p{font-size:13px;line-height:1.55}.sign{border:1px dashed #7a1f2b;padding:10px;margin-top:14px}
footer{margin-top:24px;font-size:11px;color:#777;border-top:1px solid #ddd;padding-top:8px}
@media print{body{background:#fff}.form{box-shadow:none;margin:0 auto}}
</style></head><body>${forms.map((form) => renderOne(form, site)).join("")}
<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},300)})</script></body></html>`;
}
