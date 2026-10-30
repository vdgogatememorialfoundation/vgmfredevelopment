import { getSectionSettings } from "@/lib/cms";
import { getIntegrations } from "@/lib/integrations";

export type AuthAccess = {
  loginEnabled: boolean;
  signupEnabled: boolean;
  emailOtp: boolean;
  smsLogin: boolean;
};

const MAIL_READY_KEY = "vgmf_mail_ready";

export function setMailReady(ready: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MAIL_READY_KEY, ready ? "true" : "false");
  window.dispatchEvent(new Event("vgmf-cms"));
}

/** True once ZeptoMail (or Zoho Mail) is saved or present on the host. */
export function mailOtpAvailable() {
  if (typeof window === "undefined") {
    return Boolean((process.env.ZEPTOMAIL_TOKEN || "").trim() || (process.env.ZOHO_REFRESH_TOKEN || "").trim());
  }
  const email = getIntegrations().email;
  if (email.zeptoToken.trim()) return true;
  if (email.provider === "zoho" && (email.zohoRefreshToken.trim() || email.zohoClientSecret.trim())) return true;
  try {
    if (window.localStorage.getItem(MAIL_READY_KEY) === "true") return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function getAuthAccess(): AuthAccess {
  const saved = typeof window === "undefined" ? {} : getSectionSettings("registration");
  return {
    loginEnabled: saved.allowLogin !== "false",
    signupEnabled: saved.allowSignup !== "false",
    emailOtp: mailOtpAvailable() && saved.verifyEmail !== "false",
    smsLogin: saved.smsLogin === "true",
  };
}

export function authClosedMessage(access = getAuthAccess()) {
  if (!access.loginEnabled && !access.signupEnabled) {
    return "Sign-in and new accounts are turned off. Please contact the Foundation office.";
  }
  if (!access.loginEnabled) {
    return "Sign-in is turned off. You can still create an account if registration is open.";
  }
  if (!access.signupEnabled) {
    return "New accounts are closed. Existing members can still sign in.";
  }
  return "";
}
