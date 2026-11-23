"use client";

import { useCallback, useEffect, useState } from "react";

type Hub = { code: string; name: string; city?: string };
type Kyc = { status?: string; provider?: string };
type Enrollment = { status?: string; hubCode?: string; kyc?: Kyc };

const input = "w-full rounded-xl border border-border bg-white px-3 py-3 text-sm";
const button = "w-full rounded-full bg-burgundy px-6 py-3 text-sm font-semibold text-white disabled:opacity-60";
const ghost = "w-full rounded-full border border-burgundy/40 px-6 py-3 text-sm font-semibold text-burgundy disabled:opacity-60";

async function joinApi<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/rider-join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({ ok: false, error: "Server error." }));
  if (!data.ok) throw new Error(data.error || "Something went wrong.");
  return data as T;
}

async function portalApi<T>(session: string, action: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch("/api/mobile/portal", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${session}` }, body: JSON.stringify({ ...body, action }) });
  const data = await res.json().catch(() => ({ ok: false, error: "Server error." }));
  if (!data.ok) throw new Error(data.error || "Something went wrong.");
  return data as T;
}

export default function RiderJoinClient({ token }: { token: string }) {
  const storeKey = `vgmf-rider-join:${token}`;
  const [link, setLink] = useState<{ label: string; hubCode: string; hubs: Hub[] } | null>(null);
  const [linkError, setLinkError] = useState("");
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [form, setForm] = useState({ name: "", email: "", phone: "", vehicleNo: "", hubCode: "" });
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");
  const [session, setSession] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [provider, setProvider] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const loadStatus = useCallback(async (s: string) => {
    try {
      const [home, dash] = await Promise.all([
        portalApi<{ enrollment: Enrollment }>(s, "rider-home"),
        portalApi<{ enabledKycProviders?: { defaultProvider?: string; voveIdEnabled?: boolean } }>(s, "delivery-dashboard"),
      ]);
      setEnrollment(home.enrollment);
      const kp = dash.enabledKycProviders;
      setProvider(kp?.defaultProvider === "voveid" && kp.voveIdEnabled ? "voveid" : kp?.defaultProvider || "manual");
    } catch {
      localStorage.removeItem(storeKey);
      setSession("");
    }
  }, [storeKey]);

  useEffect(() => {
    joinApi<{ label: string; hubCode: string; hubs: Hub[] }>({ action: "link", token })
      .then((l) => {
        setLink(l);
        setForm((f) => ({ ...f, hubCode: l.hubCode || f.hubCode }));
      })
      .catch((e) => setLinkError(e.message));
    const saved = localStorage.getItem(storeKey) || "";
    if (!saved) return;
    const back = new URLSearchParams(window.location.search).get("kyc") === "done";
    (async () => {
      await Promise.resolve();
      setSession(saved);
      if (back) {
        await portalApi(saved, "delivery-kyc-voveid-sync").catch(() => null);
        window.history.replaceState(null, "", window.location.pathname);
      }
      await loadStatus(saved);
    })();
  }, [token, storeKey, loadStatus]);

  const sendCode = () =>
    run(async () => {
      const res = await joinApi<{ message: string }>({ action: "send-code", token, signup: mode === "signup", ...form });
      setOtpSent(true);
      setMsg(res.message);
    });

  const verify = () =>
    run(async () => {
      const res = await joinApi<{ token: string }>({ action: "verify-code", token, email: form.email, code });
      localStorage.setItem(storeKey, res.token);
      setSession(res.token);
      setMsg("");
      await loadStatus(res.token);
    });

  const startKyc = () =>
    run(async () => {
      const res = await portalApi<{ url: string }>(session, "delivery-kyc-voveid-start", {
        returnUrl: `https://vaidyagogate.org/rider/join/${token}?kyc=done`,
        restart: enrollment?.kyc?.provider === "voveid" && enrollment?.kyc?.status !== "Not Started",
      });
      window.location.href = res.url;
    });

  const signOut = () => {
    localStorage.removeItem(storeKey);
    setSession("");
    setEnrollment(null);
    setOtpSent(false);
    setCode("");
  };

  const kycStatus = enrollment?.kyc?.status || "Not Started";
  const kycDone = ["Approved", "In Review", "Manual Review", "Submitted"].includes(kycStatus);
  const activated = enrollment?.status === "approved";

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wider text-burgundy">Vaidya Gogate Memorial Foundation</p>
      <h1 className="mt-1 text-2xl font-bold">Join as a delivery partner</h1>
      {link ? <p className="mt-1 text-sm text-text-muted">{link.label}{link.hubCode ? ` · Hub ${link.hubCode}` : ""}</p> : null}

      <div className="mt-6 space-y-4 rounded-2xl border border-border bg-white p-5 shadow-sm">
        {linkError ? (
          <p className="text-sm font-semibold text-red-700">{linkError}</p>
        ) : !link ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : session && enrollment ? (
          <>
            <ol className="space-y-2 text-sm">
              <li>✓ Account created and email verified</li>
              <li>{kycDone ? "✓" : "○"} ID verification (KYC): <b>{kycStatus}</b></li>
              <li>{activated ? "✓" : "○"} Hub activation{enrollment.hubCode ? ` (${enrollment.hubCode})` : ""}: <b>{activated ? "Active" : enrollment.status === "rejected" ? "Rejected" : "Waiting"}</b></li>
              <li>{activated ? "✓" : "○"} User ID and password emailed to you</li>
            </ol>
            {activated ? (
              <p className="rounded-xl bg-green-50 p-3 text-sm text-green-900">
                Your account is active. Your 5-digit user ID and password were emailed to you. Install the{" "}
                <a className="font-semibold underline" href="/apps/vgmf-delivery.apk">VGMF Delivery app</a> and sign in with them.
              </p>
            ) : kycDone ? (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                {kycStatus === "Approved" ? "Your ID is verified." : "Your ID is being checked."} The hub will activate your account. After that, your user ID and password are emailed to you.
              </p>
            ) : provider === "voveid" ? (
              <>
                <p className="text-sm text-text-muted">Keep your ID card (Aadhaar, PAN, driving licence, voter ID or passport) ready. You will photograph it and take a live selfie. Allow camera access when asked.</p>
                <button className={button} disabled={busy} onClick={startKyc}>{busy ? "Opening…" : kycStatus === "Not Started" ? "Start ID verification" : "Continue ID verification"}</button>
              </>
            ) : (
              <p className="text-sm text-text-muted">Online ID verification is not switched on yet. The hub will contact you to complete KYC.</p>
            )}
            <div className="flex gap-2">
              <button className={ghost} disabled={busy} onClick={() => void loadStatus(session)}>Refresh status</button>
              <button className={ghost} onClick={signOut}>Sign out</button>
            </div>
          </>
        ) : otpSent ? (
          <>
            <p className="text-sm">{msg}</p>
            <input className={`${input} font-mono tracking-widest`} inputMode="numeric" maxLength={6} placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            <button className={button} disabled={busy || code.length !== 6} onClick={verify}>Verify email</button>
            <button className={ghost} disabled={busy} onClick={() => run(async () => { const r = await joinApi<{ message: string }>({ action: "send-code", token, email: form.email }); setMsg(r.message); })}>Send the code again</button>
            <button className="text-sm text-text-muted underline" onClick={() => setOtpSent(false)}>Change details</button>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-1 rounded-full bg-gray-100 p-1 text-sm font-semibold">
              {(["signup", "signin"] as const).map((m) => (
                <button key={m} className={`rounded-full py-2 ${mode === m ? "bg-white text-burgundy shadow-sm" : "text-text-muted"}`} onClick={() => setMode(m)}>
                  {m === "signup" ? "Sign up" : "Sign in"}
                </button>
              ))}
            </div>
            {mode === "signup" ? <input className={input} placeholder="Full name (as on your ID)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /> : null}
            <input className={input} type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            {mode === "signup" ? (
              <>
                <input className={input} inputMode="tel" placeholder="Mobile number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <input className={input} placeholder="Vehicle number (optional)" value={form.vehicleNo} onChange={(e) => setForm({ ...form, vehicleNo: e.target.value.toUpperCase() })} />
                {link.hubCode ? null : (
                  <select className={input} value={form.hubCode} onChange={(e) => setForm({ ...form, hubCode: e.target.value })}>
                    <option value="">Choose your hub</option>
                    {link.hubs.map((h) => <option key={h.code} value={h.code}>{h.name} ({h.code}){h.city ? ` · ${h.city}` : ""}</option>)}
                  </select>
                )}
              </>
            ) : null}
            <button className={button} disabled={busy || !form.email || (mode === "signup" && (!form.name || !form.phone || !form.hubCode))} onClick={sendCode}>
              {mode === "signup" ? "Sign up and verify email" : "Email me a sign-in code"}
            </button>
            {mode === "signup" ? <p className="text-xs text-text-muted">You don&apos;t choose a password. After the hub activates you, your 5-digit user ID and password are emailed to you.</p> : null}
          </>
        )}
        {err ? <p className="text-sm font-semibold text-red-700">{err}</p> : null}
      </div>
    </main>
  );
}
