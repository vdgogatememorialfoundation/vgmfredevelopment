import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import AnnouncementTicker from "@/components/common/AnnouncementTicker";
import BannerPopup from "@/components/home/BannerPopup";
import { SiteChat } from "@/components/chatbot/LiveChatWidget";
import { VisitorBeacon } from "@/components/analytics/VisitorBeacon";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { AuthProvider } from "@/components/auth/AuthContext";
import { MaintenanceGate } from "@/components/admin/MaintenanceGate";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";
import { SiteVisibilityGate } from "@/components/layout/SiteVisibilityGate";
import { HydratePublishedSite } from "@/components/common/HydratePublishedSite";

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <LanguageProvider>
        <MaintenanceGate>
          <HydratePublishedSite />
          <Header />
          <AnnouncementTicker />
          <main id="main-content" className="flex-1">
            <SiteVisibilityGate>{children}</SiteVisibilityGate>
          </main>
          <Footer />
          <BannerPopup />
          <VisitorBeacon />
          <GoogleAnalytics />
          <SiteChat />
        </MaintenanceGate>
      </LanguageProvider>
    </AuthProvider>
  );
}