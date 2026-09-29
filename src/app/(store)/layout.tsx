import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import AnnouncementTicker from "@/components/common/AnnouncementTicker";
import { AIChatbot } from "@/components/chatbot/AIChatbot";
import { AuthProvider } from "@/components/auth/AuthContext";
import { MaintenanceGate } from "@/components/admin/MaintenanceGate";
import ScrollProgress from "@/components/common/ScrollProgress";

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <MaintenanceGate>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-navy focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <ScrollProgress />
        <Header />
        <AnnouncementTicker />
        <main id="main-content" className="flex-1 overflow-x-clip">
          {children}
        </main>
        <Footer />
        <AIChatbot />
      </MaintenanceGate>
    </AuthProvider>
  );
}