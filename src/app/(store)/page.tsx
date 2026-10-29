import HeroSection from "@/components/home/HeroSection";
import Announcements from "@/components/home/Announcements";
import NoticeBoard from "@/components/home/NoticeBoard";
import UpcomingEvents from "@/components/home/UpcomingEvents";
import LegacySection from "@/components/home/LegacySection";
import FeaturedArticles from "@/components/home/FeaturedArticles";
import FeaturedBooks from "@/components/home/FeaturedBooks";
import ClinicsSection from "@/components/home/ClinicsSection";
import SupportUs from "@/components/home/SupportUs";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <NoticeBoard />
      <SupportUs />
      <Announcements />
      <UpcomingEvents />
      <LegacySection />
      <FeaturedBooks />
      <FeaturedArticles />
      <ClinicsSection />
    </>
  );
}