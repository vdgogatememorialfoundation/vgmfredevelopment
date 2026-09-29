import HeroSection from "@/components/home/HeroSection";
import Announcements from "@/components/home/Announcements";
import FlyerSection from "@/components/home/FlyerSection";
import NoticeBoard from "@/components/home/NoticeBoard";
import UpcomingEvents from "@/components/home/UpcomingEvents";
import LegacySection from "@/components/home/LegacySection";
import FeaturedArticles from "@/components/home/FeaturedArticles";
import FeaturedBooks from "@/components/home/FeaturedBooks";
import ClinicsSection from "@/components/home/ClinicsSection";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <Announcements />
      <FlyerSection />
      <NoticeBoard />
      <UpcomingEvents />
      <LegacySection />
      <FeaturedArticles />
      <FeaturedBooks />
      <ClinicsSection />
    </>
  );
}