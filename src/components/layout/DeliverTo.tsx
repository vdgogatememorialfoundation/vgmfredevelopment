"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Glyph from "@/components/store/Glyph";
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
        <Glyph name="address" className="h-4 w-4 shrink-0 text-burgundy" />
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
          <div className="mb-3 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Saved addresses</p>
              {user && (
                <Link href="/account/addresses" className="text-[11px] font-semibold text-burgundy" onClick={() => setOpen(false)}>
                  {saved.length ? "Manage" : "+ Add address"}
                </Link>
              )}
            </div>
            {!user ? (
              <Link href="/login?mode=signin" className="block rounded-lg border border-dashed border-border px-3 py-2 text-xs text-text-muted hover:bg-warm-cream" onClick={() => setOpen(false)}>
                <b className="text-burgundy">Sign in</b> to deliver to a saved address
              </Link>
            ) : saved.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-text-muted">No saved addresses yet.</p>
            ) : (
              saved.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => apply(item.pincode, item.id)}
                  className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-xs ${address?.id === item.id ? "border-burgundy bg-burgundy/5" : "border-border hover:bg-warm-cream"}`}
                >
                  <Glyph name={item.place === "office" ? "office" : "home"} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-burgundy" />
                  <span>
                    <span className="font-semibold text-text-primary">{item.place === "office" ? "Office" : "Home"}{item.isDefault ? " · default" : ""} · {item.fullName}</span>
                    <span className="block text-text-muted">{[item.line1, item.city].filter(Boolean).join(", ")} · {item.pincode}</span>
                  </span>
                </button>
              ))
            )}
          </div>
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
