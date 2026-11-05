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
import AwardsSection from "@/components/home/AwardsSection";
import { SpeakerBoard } from "@/components/events/EventSchedules";
import HomeSections from "@/components/home/HomeSections";
import InstagramReels from "@/components/home/InstagramReels";

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
        speakers: <SpeakerBoard variant="home" />,
        awards: <AwardsSection variant="home" />,
        legacy: <LegacySection />,
        books: <FeaturedBooks />,
        articles: <FeaturedArticles />,
        notices: <NoticeBoard />,
        reels: <InstagramReels />,
        clinics: <ClinicsSection />,
      }}
    />
  );
}
