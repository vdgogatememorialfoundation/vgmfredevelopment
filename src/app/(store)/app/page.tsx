"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { siteConfig } from "@/lib/constants";
import { appFlavors, isAppDownloadPublic } from "@/lib/mobile-config";
import { subscribeCms } from "@/lib/cms";

function snapshot() {
  return window.localStorage.getItem("vgmf_mobile_app") ?? "";
}

export default function AppDownloadPage() {
  useSyncExternalStore(subscribeCms, snapshot, () => "");
  const visible = isAppDownloadPublic();

  if (!visible) {
    return (
      <div className="container py-16">
        <div className="mx-auto max-w-xl rounded-3xl border border-border bg-white p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">{siteConfig.shortName}</p>
          <h1 className="mt-2 font-serif text-3xl text-ink">Android apps</h1>
          <p className="mt-4 text-sm leading-7 text-text-muted">
            Public downloads are turned off. The Foundation will publish the apps from Admin → Mobile app when they are
            ready.
          </p>
          <Link href="/" className="btn-outline mt-8 inline-flex">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

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
