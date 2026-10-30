"use client";

import { useEffect, useState } from "react";

type Status = {
  cloudflare: { configured: boolean };
  googleDrive: { configured: boolean };
};

const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const button = "rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";

export function MediaStorageDesk() {
  const [status, setStatus] = useState<Status | null>(null);
  const [cloudflare, setCloudflare] = useState({ accountId: "", apiToken: "", accountHash: "" });
  const [googleDrive, setGoogleDrive] = useState({ folderId: "", clientEmail: "", privateKey: "" });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/media/config", { credentials: "same-origin" })
      .then((response) => response.json())
      .then((data) => {
        if (data.ok) setStatus(data);
      })
      .catch(() => undefined);
  }, []);

  const save = async () => {
    setBusy(true);
    setNote("");
    try {
      const response = await fetch("/api/media/config", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cloudflare, googleDrive }),
      });
      const data = (await response.json()) as Status & { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Could not save.");
      setStatus(data);
      setCloudflare({ accountId: "", apiToken: "", accountHash: "" });
      setGoogleDrive({ folderId: "", clientEmail: "", privateKey: "" });
      setNote("Saved. Uploads now use this storage.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Media storage</h1>
        <p className="mt-1 text-sm text-slate-500">
          Photographs, logos and posters go to Cloudflare Images. Videos, PDFs and other files go to Google Drive. Keys stay on the server.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
          Cloudflare Images: {status?.cloudflare.configured ? "connected" : "not connected"}
        </p>
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
          Google Drive: {status?.googleDrive.configured ? "connected" : "not connected"}
        </p>
      </div>
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <p className="font-semibold text-slate-900">Cloudflare Images</p>
        <input className={field} placeholder="Account ID" value={cloudflare.accountId} onChange={(event) => setCloudflare({ ...cloudflare, accountId: event.target.value })} autoComplete="off" />
        <input className={field} type="password" placeholder="API token" value={cloudflare.apiToken} onChange={(event) => setCloudflare({ ...cloudflare, apiToken: event.target.value })} autoComplete="new-password" />
        <input className={field} placeholder="Images account hash" value={cloudflare.accountHash} onChange={(event) => setCloudflare({ ...cloudflare, accountHash: event.target.value })} autoComplete="off" />
      </div>
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <p className="font-semibold text-slate-900">Google Drive</p>
        <input className={field} placeholder="Shared folder ID" value={googleDrive.folderId} onChange={(event) => setGoogleDrive({ ...googleDrive, folderId: event.target.value })} autoComplete="off" />
        <input className={field} placeholder="Service account email" value={googleDrive.clientEmail} onChange={(event) => setGoogleDrive({ ...googleDrive, clientEmail: event.target.value })} autoComplete="off" />
        <textarea className={field} rows={4} placeholder="Service account private key" value={googleDrive.privateKey} onChange={(event) => setGoogleDrive({ ...googleDrive, privateKey: event.target.value })} autoComplete="off" />
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className={button} disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save storage"}
        </button>
        {note ? <p className="text-sm text-slate-700">{note}</p> : null}
      </div>
    </div>
  );
}
