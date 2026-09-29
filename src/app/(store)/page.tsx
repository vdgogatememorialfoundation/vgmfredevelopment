import HeroSection from "@/components/home/HeroSection";
import ImpactStats from "@/components/home/ImpactStats";
import ProgrammesSection from "@/components/home/ProgrammesSection";
import FlyerSection from "@/components/home/FlyerSection";
import UpcomingEvents from "@/components/home/UpcomingEvents";
import LegacySection from "@/components/home/LegacySection";
import Announcements from "@/components/home/Announcements";
import FeaturedArticles from "@/components/home/FeaturedArticles";
import FeaturedBooks from "@/components/home/FeaturedBooks";
import ClinicsSection from "@/components/home/ClinicsSection";
import Testimonials from "@/components/home/Testimonials";
import Partners from "@/components/home/Partners";
import FaqSection from "@/components/home/FaqSection";
import SupportCta from "@/components/home/SupportCta";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <ImpactStats />
      <ProgrammesSection />
      <FlyerSection />
      <UpcomingEvents />
      <LegacySection />
      <Announcements />
      <FeaturedBooks />
      <ClinicsSection />
      <Testimonials />
      <FeaturedArticles />
      <Partners />
      <FaqSection />
      <SupportCta />
    </>
  );
}
