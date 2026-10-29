import type { Metadata } from "next";
import { siteConfig } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Mobile app",
  description: `Install the ${siteConfig.shortName} Android app. Events, articles, clinics and shop listings update when the Foundation publishes from the admin console — no Play Store update is required for content.`,
};

export default function AppDownloadPage() {
  return (
    <div className="container py-16">
      <div className="mx-auto max-w-2xl rounded-3xl border border-gold/40 bg-white p-8 shadow-sm sm:p-12">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">{siteConfig.shortName}</p>
        <h1 className="mt-2 font-serif text-4xl text-ink">Foundation app</h1>
        <p className="mt-4 text-sm leading-7 text-text-muted">
          The Android app is the Foundation on your phone: events, articles, shop, clinics, videos, gallery, notices, about
          pages, certificate verification and support tickets. Sign-in uses a 6-digit <strong>email OTP</strong> only.
        </p>
        <p className="mt-3 text-sm leading-7 text-text-muted">
          When the administrator publishes from <strong>Admin → Mobile app</strong>, this app refreshes. You do not need a new
          Google Play or App Store build for ordinary website updates.
        </p>
        <a
          href="/vgmf-foundation.apk"
          className="btn-primary mt-8 inline-flex"
          download
        >
          Download Android APK
        </a>
        <p className="mt-4 text-xs leading-5 text-text-muted">
          Android may ask you to allow installs from this browser. Package name: org.vaidyagogate.app. iOS uses the same live
          feed; the App Store binary is built from the React Native project in <code>mobile/</code>.
        </p>
      </div>
    </div>
  );
}
