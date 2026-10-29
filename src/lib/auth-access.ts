import { getSectionSettings } from "@/lib/cms";

export type AuthAccess = {
  loginEnabled: boolean;
  signupEnabled: boolean;
  emailOtp: boolean;
  smsLogin: boolean;
};

export function getAuthAccess(): AuthAccess {
  const saved = typeof window === "undefined" ? {} : getSectionSettings("registration");
  return {
    loginEnabled: saved.allowLogin !== "false",
    signupEnabled: saved.allowSignup !== "false",
    emailOtp: saved.verifyEmail !== "false",
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
