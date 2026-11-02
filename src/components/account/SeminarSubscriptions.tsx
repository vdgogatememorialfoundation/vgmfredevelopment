"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SectionHeader from "@/components/account/SectionHeader";

type Access = { allowed?: boolean; reason?: string | null };

type Video = {
  id: number;
  year: number;
  title: string;
  kind: string;
  albumId?: number | null;
  priceInr?: number;
  priceTbd?: boolean;
  personalPrice?: boolean;
  access?: Access;
};

type Year = {
  year: number;
  title: string;
  allAllowed?: boolean;
  videos: Video[];
};

type Row = { title: string; meta: string; state: string };

function accessLabel(access?: Access) {
  if (!access?.allowed) return "";
  if (access.reason === "public") return "Free";
  if (access.reason === "volunteer") return "Free for volunteers";
  if (access.reason === "attended_certified") return "Included — registered, attended, certificate issued";
  if (access.reason === "paid_absent" || access.reason === "registered_paid" || access.reason === "registered") return "Included — registered and paid";
  if (access.reason === "paid_other") return "Included — checked in";
  if (access.reason === "registered_scanned") return "Included — registered, paid, ticket scanned";
  if (access.reason === "purchase") return "Purchased";
  if (access.reason === "admin_paid") return "Payment recorded by the seminar office";
  return "Enabled by the seminar office";
}

function money(value?: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function statusFor(item: Video) {
  if (item.access?.allowed) return accessLabel(item.access) || "Included";
  if (item.priceTbd && !item.personalPrice) return "Price will be updated later";
  if ((item.priceInr || 0) > 0) return `Locked · ${money(item.priceInr)}`;
  return "Locked";
}

function rowsFrom(years: Year[]) {
  const rows: Row[] = [];
  for (const year of years) {
    const videos = year.videos || [];
    const albums = videos.filter((item) => item.kind === "album");
    const albumIds = new Set(albums.map((item) => item.id));
    const partsOf = new Map<number, Video[]>();
    const singles: Video[] = [];
    for (const item of videos) {
      if (item.kind === "album") continue;
      if (item.albumId && albumIds.has(item.albumId)) {
        const list = partsOf.get(item.albumId) || [];
        list.push(item);
        partsOf.set(item.albumId, list);
      } else singles.push(item);
    }
    if (year.allAllowed && videos.length) {
      const sample = videos.find((item) => item.access?.allowed);
      rows.push({ title: year.title || `Seminar ${year.year}`, meta: "Whole year", state: accessLabel(sample?.access) || "Included" });
    }
    for (const album of albums) {
      rows.push({
        title: album.title,
        meta: `Album · ${year.year} · ${(partsOf.get(album.id) || []).length} parts`,
        state: statusFor(album),
      });
    }
    for (const item of singles) {
      rows.push({ title: item.title, meta: `Single video · ${year.year}`, state: statusFor(item) });
    }
  }
  return rows;
}

export function SeminarSubscriptions() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [license, setLicense] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancel = false;
    void fetch("/api/seminar-videos", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as {
          linked?: boolean;
          error?: string;
          catalog?: { years?: Year[]; license?: string };
        } | null;
        if (cancel) return;
        if (response.status === 401) {
          setNote("Sign in to see your subscription.");
          setRows([]);
          return;
        }
        if (data?.linked === false) {
          setNote(data.error || "No seminar account matches this sign-in.");
          setRows([]);
          return;
        }
        if (!response.ok) {
          setNote(data?.error || "Seminar subscriptions could not be loaded.");
          setRows([]);
          return;
        }
        setLicense(String(data?.catalog?.license || ""));
        setRows(rowsFrom(data?.catalog?.years || []));
      })
      .catch(() => {
        if (!cancel) {
          setNote("Seminar subscriptions could not be loaded.");
          setRows([]);
        }
      });
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <div>
      <SectionHeader title="Subscriptions" />
      {license && <p className="mb-4 text-sm text-text-muted">License ID <strong className="text-ink">{license}</strong></p>}
      {rows === null && <p className="text-sm text-text-muted">Loading…</p>}
      {rows && rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Access</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.meta}:${row.title}`} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 font-medium text-ink">{row.title}</td>
                  <td className="px-4 py-3 text-text-muted">{row.meta}</td>
                  <td className="px-4 py-3">{row.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows && rows.length === 0 && <p className="text-sm text-text-muted">{note || "No seminar videos yet."}</p>}
      <Link href="/videos/seminars" className="btn-outline mt-5 inline-flex">Open seminar videos</Link>
    </div>
  );
}
