import { Ionicons } from "@expo/vector-icons";

export type AccountSection = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export const ACCOUNT_SECTIONS: AccountSection[] = [
  { id: "registrations", title: "My Event Registrations", subtitle: "Seminar, Autism and Fellowship programmes", icon: "calendar-outline" },
  { id: "applications", title: "Application Status", subtitle: "Track Foundation applications", icon: "trail-sign-outline" },
  { id: "notifications", title: "Notifications", subtitle: "Messages from the Foundation desk", icon: "notifications-outline" },
  { id: "orders", title: "My Orders", subtitle: "Publication orders and delivery", icon: "receipt-outline" },
  { id: "subscriptions", title: "Subscriptions", subtitle: "Newsletter and content updates", icon: "newspaper-outline" },
  { id: "payments", title: "My Payments", subtitle: "Payment history for shop and programmes", icon: "card-outline" },
  { id: "receipts", title: "Payment Receipts", subtitle: "Receipts for completed payments", icon: "document-text-outline" },
  { id: "tickets", title: "Support Tickets", subtitle: "Raise and follow Foundation tickets", icon: "help-buoy-outline" },
  { id: "wishlist", title: "My Wishlist", subtitle: "Publications saved for later", icon: "heart-outline" },
  { id: "cards", title: "My Saved Cards", subtitle: "Cards saved after a successful order", icon: "wallet-outline" },
  { id: "addresses", title: "Addresses", subtitle: "Delivery addresses for shop orders", icon: "home-outline" },
  { id: "profile", title: "Edit Profile", subtitle: "Name, email, phone and Account ID", icon: "person-outline" },
  { id: "loyalty", title: "Loyalty Points", subtitle: "Points from shop orders and registrations", icon: "star-outline" },
  { id: "faq", title: "FAQ", subtitle: "Answers published on the website", icon: "help-circle-outline" },
];

export function accountSection(id: string) {
  return ACCOUNT_SECTIONS.find((item) => item.id === id);
}
