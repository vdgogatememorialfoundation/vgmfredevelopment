const OTP_KEY = "vgmf_portal_otp";
const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_RESEND_SECONDS = 60;

type OtpRecord = {
  email: string;
  role: string;
  code: string;
  expiresAt: number;
};

function readRecord(): OtpRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(OTP_KEY);
    return raw ? (JSON.parse(raw) as OtpRecord) : null;
  } catch {
    return null;
  }
}

function otpIdentity(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 10 && !trimmed.includes("@")) return digits;
  return trimmed.toLowerCase();
}

export function issueEmailOtp(email: string, role: string) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const record: OtpRecord = {
    email: otpIdentity(email),
    role,
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
  };
  window.sessionStorage.setItem(OTP_KEY, JSON.stringify(record));
  return code;
}

export function verifyEmailOtp(email: string, role: string, code: string) {
  const record = readRecord();
  if (!record) return "No code has been sent. Request a new one.";
  if (record.email !== otpIdentity(email) || record.role !== role) {
    return "This code was issued for a different account. Request a new one.";
  }
  if (Date.now() > record.expiresAt) return "That code has expired. Request a new one.";
  if (record.code !== code.trim()) return "Incorrect code. Please try again.";
  window.sessionStorage.removeItem(OTP_KEY);
  return null;
}
