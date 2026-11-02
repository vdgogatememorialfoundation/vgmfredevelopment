import HeroSection from "@/components/home/HeroSection";
import NoticeBoard from "@/components/home/NoticeBoard";
import FoundationDirectory from "@/components/home/FoundationDirectory";
import AboutDirectory from "@/components/home/AboutDirectory";
import UpcomingEvents from "@/components/home/UpcomingEvents";
import LegacySection from "@/components/home/LegacySection";
import FeaturedArticles from "@/components/home/FeaturedArticles";
import FeaturedBooks from "@/components/home/FeaturedBooks";
import ClinicsSection from "@/components/home/ClinicsSection";
import SeminarReviews from "@/components/home/SeminarReviews";
import SupportUs from "@/components/home/SupportUs";
import HomeSections from "@/components/home/HomeSections";

export default function HomePage() {
  return (
    <HomeSections
      sections={{
        hero: <HeroSection />,
        directory: <FoundationDirectory />,
        about: <AboutDirectory />,
        reviews: <SeminarReviews />,
        support: <SupportUs />,
        events: <UpcomingEvents />,
        legacy: <LegacySection />,
        books: <FeaturedBooks />,
        articles: <FeaturedArticles />,
        notices: <NoticeBoard />,
        clinics: <ClinicsSection />,
      }}
    />
  );
}
