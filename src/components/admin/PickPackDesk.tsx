"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Panel, TextInput } from "@/components/admin/AdminUI";
import { BarcodeCamera } from "@/components/admin/BarcodeCamera";
import { acceptPick, assignPicker, getAccounts, recordPickScan } from "@/lib/admin-store";
import { getOrders } from "@/lib/store";
import { getSession } from "@/lib/auth";
import { useCommerceMirror } from "@/lib/commerce-sync";
import type { Order } from "@/types";

const OPEN = new Set(["Ordered", "Accepted", "Processing", "Awaiting Confirmation"]);

function ring() {
  try {
    const audio = new AudioContext();
    [0, 0.35].forEach((delay) => {
      const tone = audio.createOscillator();
      const gain = audio.createGain();
      tone.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, audio.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + delay + 0.3);
      tone.connect(gain).connect(audio.destination);
      tone.start(audio.currentTime + delay);
      tone.stop(audio.currentTime + delay + 0.3);
    });
  } catch {
    /* sound blocked until the page is tapped */
  }
}

/** Store pickers get assigned orders with a bell, scan items to pick, then the order QR and items to pack. */
export function PickPackDesk() {
  const { version } = useCommerceMirror();
  const [tick, setTick] = useState(0);
  const me = getSession()?.email?.toLowerCase() ?? "";
  const role = getSession()?.role;
  const lead = role === "admin" || role === "coadmin";
  const orders = getOrders();
  void version;
  void tick;
  const mine = orders.filter((order) => order.pick?.assignee === me && !order.pick.packedAt && order.status !== "Cancelled");
  const unassigned = orders.filter((order) => OPEN.has(order.status) && !order.pick);
  const staff = getAccounts().filter((account) => account.role === "staff" || account.role === "admin" || account.role === "coadmin");
  const [active, setActive] = useState("");
  const [code, setCode] = useState("");
  const [camera, setCamera] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [assignee, setAssignee] = useState<Record<string, string>>({});
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const ids = new Set(mine.filter((order) => !order.pick?.acceptedAt).map((order) => order.id));
    if (seen.current && [...ids].some((id) => !seen.current?.has(id))) {
      ring();
      if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("New order to pick");
    }
    seen.current = ids;
  });

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 15000);
    if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission();
    return () => window.clearInterval(timer);
  }, []);

  const scan = (value: string) => {
    if (!active || !value.trim()) return;
    try {
      setError("");
      setNote(recordPickScan(active, value));
    } catch (problem) {
      setNote("");
      setError(problem instanceof Error ? problem.message : "Scan failed.");
    }
    setCode("");
    setTick((value) => value + 1);
  };

  const progress = (order: Order) => {
    const total = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const map = order.pick?.pickedAt ? order.pick.packScan : order.pick?.picked ?? {};
    const done = order.items.reduce((sum, item) => sum + Math.min(item.quantity, map[item.bookId] ?? 0), 0);
    return `${order.pick?.pickedAt ? "Packing" : "Picking"} ${done}/${total}`;
  };

  return (
    <div className="space-y-5">
      <Panel title="My pick list" description="New assignments ring a bell. Accept, scan each product to pick it, then scan the order QR and each product again to pack. Packed orders become ready for dispatch.">
        {mine.length === 0 ? (
          <p className="text-sm text-slate-500">No orders assigned to you right now.</p>
        ) : (
          <ul className="space-y-3">
            {mine.map((order) => (
              <li key={order.id} className={`rounded-xl border p-3 ${active === order.id ? "border-blue-400 bg-blue-50/50" : "border-slate-200"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">Order {order.id} · {order.deliveryMode === "store_pickup" ? "Store pickup" : "Courier"}</p>
                  <span className="text-xs font-semibold text-blue-800">{order.pick?.acceptedAt ? progress(order) : "New"}</span>
                </div>
                <ul className="mt-1 text-sm text-slate-700">
                  {order.items.map((item) => (
                    <li key={item.bookId}>{item.quantity} × {item.title}{item.sku ? ` · ${item.sku}` : ""}</li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap gap-2">
                  {!order.pick?.acceptedAt ? (
                    <Button onClick={() => { acceptPick(order.id); setActive(order.id); setTick((value) => value + 1); }}>Accept & start picking</Button>
                  ) : (
                    <Button variant={active === order.id ? "primary" : "outline"} onClick={() => setActive(order.id)}>{active === order.id ? "Scanning this order" : "Scan for this order"}</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {active ? (
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div className="min-w-56 flex-1">
              <TextInput placeholder="Scan or type a product barcode / SKU or the order number" value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") scan(code); }} />
            </div>
            <Button variant="outline" onClick={() => scan(code)}>Record scan</Button>
            <Button variant="outline" onClick={() => setCamera(true)}>Use camera</Button>
          </div>
        ) : null}
        {note ? <p className="mt-2 text-sm text-emerald-700">{note}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        {camera ? <BarcodeCamera label="Scan a product barcode or the order QR" onScan={(value) => { setCamera(false); scan(value); }} onClose={() => setCamera(false)} /> : null}
      </Panel>

      {lead ? (
        <Panel title="Assign pickers" description="Confirmed orders waiting for a picker. The assigned person's scanner rings.">
          {unassigned.length === 0 ? (
            <p className="text-sm text-slate-500">Every open order has a picker.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {unassigned.slice(0, 50).map((order) => (
                <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>Order {order.id} · {order.items.reduce((sum, item) => sum + item.quantity, 0)} item(s) · {order.deliveryMode === "store_pickup" ? "Store pickup" : "Courier"}</span>
                  <span className="flex flex-wrap gap-2">
                    <select className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" value={assignee[order.id] ?? ""} onChange={(event) => setAssignee({ ...assignee, [order.id]: event.target.value })}>
                      <option value="">Choose staff</option>
                      {staff.map((account) => <option key={account.email} value={account.email}>{account.firstName} {account.lastName} · {account.email}</option>)}
                    </select>
                    <Button variant="outline" disabled={!assignee[order.id]} onClick={() => { assignPicker(order.id, assignee[order.id]); setTick((value) => value + 1); }}>Assign</Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}
    </div>
  );
}
