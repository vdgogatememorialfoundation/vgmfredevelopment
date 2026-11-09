"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { useSavedAddresses } from "@/lib/account-wallet";
import { saveDeliverTo, useDeliverTo } from "@/lib/deliver-to";

/** "Delivering to …" chip in the header; customers switch pincode or saved address here. */
export function DeliverTo() {
  const { user } = useAuth();
  const saved = useSavedAddresses(user?.email);
  const chosen = useDeliverTo();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const fallback = saved.find((item) => item.isDefault) ?? saved[0];
  const pincode = chosen?.pincode || fallback?.pincode?.replace(/\D/g, "").slice(0, 6) || "";
  const address = saved.find((item) => item.id === chosen?.addressId) ?? (chosen ? saved.find((item) => item.pincode.replace(/\D/g, "") === chosen.pincode) : fallback);
  const label = pincode ? [address?.city, pincode].filter(Boolean).join(" ") : "";

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const apply = (value: string, addressId?: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    if (digits.length !== 6) return;
    saveDeliverTo({ pincode: digits, addressId });
    setOpen(false);
  };

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => {
          setCode(pincode);
          setOpen((value) => !value);
        }}
        className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-1 text-xs text-text-primary hover:text-burgundy"
        aria-expanded={open}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        <span className="truncate">
          {label ? (
            <>
              Delivering to <b className="font-semibold">{label}</b>
            </>
          ) : (
            "Select delivery pincode"
          )}
        </span>
        <span className="font-semibold text-burgundy">Change</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-white p-3 shadow-lg">
          {saved.length > 0 && (
            <div className="mb-3 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Saved addresses</p>
              {saved.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => apply(item.pincode, item.id)}
                  className={`block w-full rounded-lg border px-3 py-2 text-left text-xs ${address?.id === item.id ? "border-burgundy bg-burgundy/5" : "border-border hover:bg-warm-cream"}`}
                >
                  <span className="font-semibold text-text-primary">{item.fullName}</span>
                  <span className="block text-text-muted">{[item.line1, item.city].filter(Boolean).join(", ")} · {item.pincode}</span>
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Or enter a pincode</p>
          <div className="mt-1 flex gap-2">
            <input
              className="input-field py-2 text-sm"
              inputMode="numeric"
              placeholder="6-digit pincode"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(event) => {
                if (event.key === "Enter") apply(code);
              }}
            />
            <button type="button" className="btn-primary shrink-0 px-4 py-2 text-xs" onClick={() => apply(code)}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
