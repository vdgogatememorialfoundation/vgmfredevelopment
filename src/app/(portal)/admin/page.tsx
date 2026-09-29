import PortalDashboard from "@/components/portal/PortalDashboard";
import { getCurrentAccount } from "@/lib/server/auth";

const SHORTCUTS = [
  { label: "Banners & slideshow", href: "/admin/website/banners", description: "Homepage slider, display banner and shop banner." },
  { label: "Events", href: "/admin/events", description: "Publish events, speakers and schedules." },
  { label: "Shop products", href: "/admin/commerce/products", description: "Books, prices, stock and featured items." },
  { label: "Orders", href: "/admin/commerce/orders", description: "Track and update customer orders." },
  { label: "Accounts", href: "/admin/accounts", description: "Create staff, seller, delivery and customer logins." },
  { label: "Certificates", href: "/admin/certificates", description: "Issue and revoke verifiable certificates." },
  { label: "Enquiries", href: "/admin/support/contact", description: "Messages from the contact form." },
  { label: "Homepage sections", href: "/admin/website/homepage", description: "Turn homepage sections on or off." },
];

export default async function AdminDashboardPage() {
  const account = await getCurrentAccount().catch(() => null);
  if (!account) return null;
  return <PortalDashboard account={account} base="/admin" shortcuts={SHORTCUTS} />;
}
