"use client";

import { useCallback, useEffect, useState } from "react";

type Notif = {
  id: string;
  title: string;
  body: string;
  category: "announcement" | "offer" | "event" | "update" | "order";
  href: string;
  target: string;
  active: boolean;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  pushSentCount?: number;
};

type OrderStageTpl = {
  key: "ordered" | "packed" | "shipped" | "out_for_delivery" | "delivered";
  label: string;
  enabled: boolean;
  title: string;
  body: string;
};

const SCREENS = [
  { value: "/", label: "Home" },
  { value: "/shop", label: "Bookshop" },
  { value: "/events", label: "Events & Seminars" },
  { value: "/seminar-videos", label: "Seminar Videos" },
  { value: "/notices", label: "Notice Board" },
  { value: "/clinics", label: "Clinics" },
  { value: "/account/orders", label: "My Orders" },
  { value: "/explore", label: "Explore Foundation" },
];

const input = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900";

export function MobileNotificationsPanel() {
  const [list, setList] = useState<Notif[]>([]);
  const [stages, setStages] = useState<OrderStageTpl[]>([]);
  const [stageBusy, setStageBusy] = useState(false);
  const [stageNote, setStageNote] = useState("");
  const [deviceCount, setDeviceCount] = useState(0);
  const [fcmReady, setFcmReady] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<Notif["category"]>("announcement");
  const [href, setHref] = useState("/");
  const [target, setTarget] = useState("all");
  const [active, setActive] = useState(true);
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/mobile-notifications", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        setList(data.notifications ?? []);
        setStages(data.orderStages ?? []);
        setDeviceCount(Number(data.deviceCount) || 0);
        setFcmReady(Boolean(data.fcmConfigured));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStage = (key: OrderStageTpl["key"], patch: Partial<OrderStageTpl>) => {
    setStages((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  };

  const saveStages = async () => {
    setStageBusy(true);
    setStageNote("");
    try {
      const res = await fetch("/api/admin/mobile-notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "save-stages", orderStages: stages }),
      });
      const data = await res.json();
      if (data.ok) {
        setStages(data.orderStages ?? stages);
        setStageNote("Saved! All 5 Order Stage notifications (Ordered, Packed, Shipped, Out for Delivery, Delivered) are now live in Customer App Push & Inbox.");
      } else {
        setStageNote(data.error || "Could not save stage notifications.");
      }
    } catch (err) {
      setStageNote(err instanceof Error ? err.message : "Could not save stage notifications.");
    } finally {
      setStageBusy(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setCategory("announcement");
    setHref("/");
    setTarget("all");
    setActive(true);
    setPinned(false);
  };

  const startEdit = (n: Notif) => {
    setEditingId(n.id);
    setTitle(n.title);
    setBody(n.body);
    setCategory(n.category);
    setHref(n.href || "/");
    setTarget(n.target || "all");
    setActive(n.active !== false);
    setPinned(Boolean(n.pinned));
    setNote("");
  };

  const save = async (sendPush: boolean) => {
    if (!title.trim() || !body.trim()) {
      setNote("Enter both notification title and message.");
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/admin/mobile-notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "save",
          id: editingId || undefined,
          title: title.trim(),
          body: body.trim(),
          category,
          href,
          target: target.trim() || "all",
          active,
          pinned,
          sendPush,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setNote(data.error || "Could not save notification.");
        return;
      }
      setList(data.notifications ?? []);
      setNote(
        editingId
          ? sendPush
            ? `Notification updated & pushed (${data.pushed ?? 0} device(s)).`
            : "Notification updated live in the mobile app inbox."
          : sendPush
            ? `Notification published & pushed (${data.pushed ?? 0} device(s)).`
            : "Notification added live to the mobile app inbox."
      );
      resetForm();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not save notification.");
    } finally {
      setBusy(false);
    }
  };

  const resendPush = async (id: string) => {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/admin/mobile-notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "push", id }),
      });
      const data = await res.json();
      if (data.ok) {
        setList(data.notifications ?? []);
        setNote(`Push notification sent to ${data.pushed ?? 0} registered device(s).`);
      } else {
        setNote(data.error || "Could not send push.");
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this mobile app notification?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/mobile-notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = await res.json();
      if (data.ok) {
        setList(data.notifications ?? []);
        if (editingId === id) resetForm();
        setNote("Notification removed from the mobile app.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Order Event Stage Notifications (Ordered, Packed, Shipped, Out for Delivery, Delivered) */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Customer App Order Event Notifications</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Automatically sent as Push + In-App Notifications for <strong>Ordered</strong>, <strong>Packed</strong>, <strong>Shipped</strong>, <strong>Out for Delivery</strong>, and <strong>Delivered</strong>. Variables: <code>{"{orderId}"}</code>, <code>{"{name}"}</code>, <code>{"{items}"}</code>, <code>{"{total}"}</code>, <code>{"{courier}"}</code>, <code>{"{awb}"}</code>, <code>{"{eta}"}</code>.
            </p>
          </div>
          <button type="button" disabled={stageBusy} onClick={() => void saveStages()} className="rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {stageBusy ? "Saving…" : "Save Order Stage Notifications"}
          </button>
        </div>

        {stageNote ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{stageNote}</p> : null}

        <div className="space-y-3">
          {stages.map((st) => (
            <div key={st.key} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-semibold text-slate-900">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                  {st.label}
                </span>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-burgundy"
                    checked={st.enabled}
                    onChange={(e) => updateStage(st.key, { enabled: e.target.checked })}
                  />
                  Enabled in Customer App
                </label>
              </div>
              <div className="grid gap-2.5 md:grid-cols-2">
                <label className="text-xs font-medium text-slate-600">
                  Notification Title
                  <input
                    className={`${input} mt-1`}
                    value={st.title}
                    onChange={(e) => updateStage(st.key, { title: e.target.value })}
                  />
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Notification Message
                  <input
                    className={`${input} mt-1`}
                    value={st.body}
                    onChange={(e) => updateStage(st.key, { body: e.target.value })}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Custom Broadcast & Targeted Mobile App Notifications */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Broadcast &amp; Custom App Notifications</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Create, edit, pin, hide, or push live announcements to the VGMF Customer mobile app inbox ({deviceCount} registered phone{deviceCount === 1 ? "" : "s"} · FCM {fcmReady ? "connected" : "in-app inbox active"}).
            </p>
          </div>
          {editingId ? (
            <button type="button" onClick={resetForm} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
              Cancel edit
            </button>
          ) : null}
        </div>

        {note ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{note}</p> : null}

        <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Notification Title
            <input className={`${input} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New Kannada Edition Now Available!" />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Message Body
            <textarea className={`${input} mt-1 min-h-[84px]`} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the notification message shown inside the mobile app…" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Category
            <select className={`${input} mt-1`} value={category} onChange={(e) => setCategory(e.target.value as Notif["category"])}>
              <option value="announcement">Announcement</option>
              <option value="offer">Offer / Bookshop</option>
              <option value="event">Event / Seminar</option>
              <option value="update">App Update</option>
              <option value="order">Order Notice</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Open App Screen on Tap
            <select className={`${input} mt-1`} value={href} onChange={(e) => setHref(e.target.value)}>
              {SCREENS.map((s) => <option key={s.value} value={s.value}>{s.label} ({s.value})</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Audience (type &ldquo;all&rdquo; or specific customer email)
            <input className={`${input} mt-1`} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="all" />
          </label>
          <div className="flex flex-wrap items-center gap-4 pt-5 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-burgundy" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Visible in app
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-burgundy" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              Pin to top
            </label>
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-2 pt-1">
            <button type="button" disabled={busy} onClick={() => void save(true)} className="rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? "Saving…" : editingId ? "Update & Push to Phones" : "Publish & Push to Phones"}
            </button>
            <button type="button" disabled={busy} onClick={() => void save(false)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
              {editingId ? "Save Update (In-App Only)" : "Save to In-App Inbox"}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">Published Custom Notifications ({list.length})</h3>
          {list.length === 0 ? (
            <p className="text-sm text-slate-500">No custom app notifications yet. Create one above to broadcast to customer phones.</p>
          ) : (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {list.map((n) => (
                <div key={n.id} className="flex flex-wrap items-start justify-between gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{n.title}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-700">{n.category}</span>
                      {n.pinned ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Pinned</span> : null}
                      {!n.active ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">Hidden</span> : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{n.body}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Audience: {n.target === "all" ? "All users" : n.target} · Screen: {n.href}
                      {n.sentAt ? ` · Last pushed ${new Date(n.sentAt).toLocaleString("en-IN")} (${n.pushSentCount ?? 0})` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" disabled={busy} onClick={() => startEdit(n)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                      Edit / Update
                    </button>
                    <button type="button" disabled={busy} onClick={() => void resendPush(n.id)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                      Push Now
                    </button>
                    <button type="button" disabled={busy} onClick={() => void remove(n.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
