import { saveIssuedCertificate, revokeCertificate, type IssuedCertificate } from "@/lib/cms";

export type PublicCertificate = {
  certificateNumber: string;
  name: string;
  event: string;
  certificateType: string;
  eventDate: string;
  issueDate: string;
  signature: string;
  status?: "Valid" | "Revoked";
  reissuedAt?: string;
};

export async function verifyCertificate(number: string, apiKey?: string) {
  const headers: HeadersInit = { accept: "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;
  const response = await fetch(`/api/certificates/verify?number=${encodeURIComponent(number)}`, {
    cache: "no-store",
    headers,
  });
  const data = (await response.json()) as {
    ok: boolean;
    verified?: boolean;
    certificate?: PublicCertificate;
    error?: string;
    source?: string;
  };
  if (response.status === 401) throw new Error(data.error || "Invalid API key.");
  if (!response.ok && response.status !== 404) throw new Error(data.error || "Could not verify the certificate.");
  return data;
}

export async function publishCertificate(record: IssuedCertificate) {
  const response = await fetch("/api/certificates", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(record),
  });
  const data = (await response.json()) as { ok: boolean; certificate?: PublicCertificate; error?: string };
  if (!response.ok || !data.ok || !data.certificate) throw new Error(data.error || "Could not save the certificate.");
  const local: IssuedCertificate = {
    ...record,
    ...data.certificate,
    id: record.id || data.certificate.certificateNumber,
    status: data.certificate.status ?? "Valid",
  };
  saveIssuedCertificate(local);
  return local;
}

export async function deleteCertificate(id: string) {
  await fetch(`/api/certificates/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => undefined);
  revokeCertificate(id);
}
