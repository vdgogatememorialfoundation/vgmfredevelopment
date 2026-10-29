import type { Metadata } from "next";
import { siteConfig } from "@/lib/constants";
import { appFlavors } from "@/lib/mobile-config";

export const metadata: Metadata = {
  title: "Mobile apps",
  description: `Install the ${siteConfig.shortName} Android apps for customers, admin, staff and support. Names and logos update from the admin console without a Play Store release.`,
};

export default function AppDownloadPage() {
  return (
    <div className="container py-16">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">{siteConfig.shortName}</p>
        <h1 className="mt-2 font-serif text-4xl text-ink">Android apps</h1>
        <p className="mt-4 text-sm leading-7 text-text-muted">
          Four separate apps: customer, admin, staff and support. After install, each app loads its live name and logo from
          this website. Changing those in <strong>Admin → Mobile app</strong> and publishing updates phones immediately — no
          Play Store or App Store release.
        </p>
        <p className="mt-3 text-sm leading-7 text-text-muted">
          Android may ask you to allow installs from this browser. Content, tickets and the shop still update when the
          Foundation publishes.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {appFlavors.map((app) => (
            <article key={app.id} className="rounded-3xl border border-gold/40 bg-white p-6 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">{app.label}</p>
              <h2 className="mt-2 font-serif text-2xl text-ink">{app.defaultName}</h2>
              <p className="mt-2 text-xs text-text-muted">{app.androidPackage}</p>
              <a href={app.download} className="btn-primary mt-5 inline-flex" download={`vgmf-${app.id}.apk`}>
                Download APK
              </a>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
