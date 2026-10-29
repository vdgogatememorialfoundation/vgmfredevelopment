import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { certificates as seededCertificates } from "@/data/content";
import type { IssuedCertificate } from "@/lib/cms";

export type StoredCertificate = IssuedCertificate & { updatedAt: string };

const FILE = join("/tmp", "vgmf-certificates.json");

function seed(): StoredCertificate[] {
  return seededCertificates.map((certificate) => ({
    ...certificate,
    id: certificate.certificateNumber,
    status: "Valid" as const,
    updatedAt: `${certificate.issueDate}T00:00:00.000Z`,
  }));
}

function read(): StoredCertificate[] {
  try {
    const raw = readFileSync(FILE, "utf8");
    const parsed = JSON.parse(raw) as StoredCertificate[];
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    /* first run */
  }
  const next = seed();
  write(next);
  return next;
}

function write(records: StoredCertificate[]) {
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(records));
  } catch {
    /* ephemeral host */
  }
}

export function listCertificates() {
  return read().sort((a, b) => `${b.issueDate}${b.updatedAt}`.localeCompare(`${a.issueDate}${a.updatedAt}`));
}

export function getCertificateRecord(number: string) {
  const normalized = number.trim().toUpperCase();
  return read().find((certificate) => certificate.certificateNumber.toUpperCase() === normalized) ?? null;
}

export function findValidCertificate(number: string) {
  const certificate = getCertificateRecord(number);
  if (!certificate || certificate.status === "Revoked") return null;
  return certificate;
}

function certificateYear(certificate: StoredCertificate) {
  if (certificate.year) return certificate.year;
  const source = certificate.eventDate || certificate.issueDate;
  const parsed = source ? new Date(source).getFullYear() : new Date().getFullYear();
  return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
}

export function publicCertificate(certificate: StoredCertificate) {
  return {
    certificateNumber: certificate.certificateNumber,
    name: certificate.name,
    event: certificate.event,
    certificateType: certificate.certificateType,
    eventDate: certificate.eventDate,
    issueDate: certificate.issueDate,
    signature: certificate.signature,
    status: certificate.status ?? "Valid",
    reissuedAt: certificate.reissuedAt,
    year: certificateYear(certificate),
    eventSlug: certificate.eventSlug || "",
  };
}

export function certificatesGroupedByYear(records = listCertificates()) {
  const groups = new Map<number, Map<string, ReturnType<typeof publicCertificate>[]>>();
  for (const certificate of records.filter((item) => item.status !== "Revoked")) {
    const year = certificateYear(certificate);
    const eventKey = certificate.eventSlug?.trim() || certificate.event.trim() || "Unassigned";
    if (!groups.has(year)) groups.set(year, new Map());
    const events = groups.get(year)!;
    if (!events.has(eventKey)) events.set(eventKey, []);
    events.get(eventKey)!.push(publicCertificate(certificate));
  }
  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, events]) => ({
      year,
      events: [...events.entries()].map(([key, certificates]) => ({
        event: certificates[0]?.event || key,
        eventSlug: certificates[0]?.eventSlug || key,
        certificates,
      })),
    }));
}

export function upsertCertificate(input: Partial<IssuedCertificate> & Pick<IssuedCertificate, "name" | "certificateNumber">) {
  const records = read();
  const certificateNumber = input.certificateNumber.trim().toUpperCase();
  if (!certificateNumber) throw new Error("Add a certificate number.");
  if (!input.name.trim()) throw new Error("Add the recipient name.");
  const existing = records.find(
    (certificate) => certificate.certificateNumber.toUpperCase() === certificateNumber || certificate.id === input.id
  );
  const next: StoredCertificate = {
    id: input.id?.trim() || existing?.id || certificateNumber,
    certificateNumber,
    name: input.name.trim(),
    event: (input.event ?? existing?.event ?? "").trim(),
    eventSlug: (input.eventSlug ?? existing?.eventSlug ?? "").trim(),
    year: input.year ?? existing?.year,
    certificateType: (input.certificateType ?? existing?.certificateType ?? "Participation").trim(),
    eventDate: input.eventDate?.trim() || existing?.eventDate || new Date().toISOString().slice(0, 10),
    issueDate: input.issueDate?.trim() || existing?.issueDate || new Date().toISOString().slice(0, 10),
    signature: (input.signature ?? existing?.signature ?? "Vaidya Gogate Memorial Foundation").trim(),
    status: input.status ?? existing?.status ?? "Valid",
    reissuedAt: input.reissuedAt ?? existing?.reissuedAt,
    updatedAt: new Date().toISOString(),
  };
  write([next, ...records.filter((certificate) => certificate.id !== next.id && certificate.certificateNumber !== next.certificateNumber)]);
  return next;
}

export function revokeCertificateRecord(id: string) {
  const records = read();
  const existing = records.find((certificate) => certificate.id === id || certificate.certificateNumber === id);
  if (!existing) return false;
  write(
    records.map((certificate) =>
      certificate.id === existing.id ? { ...certificate, status: "Revoked" as const, updatedAt: new Date().toISOString() } : certificate
    )
  );
  return true;
}
