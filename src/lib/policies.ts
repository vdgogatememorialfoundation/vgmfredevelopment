import { subscribeCms } from "@/lib/cms";

const KEY = "vgmf_policies";

export type PolicyId = "privacy" | "terms" | "shipping" | "returns" | "refund" | "cancellation";

export interface PolicySection {
  title: string;
  body: string;
}

export interface PolicyDoc {
  id: PolicyId;
  title: string;
  description: string;
  lastUpdated: string;
  sections: PolicySection[];
}

export const defaultPolicies: Record<PolicyId, PolicyDoc> = {
  privacy: {
    id: "privacy",
    title: "Privacy Policy",
    description:
      "This policy explains how the Vaidya Gogate Memorial Foundation collects, uses and protects your personal information when you use our website and services.",
    lastUpdated: "October 2026",
    sections: [
      {
        title: "Information We Collect",
        body: "When you create an account, we collect your name, email address, phone number and WhatsApp number. When you place orders we collect the information needed to fulfil them, including a delivery address where applicable. We do not store payment card details on our servers; payments are processed by our payment gateway.",
      },
      {
        title: "How We Use Your Information",
        body: "We use your information to create and manage your account, issue a unique Account ID, communicate about events, process orders and provide support. We may send updates about events and publications when you opt in.",
      },
      {
        title: "Data Sharing",
        body: "We do not sell your personal information. We share data only with service providers that help us operate the website (payment, email, WhatsApp and courier services), and only to the extent needed.",
      },
      {
        title: "Your Rights",
        body: "You may request a copy of the personal data we hold about you, ask for corrections, or request deletion of your account by contacting us at info@vaidyagogate.org.",
      },
    ],
  },
  terms: {
    id: "terms",
    title: "Terms and Conditions",
    description: "By using the Vaidya Gogate Memorial Foundation website and services you agree to these terms.",
    lastUpdated: "October 2026",
    sections: [
      {
        title: "About the Foundation",
        body: "The Vaidya Gogate Memorial Foundation is a charitable organisation dedicated to Ayurveda, education and community service. This website provides information about the Foundation, its events, publications, clinics and services.",
      },
      {
        title: "Accounts",
        body: "To purchase books or access services you must create an account. You agree to provide accurate information and keep your login credentials secure.",
      },
      {
        title: "Acceptable Use",
        body: "You agree not to misuse the website, attempt unauthorised access, or use information from the website for purposes inconsistent with the Foundation's charitable mission.",
      },
      {
        title: "Limitation of Liability",
        body: "The Foundation does not provide medical advice through this website. Information about Ayurveda is for general awareness. For specific health concerns, consult a qualified physician.",
      },
    ],
  },
  shipping: {
    id: "shipping",
    title: "Shipping Policy",
    description: "Shipping policy for orders placed through the Vaidya Gogate Memorial Foundation online store.",
    lastUpdated: "October 2026",
    sections: [
      {
        title: "Dispatch",
        body: "Orders are dispatched within 2–4 working days of payment confirmation. You will receive tracking details once your order ships.",
      },
      {
        title: "Delivery Timelines",
        body: "Delivery typically takes 3–7 working days within Maharashtra and 5–12 working days elsewhere in India. International delivery is available on request.",
      },
      {
        title: "Shipping Charges",
        body: "Shipping is calculated at checkout based on weight and the delivery address. Orders above a stated threshold may qualify for free shipping.",
      },
    ],
  },
  returns: {
    id: "returns",
    title: "Return Policy",
    description: "How to return a book or publication purchased from the Foundation store.",
    lastUpdated: "October 2026",
    sections: [
      {
        title: "Window",
        body: "Books may be returned within 7 days of delivery if they arrived damaged, defective, or if a different title was shipped.",
      },
      {
        title: "Condition",
        body: "Items must be unused and in original packaging, with any included inserts. Opened digital or downloadable products cannot be returned.",
      },
      {
        title: "How to start a return",
        body: "Open the order in your account or write to info@vaidyagogate.org with the order number and reason. We will share the return pickup or drop-off steps.",
      },
    ],
  },
  refund: {
    id: "refund",
    title: "Refund Policy",
    description: "The refund policy for book orders placed through the Vaidya Gogate Memorial Foundation website.",
    lastUpdated: "October 2026",
    sections: [
      {
        title: "Books & Publications",
        body: "Approved returns are refunded to the original payment method. Return shipping for our error is borne by the Foundation.",
      },
      {
        title: "How Refunds Are Processed",
        body: "Approved refunds are processed within 7–10 working days. Your bank may take additional time to post the credit.",
      },
    ],
  },
  cancellation: {
    id: "cancellation",
    title: "Cancellation Policy",
    description: "How orders placed through the Vaidya Gogate Memorial Foundation store can be cancelled.",
    lastUpdated: "October 2026",
    sections: [
      {
        title: "Customer cancellations",
        body: "If cancellations are enabled in the store settings, you may cancel an order from your account within the stated window — typically before the order is packed or shipped. A cancellation fee may apply if one is published at checkout.",
      },
      {
        title: "After dispatch or delivery",
        body: "Once an order has shipped, customer self-service cancellation may no longer be available. The Foundation office can still cancel, refund or replace an order from the admin desk, including after delivery, where that is appropriate.",
      },
      {
        title: "How to request a cancellation",
        body: "Open the order in your account, or write to info@vaidyagogate.org with the order number. Approved cancellations are confirmed by email.",
      },
    ],
  },
};

function readSaved(): Partial<Record<PolicyId, PolicyDoc>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Partial<Record<PolicyId, PolicyDoc>>) : {};
  } catch {
    return {};
  }
}

export function getPolicy(id: PolicyId): PolicyDoc {
  const saved = readSaved()[id];
  return saved ? { ...defaultPolicies[id], ...saved, id } : defaultPolicies[id];
}

export function getPolicies(): Record<PolicyId, PolicyDoc> {
  return {
    privacy: getPolicy("privacy"),
    terms: getPolicy("terms"),
    shipping: getPolicy("shipping"),
    returns: getPolicy("returns"),
    refund: getPolicy("refund"),
    cancellation: getPolicy("cancellation"),
  };
}

export function savePolicy(doc: PolicyDoc) {
  if (typeof window === "undefined") return;
  const next = { ...readSaved(), [doc.id]: { ...doc, lastUpdated: new Date().toLocaleString("en-IN", { month: "short", year: "numeric" }) } };
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("vgmf-cms"));
}

export function subscribePolicies(onChange: () => void) {
  return subscribeCms(onChange);
}

export const policyIds: PolicyId[] = ["privacy", "terms", "shipping", "returns", "refund", "cancellation"];
