import { accountExists, createAccount } from "@/lib/server/accounts";
import { sendMobileEmail } from "@/lib/server/mobile-mail";
import type { Order } from "@/types";

function siteUrl() {
  return (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
}

/**
 * A guest checkout gets a Foundation account from the order's email and phone.
 * There is no password: the customer signs in with a one-time code sent to that email or phone.
 */
export async function ensureGuestAccount(order: Order) {
  const address = order.deliveryAddress;
  const email = String(address?.email || order.accountEmail || "").trim().toLowerCase();
  const phone = String(address?.phone || "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email) || phone.replace(/\D/g, "").length < 10) return null;
  if (accountExists(email, phone)) return null;
  const [firstName = "Customer", ...rest] = String(address?.fullName || "").trim().split(/\s+/).filter(Boolean);
  let account;
  try {
    account = createAccount({ salutation: "Mx.", firstName, lastName: rest.join(" "), email, phone });
  } catch {
    return null;
  }
  const signIn = `${siteUrl()}/login?mode=signin`;
  await sendMobileEmail(
    email,
    "Your Vaidya Gogate Memorial Foundation account",
    [
      `Dear ${firstName},`,
      "",
      `Thank you for your order ${order.id}. We have created a Foundation account for you with this email and your phone number ${phone}, so you can track this order and see all your orders in one place.`,
      "",
      `Your Account ID: ${account.accountId}`,
      "",
      `To sign in, open ${signIn}, enter this email or your phone number and choose the one-time code (OTP) option. We send a 6-digit code each time; no password is needed. You can set a password later from Forgot password if you prefer.`,
      "",
      "With warm regards,",
      "Vaidya Gogate Memorial Foundation",
    ].join("\n")
  ).catch(() => undefined);
  return account;
}
