import HeroSection from "@/components/home/HeroSection";
import NoticeBoard from "@/components/home/NoticeBoard";
import FoundationDirectory from "@/components/home/FoundationDirectory";
import AboutDirectory from "@/components/home/AboutDirectory";
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
      <FoundationDirectory />
      <AboutDirectory />
      <SupportUs />
      <UpcomingEvents />
      <LegacySection />
      <FeaturedBooks />
      <FeaturedArticles />
      <NoticeBoard />
      <ClinicsSection />
    </>
  );
}