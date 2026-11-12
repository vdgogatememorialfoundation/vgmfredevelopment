"use client";

import { orderItemBatch } from "@/lib/product-data";
import { useEffect, useRef, useState } from "react";
import { Button, Panel, TextInput } from "@/components/admin/AdminUI";
import { BarcodeCamera } from "@/components/admin/BarcodeCamera";
import { acceptPick, assignPicker, confirmPacked, pickPackChecklist, pickPackLeft, reassignPickPack, getAccounts, getOrder, patchOrder, printPackagingSlips, recordPickScan } from "@/lib/admin-store";
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
    if (!pick.pickedAt) {
      if (!pick.pickOrderScannedAt) return "Pick step 1: scan the order code (barcode or QR) on the packaging slip.";
      return `Pick step 2: scan each item's product code and SKU. Still to scan: ${pickPackLeft(order, "pick")}.`;
    }
    if (pick.packedAt) return "Packed. Ready for pickup.";
    if (!pick.boxScannedAt) return "Pack step 1: scan the box code (BOX-…) on the packaging slip.";
    if (!pick.orderScannedAt) return "Pack step 2: scan the order code (barcode or QR) on the packaging slip.";
    const rest = pickPackLeft(order, "pack");
    if (rest) return `Pack step 3: scan each item's SKU, and ISBN for books, as it goes into the box. Still to scan: ${rest}.`;
    if (!order.packPhotos?.length) return "Pack step 4: tap Add packing photos and photograph the items in the open box.";
    return "Pack step 5: check the items match the order description, then tap Items match — mark packed.";
  };

  const confirm = (orderId: string) => {
    try {
      setError("");
      setNote(confirmPacked(orderId));
    } catch (problem) {
      setNote("");
      setError(problem instanceof Error ? problem.message : "Could not mark packed.");
    }
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
                <li>Scan the <b>order code</b> (barcode or QR) on the packaging slip.</li>
                <li>For each item, scan its <b>product code</b> (barcode sticker) and its <b>SKU</b>. Scan the product code once for every copy: 2 copies means 2 scans.</li>
                <li>If the camera can&apos;t read a code, type it in the box and tap <b>Record scan</b>.</li>
                <li>Every step is required. When every item is done, the order moves to the packer.</li>
              </ol>
            </div>
          ) : null}
          {mode !== "pick" ? (
            <div className="mt-2">
              <p className="font-semibold text-slate-900">Packer</p>
              <ol className="ml-5 list-decimal space-y-1">
                <li>Print the slip with <b>Download packaging slips</b>, then tap <b>Scan for this order</b>.</li>
                <li>Scan the <b>box code</b> (BOX-…) on the slip.</li>
                <li>Scan the <b>order code</b> (barcode or QR) on the slip.</li>
                <li>Scan each item&apos;s <b>SKU</b> as it goes into the box, once per copy, and its <b>ISBN</b> too if it is a book.</li>
                <li>Tap <b>Add packing photos</b> and photograph the items in the open box. Only the desk sees these photos.</li>
                <li>Check the items match the order description, then tap <b>Items match — mark packed</b>. The order is then ready for pickup, and admin assigns the courier.</li>
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
                {order.pick?.acceptedAt ? <ScanChecklist order={order} /> : null}
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
                  {order.pick?.pickedAt && order.pick.boxScannedAt && order.pick.orderScannedAt && !pickPackLeft(order, "pack") ? (
                    <Button disabled={!order.packPhotos?.length} onClick={() => confirm(order.id)}>Items match — mark packed</Button>
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

function ScanMark({ label, done }: { label: string; done: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${done ? "bg-emerald-100 text-emerald-800" : "bg-red-50 text-red-700"}`}>
      {done ? "✓" : "○"} {label} · {done ? "Scanned" : "Not scanned"}
    </span>
  );
}

function ScanChecklist({ order }: { order: Order }) {
  const list = pickPackChecklist(order);
  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 text-sm">
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{list.stage === "pick" ? "Picker checklist" : "Packer checklist"}</p>
      <div className="flex flex-wrap gap-1">
        {list.steps.map((step) => <ScanMark key={step.label} label={step.label} done={step.done} />)}
      </div>
      {list.items.map((item) => (
        <div key={item.id} className="mt-1.5">
          <p className="font-medium text-slate-800">{item.title}</p>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {item.codes.map((code) => <ScanMark key={code.label} label={code.label} done={code.done} />)}
          </div>
        </div>
      ))}
      {list.finish.length ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {list.finish.map((step) => (
            <span key={step.label} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${step.done ? "bg-emerald-100 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
              {step.done ? "✓" : "○"} {step.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
