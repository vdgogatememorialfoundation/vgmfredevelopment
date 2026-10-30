import { AuthProvider } from "@/components/auth/AuthContext";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";
import { HydratePublishedSite } from "@/components/common/HydratePublishedSite";
import { readMobileFeed } from "@/lib/server/mobile-feed";

export const dynamic = "force-dynamic";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const feed = readMobileFeed();
  const initial = { site: feed.site, flyers: feed.flyers ?? [], publishedAt: feed.publishedAt };
  return (
    <AuthProvider>
      <LanguageProvider>
        <HydratePublishedSite initial={initial}>
          <div className="min-h-screen bg-background">{children}</div>
        </HydratePublishedSite>
      </LanguageProvider>
    </AuthProvider>
  );
}
