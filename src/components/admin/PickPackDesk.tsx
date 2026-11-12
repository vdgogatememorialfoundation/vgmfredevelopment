"use client";

import { orderItemBatch } from "@/lib/product-data";
import { useEffect, useRef, useState } from "react";
import { Button, Panel, TextInput } from "@/components/admin/AdminUI";
import { BarcodeCamera } from "@/components/admin/BarcodeCamera";
import { acceptPick, assignPicker, reassignPickPack, getAccounts, getOrder, patchOrder, printPackagingSlips, recordPickScan } from "@/lib/admin-store";
import { uploadMediaFile } from "@/lib/media-client";
import { getOrders } from "@/lib/store";
import { getSession } from "@/lib/auth";
import { useCommerceMirror } from "@/lib/commerce-sync";
import type { Order } from "@/types";
import { beep } from "@/lib/scan-beep";
import { getOrderSettings } from "@/lib/integrations";

const OPEN = new Set(["Paid", "Ordered", "Accepted", "Processing", "Awaiting Confirmation", "To Ship"]);

let ringer: AudioContext | null = null;

/** Phones only play sound from an audio context started by a tap, so one is opened on the first tap and reused. */
function unlockRinger() {
  try {
    const Context = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    ringer ??= new Context();
    void ringer.resume();
  } catch {
    /* no audio on this device */
  }
}

function ring() {
  try {
    navigator.vibrate?.([400, 150, 400, 150, 400]);
  } catch {
    /* no vibration */
  }
  try {
    const audio = ringer;
    if (!audio) return;
    void audio.resume();
    [0, 0.35, 0.7].forEach((delay) => {
      const tone = audio.createOscillator();
      const gain = audio.createGain();
      tone.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, audio.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + delay + 0.3);
      tone.connect(gain).connect(audio.destination);
      tone.start(audio.currentTime + delay);
      tone.stop(audio.currentTime + delay + 0.3);
    });
  } catch {
    /* sound blocked until the page is tapped */
  }
}

/** Android Chrome has no `new Notification()`; it only shows alerts through the service worker. */
function alertNewOrder() {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) void registration.showNotification("New order to pick", { tag: "vgmf-pick", requireInteraction: true });
        else new Notification("New order to pick");
      }).catch(() => undefined);
      return;
    }
    new Notification("New order to pick");
  } catch {
    /* the ring and the banner still show */
  }
}

const onPhone = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

/** Store pickers get assigned orders with a bell, scan items to pick, then the order QR and items to pack. */
export function PickPackDesk({ mode = "all", cameraFirst = false }: { mode?: "pick" | "pack" | "all"; cameraFirst?: boolean }) {
  const { version } = useCommerceMirror();
  const [tick, setTick] = useState(0);
  const me = getSession()?.email?.toLowerCase() ?? "";
  const role = getSession()?.role;
  const lead = role === "admin" || role === "coadmin";
  const orders = getOrders();
  void version;
  void tick;
  const mine = orders.filter(
    (order) =>
      order.pick &&
      (lead || (order.pick.pickedAt && order.pick.packer ? order.pick.packer : order.pick.assignee) === me) &&
      !order.pick.packedAt &&
      order.status !== "Cancelled" &&
      (mode === "all" || (mode === "pick" ? !order.pick.pickedAt : Boolean(order.pick.pickedAt)))
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const schedule = getOrderSettings().pickSchedule;
  const dueBy = (order: Order) => {
    const from = Date.parse((order.pick?.pickedAt ?? order.pick?.assignedAt) || "");
    if (!Number.isFinite(from)) return "";
    const due = from + (order.pick?.pickedAt ? schedule.packMinutes : schedule.pickMinutes) * 60000;
    const late = now > due;
    return `${order.pick?.pickedAt ? "Pack" : "Pick"} by ${new Date(due).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}${late ? " · late" : ""}`;
  };
  const unassigned = orders.filter((order) => OPEN.has(order.status) && !order.pick);
  const staff = getAccounts().filter((account) => account.role === "staff" || account.role === "admin" || account.role === "coadmin");
  const [active, setActive] = useState("");
  const [code, setCode] = useState("");
  const [camera, setCamera] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [assignee, setAssignee] = useState<Record<string, string>>({});
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState(false);
  const [soundReady, setSoundReady] = useState(false);

  useEffect(() => {
    const unlock = () => {
      unlockRinger();
      setSoundReady(true);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    const ids = new Set(
      mine
        .filter((order) => !order.pick?.acceptedAt || (order.pick.packer === me && !order.pick.orderScannedAt))
        .map((order) => `${order.id}:${order.pick?.assignedAt}:${order.pick?.packerAssignedAt ?? ""}`)
    );
    if (seen.current && [...ids].some((id) => !seen.current?.has(id))) {
      ring();
      alertNewOrder();
      setFresh(true);
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
      beep("success");
    } catch (problem) {
      beep("fail");
      setNote("");
      setError(problem instanceof Error ? problem.message : "Scan failed.");
    }
    setCode("");
    setTick((value) => value + 1);
  };

  const [uploading, setUploading] = useState("");
  const addPackPhotos = async (orderId: string, files: FileList | null) => {
    if (!files?.length) return;
    setUploading(orderId);
    setError("");
    try {
      const by = getSession()?.email ?? "packer";
      const added: NonNullable<Order["packPhotos"]> = [];
      for (const file of Array.from(files)) added.push({ url: await uploadMediaFile(file), at: new Date().toISOString(), by });
      patchOrder(orderId, { packPhotos: [...(getOrder(orderId)?.packPhotos ?? []), ...added] });
      setNote(`${added.length} packing photo${added.length === 1 ? "" : "s"} saved for order ${orderId}.`);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not upload the photo.");
    } finally {
      setUploading("");
      setTick((value) => value + 1);
    }
  };

  const nextStep = (order: Order) => {
    const pick = order.pick;
    if (!pick?.acceptedAt) return "Tap Accept & start picking.";
    const left = (map: Record<string, number>) =>
      order.items
        .filter((item) => (map[item.bookId] ?? 0) < item.quantity)
        .map((item) => `${item.quantity - (map[item.bookId] ?? 0)} × ${item.title}`)
        .join(", ");
    if (!pick.pickedAt) return `Pick: take each item off the shelf and scan its barcode. Still to scan: ${left(pick.picked)}.`;
    if (!pick.orderScannedAt) return "Pack: first scan the order QR on the packaging slip (or type the order number).";
    const rest = left(pick.packScan);
    return rest ? `Pack: scan each item as it goes into the box. Still to scan: ${rest}.` : "All items scanned. Add packing photos, then seal the box.";
  };

  const progress = (order: Order) => {
    const total = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const map = order.pick?.pickedAt ? order.pick.packScan : order.pick?.picked ?? {};
    const done = order.items.reduce((sum, item) => sum + Math.min(item.quantity, map[item.bookId] ?? 0), 0);
    return `${order.pick?.pickedAt ? "Packing" : "Picking"} ${done}/${total}`;
  };

  return (
    <div className="space-y-5">
      <Panel
        title={lead ? (mode === "pack" ? "Orders to pack" : mode === "pick" ? "Orders being picked" : "Pick & pack board") : "My pick list"}
        description="New assignments ring a bell. Follow the steps below; each order shows what to scan next."
        action={mine.length ? <Button variant="outline" onClick={() => printPackagingSlips(mine)}>Download packaging slips ({mine.length})</Button> : undefined}
      >
        {fresh ? (
          <button type="button" onClick={() => setFresh(false)} className="mb-3 block w-full rounded-xl bg-red-600 px-3 py-2 text-left text-sm font-semibold text-white">
            New order assigned to you. Tap to dismiss.
          </button>
        ) : null}
        {!soundReady ? (
          <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">On a phone, tap anywhere on this page once so it can ring for new orders. Keep this page open with the screen on.</p>
        ) : null}
        <details open className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <summary className="cursor-pointer font-semibold text-slate-900">What to scan</summary>
          {mode !== "pack" ? (
            <div className="mt-2">
              <p className="font-semibold text-slate-900">Picker</p>
              <ol className="ml-5 list-decimal space-y-1">
                <li>Tap <b>Accept &amp; start picking</b> on your order. The camera opens on a phone.</li>
                <li>Take each item off the shelf and scan its barcode: the barcode sticker we print, the ISBN barcode on the back of a book, or the SKU / product code on the shelf label.</li>
                <li>Scan once for every copy. 2 copies ordered means 2 scans.</li>
                <li>If the camera can&apos;t read it, type the SKU or barcode number in the box and tap <b>Record scan</b>.</li>
                <li>When every item is scanned, the order moves to the packer.</li>
              </ol>
            </div>
          ) : null}
          {mode !== "pick" ? (
            <div className="mt-2">
              <p className="font-semibold text-slate-900">Packer</p>
              <ol className="ml-5 list-decimal space-y-1">
                <li>Print the slip with <b>Download packaging slips</b>.</li>
                <li>Tap <b>Scan for this order</b>, then scan the <b>order QR</b> on the packaging slip first (or type the order number).</li>
                <li>Scan each item as you put it into the box, once per copy.</li>
                <li>Tap <b>Add packing photos</b> and photograph the items in the open box, then seal it. Only the desk sees these photos.</li>
                <li>When every item is scanned, the order is ready for dispatch.</li>
              </ol>
            </div>
          ) : null}
          <p className="mt-2 text-xs text-slate-500">A red message means the scan was not counted: the item is not in this order, or that item is already fully scanned. Put it back and check the slip.</p>
        </details>
        {mine.length === 0 ? (
          <p className="text-sm text-slate-500">{lead ? (mode === "pack" ? "Nothing is waiting to be packed. Orders appear here once every item is picked." : "No orders are being picked. Assign a picker below.") : "No orders assigned to you right now."}</p>
        ) : (
          <ul className="space-y-3">
            {mine.map((order) => (
              <li key={order.id} className={`rounded-xl border p-3 ${active === order.id ? "border-blue-400 bg-blue-50/50" : "border-slate-200"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">Order {order.id} · {order.deliveryMode === "store_pickup" ? "Store pickup" : "Courier"}{lead ? <span className="ml-1 text-xs font-normal text-slate-500">· Picker {order.pick?.assignee}{order.pick?.packer ? ` · Packer ${order.pick.packer}` : ""}</span> : null}</p>
                  <span className="text-xs font-semibold text-blue-800">
                    {order.pick?.acceptedAt ? progress(order) : "New"} · <span className={dueBy(order).endsWith("late") ? "text-red-700" : ""}>{dueBy(order)}</span>
                  </span>
                </div>
                <ul className="mt-1 text-sm text-slate-700">
                  {order.items.map((item) => (
                    <li key={item.bookId}>{item.quantity} × {item.title}{item.sku ? ` · ${item.sku}` : ""}{orderItemBatch(item) ? ` · Batch ${orderItemBatch(item)}` : ""}</li>
                  ))}
                </ul>
                <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-sm font-medium text-amber-900">Next: {nextStep(order)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {!order.pick?.acceptedAt ? (
                    <Button onClick={() => { acceptPick(order.id); setActive(order.id); setCamera(cameraFirst || onPhone()); setTick((value) => value + 1); }}>Accept & start picking</Button>
                  ) : (
                    <Button variant={active === order.id ? "primary" : "outline"} onClick={() => { setActive(order.id); setCamera(cameraFirst || onPhone()); }}>{active === order.id ? "Scanning this order" : "Scan for this order"}</Button>
                  )}
                  {order.pick?.pickedAt ? (
                    <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800">
                      {uploading === order.id ? "Uploading…" : `Add packing photos${order.packPhotos?.length ? ` (${order.packPhotos.length})` : ""}`}
                      <input type="file" accept="image/*" capture="environment" multiple className="hidden" disabled={uploading === order.id} onChange={(event) => { void addPackPhotos(order.id, event.target.files); event.target.value = ""; }} />
                    </label>
                  ) : null}
                </div>
                {lead ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" value={assignee[order.id] ?? ""} onChange={(event) => setAssignee({ ...assignee, [order.id]: event.target.value })}>
                      <option value="">{order.pick?.pickedAt ? "Choose packer…" : "Choose picker…"}</option>
                      {staff.map((account) => (
                        <option key={account.email} value={account.email.toLowerCase()}>{account.firstName} {account.lastName} · {account.email}</option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      disabled={!assignee[order.id]}
                      onClick={() => {
                        try {
                          reassignPickPack(order.id, assignee[order.id], order.pick?.pickedAt ? "pack" : "pick");
                          setAssignee({ ...assignee, [order.id]: "" });
                          setTick((value) => value + 1);
                        } catch (problem) {
                          setError(problem instanceof Error ? problem.message : "Could not reassign.");
                        }
                      }}
                    >
                      {order.pick?.pickedAt ? (order.pick.packer ? "Reassign packer" : "Assign packer") : "Reassign picker"}
                    </Button>
                  </div>
                ) : null}
                {active === order.id ? (
                  <div className="mt-3">
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-0 flex-1 basis-56">
                        <TextInput placeholder="Scan or type a product barcode / SKU or the order number" value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") scan(code); }} />
                      </div>
                      <Button variant="outline" onClick={() => scan(code)}>Record scan</Button>
                      <Button variant="outline" onClick={() => setCamera(true)}>Use camera</Button>
                    </div>
                    {note ? <p className="mt-2 text-sm text-emerald-700">{note}</p> : null}
                    {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {!active && note ? <p className="mt-2 text-sm text-emerald-700">{note}</p> : null}
        {!active && error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        {camera ? <BarcodeCamera label="Scan a product barcode or the order QR" continuous onScan={(value) => scan(value)} onClose={() => setCamera(false)} /> : null}
      </Panel>

      {lead && mode !== "pack" ? (
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
