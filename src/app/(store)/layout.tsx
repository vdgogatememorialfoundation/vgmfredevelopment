import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import AnnouncementTicker from "@/components/common/AnnouncementTicker";
import BannerPopup from "@/components/home/BannerPopup";
import { AIChatbot } from "@/components/chatbot/AIChatbot";
import { AuthProvider } from "@/components/auth/AuthContext";
import { MaintenanceGate } from "@/components/admin/MaintenanceGate";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <LanguageProvider>
        <MaintenanceGate>
          <Header />
          <AnnouncementTicker />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
          <BannerPopup />
          <AIChatbot />
        </MaintenanceGate>
      </LanguageProvider>
    </AuthProvider>
  );
}