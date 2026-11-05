import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import AnnouncementTicker from "@/components/common/AnnouncementTicker";
import BackToTop from "@/components/common/BackToTop";
import BannerPopup from "@/components/home/BannerPopup";
import { SiteChat } from "@/components/chatbot/LiveChatWidget";
import { VisitorBeacon } from "@/components/analytics/VisitorBeacon";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { AuthProvider } from "@/components/auth/AuthContext";
import { MaintenanceGate } from "@/components/admin/MaintenanceGate";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";
import { SiteVisibilityGate } from "@/components/layout/SiteVisibilityGate";
import { HydratePublishedSite } from "@/components/common/HydratePublishedSite";
import { PartnerDrawerProvider } from "@/components/account/PartnerPortalDrawer";
import AbandonedCartNotice from "@/components/store/AbandonedCartNotice";
import { readMobileFeed } from "@/lib/server/mobile-feed";

export const revalidate = 60;

type FeedArticle = NonNullable<ReturnType<typeof readMobileFeed>["articles"]>[number];

/** Every page gets article cards only; the full text loads on the article's own page. */
function withoutArticleBody(article: FeedArticle): FeedArticle {
  const translations = article.translations
    ? Object.fromEntries(Object.entries(article.translations).map(([key, copy]) => [key, copy ? { ...copy, content: undefined } : copy]))
    : article.translations;
  return { ...article, content: "", translations } as FeedArticle;
}

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const feed = readMobileFeed();
  const initial = {
    site: feed.site,
    flyers: feed.flyers ?? [],
    banners: feed.banners ?? [],
    awards: feed.awards ?? [],
    thanks: feed.thanks ?? [],
    publishedAt: feed.publishedAt,
    siteText: feed.siteText,
    books: feed.books ?? [],
    events: feed.events ?? [],
    articles: (feed.articles ?? []).map(withoutArticleBody),
    clinics: feed.clinics ?? [],
    videos: feed.videos ?? [],
    notices: feed.notices ?? [],
    announcements: feed.announcements ?? [],
    gallery: feed.gallery ?? [],
  };

  return (
    <AuthProvider scope="public">
      <LanguageProvider>
        <MaintenanceGate>
          <HydratePublishedSite initial={initial}>
            <PartnerDrawerProvider>
            <div className="sticky top-0 z-50">
            <Header />
            <AnnouncementTicker />
            </div>
            <AbandonedCartNotice />
            <main id="main-content" className="flex-1">
              <SiteVisibilityGate>{children}</SiteVisibilityGate>
            </main>
            <Footer />
            <BackToTop />
            <BannerPopup />
            <VisitorBeacon />
            <GoogleAnalytics />
            <SiteChat />
            </PartnerDrawerProvider>
          </HydratePublishedSite>
        </MaintenanceGate>
      </LanguageProvider>
    </AuthProvider>
  );
}
