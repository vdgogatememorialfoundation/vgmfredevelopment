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
import DoshaSection from "@/components/home/DoshaSection";
import HerbsSection from "@/components/home/HerbsSection";
import ShlokaBand from "@/components/home/ShlokaBand";
import HeroSlider from "@/components/banners/HeroSlider";
import DisplayBanner from "@/components/banners/DisplayBanner";
import {
  getAnnouncements,
  getArticles,
  getBanners,
  getClinics,
  getEvents,
  getFlyers,
  getHomeFaqs,
  getHomepageSettings,
  getNotices,
  getPartners,
  getProducts,
  getTestimonials,
} from "@/lib/server/content";

export const revalidate = 300;

export default async function HomePage() {
  const [
    settings,
    slides,
    display,
    announcements,
    notices,
    flyers,
    events,
    products,
    articles,
    clinics,
    testimonials,
    partners,
    faqs,
  ] = await Promise.all([
    getHomepageSettings(),
    getBanners("home-slider"),
    getBanners("home-display"),
    getAnnouncements(),
    getNotices(),
    getFlyers(),
    getEvents(),
    getProducts(),
    getArticles(),
    getClinics(),
    getTestimonials(),
    getPartners(),
    getHomeFaqs(),
  ]);

  return (
    <>
      <HeroSection />
      {settings.showSlider && <HeroSlider banners={slides} interval={settings.sliderInterval} />}
      <ImpactStats />
      <ProgrammesSection />
      {settings.showDisplayBanner && <DisplayBanner banner={display[0]} />}
      {settings.showDoshas && <DoshaSection />}
      {settings.showFlyers && flyers.length > 0 && <FlyerSection flyers={flyers} />}
      {settings.showEvents && events.length > 0 && <UpcomingEvents events={events} />}
      {settings.showHerbs && <HerbsSection />}
      <LegacySection />
      {settings.showShloka && <ShlokaBand />}
      {settings.showAnnouncements && announcements.length > 0 && (
        <Announcements announcements={announcements} notices={notices} />
      )}
      {settings.showBooks && products.length > 0 && <FeaturedBooks books={products} />}
      {settings.showClinics && clinics.length > 0 && <ClinicsSection clinics={clinics} />}
      {settings.showTestimonials && testimonials.length > 0 && <Testimonials testimonials={testimonials} />}
      {settings.showArticles && articles.length > 0 && <FeaturedArticles articles={articles} />}
      {settings.showPartners && partners.length > 0 && <Partners partners={partners} />}
      {settings.showFaq && faqs.length > 0 && <FaqSection homeFaqs={faqs} />}
      {display[1] && <DisplayBanner banner={display[1]} />}
      <SupportCta />
    </>
  );
}
