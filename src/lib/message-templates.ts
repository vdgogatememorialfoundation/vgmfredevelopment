import { getIntegrations, notificationEvents, type NotificationEventId } from "@/lib/integrations";

export type MessageCopy = {
  emailSubject: string;
  emailBody: string;
  smsBody: string;
};

export const defaultMessageCopy: Record<NotificationEventId, MessageCopy> = {
  otp: {
    emailSubject: "VGMF {purpose} code",
    emailBody: "Hi {name},\n\nYour VGMF {purpose} code is {code}. It expires in 10 minutes.\n\nIf you did not request this, ignore the message.\n\n– Vaidya Gogate Memorial Foundation",
    smsBody: "VGMF {purpose} code: {code}. Valid 10 minutes.",
  },
  "account-created": {
    emailSubject: "Welcome to VGMF – your Account ID {accountId}",
    emailBody: "Dear {name},\n\nYour account on the Vaidya Gogate Memorial Foundation portal has been created.\n\nAccount ID: {accountId}\nRegistered email: {email}\nRegistered mobile: {phone}\n\n{signin}\n\nIf you did not expect this email, contact us at support@vaidyagogate.org.\n\n– Vaidya Gogate Memorial Foundation",
    smsBody: "VGMF account created. Account ID {accountId}. Sign in at the Foundation website.",
  },
  "account-details": {
    emailSubject: "Your VGMF account details (Account ID {accountId})",
    emailBody: "Dear {name},\n\nHere are your account details for the Vaidya Gogate Memorial Foundation portal.\n\nAccount ID: {accountId}\nRegistered email: {email}\nRegistered mobile: {phone}\n\n{signin}\n\n– Vaidya Gogate Memorial Foundation",
    smsBody: "VGMF account {accountId}. Sign in on the Foundation website.",
  },
  "order-placed": {
    emailSubject: "Order {orderId} received",
    emailBody: "Hi {name},\n\nWe received order {orderId}. Amount: {amount}.\n\n– VGMF Store",
    smsBody: "VGMF order {orderId} received. Amount {amount}.",
  },
  "order-status": {
    emailSubject: "Order {orderId} — {status}",
    emailBody: "Hi {name},\n\nYour order {orderId} is now {status}.\n\n– VGMF Store",
    smsBody: "VGMF order {orderId} is now {status}.",
  },
  "payment-link": {
    emailSubject: "Payment link for order {orderId}",
    emailBody: "Hi {name},\n\nPay for order {orderId}: {link}\n\n– VGMF Store",
    smsBody: "Pay VGMF order {orderId}: {link}",
  },
  refund: {
    emailSubject: "Refund for order {orderId}",
    emailBody: "Hi {name},\n\nA refund of {amount} was issued for order {orderId}.\n\n– VGMF Store",
    smsBody: "VGMF refund {amount} for order {orderId}.",
  },
  "shipment-booked": {
    emailSubject: "Shipment booked for order {orderId}",
    emailBody: "Hi {name},\n\nYour order {orderId} has been booked with the courier.\n\n– VGMF Store",
    smsBody: "VGMF order {orderId} shipped.",
  },
  "back-in-stock": {
    emailSubject: "Back in stock",
    emailBody: "Hi {name},\n\nAn item you asked about is back in stock.\n\n– VGMF Store",
    smsBody: "A VGMF shop item is back in stock.",
  },
  "store-credit": {
    emailSubject: "Store credit added",
    emailBody: "Hi {name},\n\nStore credit of {amount} was added to your Foundation account.\n\n– VGMF Store",
    smsBody: "VGMF store credit {amount} added.",
  },
  "return-created": {
    emailSubject: "Return created for order {orderId}",
    emailBody: "Hi {name},\n\nWe received a return request for order {orderId}.\n\n– VGMF Store",
    smsBody: "VGMF return started for order {orderId}.",
  },
  "pos-receipt": {
    emailSubject: "In-store receipt {orderId}",
    emailBody: "Hi {name},\n\nReceipt for in-store order {orderId}. Amount {amount}.\n\n– VGMF Store",
    smsBody: "VGMF POS receipt {orderId}, amount {amount}.",
  },
  "support-reply": {
    emailSubject: "Re: {subject}",
    emailBody: "Hi {name},\n\n{body}\n\n– VGMF Support",
    smsBody: "VGMF support: {body}",
  },
  "ticket-update": {
    emailSubject: "Ticket update",
    emailBody: "Hi {name},\n\nYour support ticket was updated.\n\n– VGMF Support",
    smsBody: "Your VGMF support ticket was updated.",
  },
  "abandoned-cart": {
    emailSubject: "Did you forget something in your cart?",
    emailBody: "Hi {name},\n\nYou left items in your cart. Complete your order on the Foundation shop.\n\n– VGMF Store",
    smsBody: "You have items in your VGMF cart.",
  },
};

export type TemplateVars = Record<string, string | undefined>;

export function applyTemplateVars(text: string, vars: TemplateVars) {
  return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => vars[key] ?? "");
}

export function messageCopyFor(eventId: string, vars: TemplateVars = {}): MessageCopy & { whatsappTemplate: string } {
  const id = (notificationEvents.some((item) => item.id === eventId) ? eventId : "otp") as NotificationEventId;
  const saved = getIntegrations().messages?.[id];
  const fallback = defaultMessageCopy[id];
  const copy = {
    emailSubject: saved?.emailSubject?.trim() || fallback.emailSubject,
    emailBody: saved?.emailBody?.trim() || fallback.emailBody,
    smsBody: saved?.smsBody?.trim() || fallback.smsBody,
  };
  return {
    emailSubject: applyTemplateVars(copy.emailSubject, vars),
    emailBody: applyTemplateVars(copy.emailBody, vars),
    smsBody: applyTemplateVars(copy.smsBody, vars),
    whatsappTemplate: getIntegrations().whatsapp.mapping[id] ?? "",
  };
}
