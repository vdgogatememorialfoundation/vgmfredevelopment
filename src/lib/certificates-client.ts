import { saveIssuedCertificate, revokeCertificate, type IssuedCertificate } from "@/lib/cms";

import {
  AUTISM_ORIGIN,
  asRecord,
  autismErrorText,
  isAutismId,
  mapAutismApiResponse,
  normalizeCertificateId,
  stripPrivateFields,
  type CertificateSource,
  type PartnerEvent,
} from "@/lib/partner-certificates";

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
  year?: number;
  eventSlug?: string;
  source?: CertificateSource;
  sourceLabel?: string;
  prn?: string;
  applicationNumber?: string;
  eventId?: string;
  eventVenue?: string;
  kind?: string;
  eventDetails?: PartnerEvent;
  typeLabel?: string;
  issuer?: string;
  verifyUrl?: string;
  apiUrl?: string;
  participantId?: string;
  issuedAt?: string;
};

export type VerifyCertificateResult = {
  ok: boolean;
  verified: boolean;
  valid?: boolean;
  status?: string;
  code?: string;
  error?: string;
  certificate?: PublicCertificate;
  source?: string;
  sourceLabel?: string;
};

const UNAVAILABLE: VerifyCertificateResult = {
  ok: false,
  verified: false,
  valid: false,
  status: "unavailable",
  code: "UNAVAILABLE",
  error: autismErrorText("UNAVAILABLE"),
};

async function verifyAutismDirect(id: string): Promise<VerifyCertificateResult> {
  const lookup = encodeURIComponent(normalizeCertificateId(id));
  const urls = [
    `${AUTISM_ORIGIN}/api/public/certificates/verify?id=${lookup}`,
    `${AUTISM_ORIGIN}/api/public/certificates/${lookup}`,
  ];
  let last = UNAVAILABLE;
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      const text = await response.text();
      let parsed: unknown = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        const mapped = mapAutismApiResponse(response.status, null, id);
        last = {
          ok: mapped.ok,
          verified: false,
          valid: false,
          status: mapped.status,
          code: mapped.code,
          error: mapped.error,
          source: "autism",
        };
        if (last.code && last.code !== "UNAVAILABLE") return last;
        continue;
      }
      const mapped = mapAutismApiResponse(response.status, asRecord(stripPrivateFields(parsed)), id);
      if (mapped.certificate) {
        return {
          ok: true,
          verified: true,
          valid: true,
          status: "valid",
          certificate: mapped.certificate,
          source: "autism",
          sourceLabel: mapped.certificate.sourceLabel,
        };
      }
      last = {
        ok: false,
        verified: false,
        valid: false,
        status: mapped.status,
        code: mapped.code,
        error: mapped.error,
        source: "autism",
      };
      if (mapped.code && mapped.code !== "UNAVAILABLE") return last;
    } catch {
      last = UNAVAILABLE;
    }
  }
  return last;
}

export async function verifyCertificate(number: string, apiKey?: string): Promise<VerifyCertificateResult> {
  if (isAutismId(number)) {
    return verifyAutismDirect(number);
  }

  const headers: HeadersInit = { accept: "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;
  let response: Response;
  try {
    response = await fetch(`/api/certificates/verify?number=${encodeURIComponent(number)}`, {
      cache: "no-store",
      headers,
    });
  } catch {
    return UNAVAILABLE;
  }

  let data: VerifyCertificateResult;
  try {
    data = (await response.json()) as VerifyCertificateResult;
  } catch {
    return UNAVAILABLE;
  }

  if (response.status === 401) throw new Error(data.error || "Invalid API key.");
  return {
    ...data,
    verified: Boolean(data.verified || (data.valid && data.certificate)),
    valid: Boolean(data.valid && data.certificate),
    error:
      data.error ||
      (data.valid ? undefined : data.code ? autismErrorText(data.code) : "This certificate could not be verified."),
  };
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
