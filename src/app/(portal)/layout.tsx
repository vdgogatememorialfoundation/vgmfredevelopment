import { AuthProvider } from "@/components/auth/AuthContext";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";
import { HydratePublishedSite } from "@/components/common/HydratePublishedSite";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <LanguageProvider>
        <HydratePublishedSite />
        <div className="min-h-screen bg-background">{children}</div>
      </LanguageProvider>
    </AuthProvider>
  );
}