import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import AnnouncementTicker from "@/components/common/AnnouncementTicker";
import { AIChatbot } from "@/components/chatbot/AIChatbot";
import { AuthProvider } from "@/components/auth/AuthContext";
import { MaintenanceGate } from "@/components/admin/MaintenanceGate";

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <MaintenanceGate>
        <Header />
        <AnnouncementTicker />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
        <AIChatbot />
      </MaintenanceGate>
    </AuthProvider>
  );
}