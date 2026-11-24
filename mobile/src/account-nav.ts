import { Ionicons } from "@expo/vector-icons";

export type AccountSection = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export const ACCOUNT_SECTIONS: AccountSection[] = [
  { id: "orders", title: "My Orders", subtitle: "Live courier tracking, invoices & replacements", icon: "cube-outline" },
  { id: "wallet", title: "My Wallet", subtitle: "Store credit from refunds and the Foundation desk", icon: "wallet-outline" },
  { id: "payments", title: "My Payments", subtitle: "Payment history for shop and programmes", icon: "card-outline" },
  { id: "receipts", title: "Payment Receipts", subtitle: "Downloadable receipts for completed payments", icon: "document-text-outline" },
  { id: "wishlist", title: "My Wishlist", subtitle: "Publications saved for later", icon: "heart-outline" },
  { id: "cards", title: "Saved Cards", subtitle: "Cards saved after a successful order", icon: "card-outline" },
  { id: "addresses", title: "Saved Addresses", subtitle: "Home and clinic delivery addresses", icon: "location-outline" },
  { id: "loyalty", title: "Loyalty Points", subtitle: "Points earned from orders and seminars", icon: "star-outline" },
  { id: "registrations", title: "My Event Registrations", subtitle: "Seminar, Autism and Fellowship programmes", icon: "calendar-outline" },
  { id: "applications", title: "Application Status", subtitle: "Track Foundation applications step by step", icon: "trail-sign-outline" },
  { id: "seminar-videos", title: "Seminar Videos", subtitle: "Recorded sessions and talks from your seminars", icon: "play-circle-outline" },
  { id: "notifications", title: "Notifications", subtitle: "Messages and alerts from the Foundation desk", icon: "notifications-outline" },
  { id: "subscriptions", title: "Subscriptions", subtitle: "Newsletter and publication updates", icon: "newspaper-outline" },
  { id: "profile", title: "Edit Profile", subtitle: "Name, email, phone and 12-digit Account ID", icon: "person-outline" },
  { id: "tickets", title: "Support Tickets", subtitle: "Raise and track help desk tickets", icon: "headset-outline" },
  { id: "faq", title: "FAQ", subtitle: "Frequently asked questions", icon: "help-circle-outline" },
];

export function accountSection(id: string) {
  return ACCOUNT_SECTIONS.find((item) => item.id === id);
}
