import { getIntegrations, notificationEvents, type NotificationEventId } from "@/lib/integrations";
import { applyFoundationBrand, FOUNDATION_NAME } from "@/lib/email-layout";

export type MessageCopy = {
  emailSubject: string;
  emailBody: string;
  smsBody: string;
};

const SIGN = FOUNDATION_NAME;

/** Order-stage emails: {intro} {next} {details} are filled with the order's own text, so the default reads like the built-in email. */
const STAGE_BODY = `Dear {name},\n\nNamaste, and greetings from ${SIGN}.\n\n{intro}\n\n{next}\n\n{details}\n\nTrack your order: {trackUrl}\nQuestions? Reply to this email or write to care@vaidyagogate.org with your order ID.\n\nWith warm regards,\n${SIGN}`;

export const defaultMessageCopy: Record<NotificationEventId, MessageCopy> = {
  "order-packed": {
    emailSubject: `Order {orderId} is packed`,
    emailBody: STAGE_BODY,
    smsBody: `${SIGN}: order {orderId} is packed.`,
  },
  "order-shipped": {
    emailSubject: `Order {orderId} has been shipped`,
    emailBody: STAGE_BODY,
    smsBody: `${SIGN}: order {orderId} has been shipped. {courier} {awb}`,
  },
  "order-out-for-delivery": {
    emailSubject: `Order {orderId} is out for delivery`,
    emailBody: STAGE_BODY,
    smsBody: `${SIGN}: order {orderId} is out for delivery today.`,
  },
  "order-delivered": {
    emailSubject: `Order {orderId} delivered`,
    emailBody: STAGE_BODY,
    smsBody: `${SIGN}: order {orderId} has been delivered.`,
  },
  "order-cancelled": {
    emailSubject: `Order {orderId} cancelled`,
    emailBody: STAGE_BODY,
    smsBody: `${SIGN}: order {orderId} has been cancelled.`,
  },
  "order-delivery-failed": {
    emailSubject: `Delivery attempt failed for order {orderId}`,
    emailBody: STAGE_BODY,
    smsBody: `${SIGN}: the courier could not deliver order {orderId}.`,
  },
  "order-return-update": {
    emailSubject: `Return update for order {orderId}: {status}`,
    emailBody: STAGE_BODY,
    smsBody: `${SIGN}: return for order {orderId}: {status}.`,
  },
  "refund-processed": {
    emailSubject: `Refund of {amount} processed for order {orderId}`,
    emailBody: STAGE_BODY,
    smsBody: `${SIGN}: refund of {amount} for order {orderId} has been processed.`,
  },
  "refund-bank-reference": {
    emailSubject: `Bank reference for your refund on order {orderId}`,
    emailBody: STAGE_BODY,
    smsBody: `${SIGN}: refund {amount} for order {orderId}, bank ref {bankRef}.`,
  },
  otp: {
    emailSubject: `Your ${SIGN} verification code`,
    emailBody: `Dear {name},\n\nNamaste, and greetings from ${SIGN}.\n\nYour one-time {purpose} code is {code}. It is valid for 10 minutes.\n\nIf you did not request this code, you can safely ignore this email.\n\nWith warm regards,\n${SIGN}`,
    smsBody: `${SIGN} {purpose} code: {code}. Valid 10 minutes.`,
  },
  "account-created": {
    emailSubject: `Welcome to ${SIGN} — Account ID {accountId}`,
    emailBody: `Dear {name},\n\nNamaste, and welcome to ${SIGN}.\n\nYour account is ready. You can use it to follow event registrations, applications, orders and payments in one place.\n\nAccount ID: {accountId}\nRegistered email: {email}\nRegistered mobile: {phone}\n\n{signin}\n\nIf you did not create this account, write to support@vaidyagogate.org.\n\nWith warm regards,\n${SIGN}`,
    smsBody: `Welcome to ${SIGN}. Account ID {accountId}. Sign in on the Foundation website.`,
  },
  "account-details": {
    emailSubject: `Your ${SIGN} account details (Account ID {accountId})`,
    emailBody: `Dear {name},\n\nNamaste, and greetings from ${SIGN}.\n\nHere are the details linked to your account.\n\nAccount ID: {accountId}\nRegistered email: {email}\nRegistered mobile: {phone}\n\n{signin}\n\nWith warm regards,\n${SIGN}`,
    smsBody: `${SIGN} account {accountId}. Sign in on the Foundation website.`,
  },
  "order-placed": {
    emailSubject: `We received your order {orderId}`,
    emailBody: `Dear {name},\n\nNamaste, and thank you for ordering from ${SIGN}.\n\nWe have received order {orderId}. Amount: {amount}.\n\nWe will write again when it is packed or ready for delivery.\n\nWith warm regards,\n${SIGN}`,
    smsBody: `${SIGN}: order {orderId} received. Amount {amount}.`,
  },
  "order-status": {
    emailSubject: `Update on order {orderId} — {status}`,
    emailBody: `Dear {name},\n\nNamaste, and greetings from ${SIGN}.\n\nYour order {orderId} is now {status}.\n\nWith warm regards,\n${SIGN}`,
    smsBody: `${SIGN}: order {orderId} is now {status}.`,
  },
  "preorder-placed": {
    emailSubject: `Pre-order {orderId} confirmed: advance received`,
    emailBody: STAGE_BODY,
    smsBody: `${SIGN}: pre-order {orderId} confirmed. Advance received; balance is due when the book is ready.`,
  },
  "preorder-update": {
    emailSubject: `Pre-order {orderId}: {status}`,
    emailBody: STAGE_BODY,
    smsBody: `${SIGN}: pre-order {orderId} is now {status}.`,
  },
  "preorder-ready": {
    emailSubject: `Pre-order {orderId} is ready: balance due`,
    emailBody: `Dear {name},\n\nNamaste, and greetings from ${SIGN}.\n\nYour pre-order {orderId} is ready. Please pay the balance using this link:\n{link}\n\nWith warm regards,\n${SIGN}`,
    smsBody: `${SIGN}: pre-order {orderId} is ready. Pay the balance: {link}`,
  },
  "payment-link": {
    emailSubject: `Payment link for order {orderId}`,
    emailBody: `Dear {name},\n\nNamaste, and greetings from ${SIGN}.\n\nPlease complete payment for order {orderId} using this link:\n{link}\n\nWith warm regards,\n${SIGN}`,
    smsBody: `${SIGN}: pay for order {orderId}: {link}`,
  },
  refund: {
    emailSubject: `Refund for order {orderId}`,
    emailBody: `Dear {name},\n\nNamaste, and greetings from ${SIGN}.\n\nA refund of {amount} has been issued for order {orderId}. It should appear on the original payment method shortly.\n\nWith warm regards,\n${SIGN}`,
    smsBody: `${SIGN}: refund {amount} for order {orderId}.`,
  },
  "shipment-booked": {
    emailSubject: `Your order {orderId} has been shipped`,
    emailBody: `Dear {name},\n\nNamaste, and greetings from ${SIGN}.\n\nYour order {orderId} has been booked with the courier. You will receive tracking details as soon as they are available.\n\nWith warm regards,\n${SIGN}`,
    smsBody: `${SIGN}: order {orderId} has been shipped.`,
  },
  "back-in-stock": {
    emailSubject: `An item you asked about is back in stock`,
    emailBody: `Dear {name},\n\nNamaste, and greetings from ${SIGN}.\n\nAn item you asked about is back in the Foundation shop. Stock is limited, so please order soon if you still need it.\n\nWith warm regards,\n${SIGN}`,
    smsBody: `${SIGN}: an item you asked about is back in stock.`,
  },
  "store-credit": {
    emailSubject: `Store credit added to your account`,
    emailBody: `Dear {name},\n\nNamaste, and greetings from ${SIGN}.\n\nStore credit of {amount} has been added to your account. You can use it on your next shop order.\n\nWith warm regards,\n${SIGN}`,
    smsBody: `${SIGN}: store credit {amount} added.`,
  },
  "return-created": {
    emailSubject: `Return started for order {orderId}`,
    emailBody: `Dear {name},\n\nNamaste, and greetings from ${SIGN}.\n\nWe have received a return request for order {orderId}. Our team will write with the next step.\n\nWith warm regards,\n${SIGN}`,
    smsBody: `${SIGN}: return started for order {orderId}.`,
  },
  "pos-receipt": {
    emailSubject: `In-store receipt {orderId}`,
    emailBody: `Dear {name},\n\nNamaste, and thank you for visiting ${SIGN}.\n\nThis is your receipt for in-store order {orderId}. Amount {amount}.\n\nWith warm regards,\n${SIGN}`,
    smsBody: `${SIGN}: POS receipt {orderId}, amount {amount}.`,
  },
  "support-reply": {
    emailSubject: "Re: {subject}",
    emailBody: `Dear {name},\n\nNamaste, and greetings from ${SIGN}.\n\n{body}\n\nWith warm regards,\n${SIGN}`,
    smsBody: `${SIGN} support: {body}`,
  },
  "ticket-update": {
    emailSubject: `Update on your support request`,
    emailBody: `Dear {name},\n\nNamaste, and greetings from ${SIGN}.\n\nYour support ticket has been updated. Sign in to your account to read the latest reply.\n\nWith warm regards,\n${SIGN}`,
    smsBody: `${SIGN}: your support ticket was updated.`,
  },
  "abandoned-cart": {
    emailSubject: `You left items in your Foundation shop cart`,
    emailBody: `Dear {name},\n\nNamaste, and greetings from ${SIGN}.\n\nYou left items in your cart. You can complete the order whenever you are ready on the Foundation shop.\n\nWith warm regards,\n${SIGN}`,
    smsBody: `${SIGN}: you still have items in your shop cart.`,
  },
};

export type TemplateVars = Record<string, string | undefined>;

export function applyTemplateVars(text: string, vars: TemplateVars) {
  return applyFoundationBrand(
    text.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => vars[key] ?? "")
  );
}

function isStaleVgmfCopy(copy: MessageCopy) {
  const text = `${copy.emailSubject}\n${copy.emailBody}\n${copy.smsBody}`;
  return /\bVGMF\b(?!-)/.test(text) && !text.includes(FOUNDATION_NAME);
}

export function messageCopyFor(eventId: string, vars: TemplateVars = {}): MessageCopy & { whatsappTemplate: string } {
  const id = (notificationEvents.some((item) => item.id === eventId) ? eventId : "otp") as NotificationEventId;
  const saved = getIntegrations().messages?.[id];
  const fallback = defaultMessageCopy[id];
  const merged: MessageCopy = {
    emailSubject: saved?.emailSubject?.trim() || fallback.emailSubject,
    emailBody: saved?.emailBody?.trim() || fallback.emailBody,
    smsBody: saved?.smsBody?.trim() || fallback.smsBody,
  };
  const copy = isStaleVgmfCopy(merged) ? fallback : merged;
  const filled = {
    name: vars.name?.trim() || "Guest",
    ...vars,
  };
  return {
    emailSubject: applyTemplateVars(copy.emailSubject, filled),
    emailBody: applyTemplateVars(copy.emailBody, filled),
    smsBody: applyTemplateVars(copy.smsBody, filled),
    whatsappTemplate: getIntegrations().whatsapp.mapping[id] ?? "",
  };
}
