"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";
import { ApkDownloadGrid } from "@/components/mobile/ApkDownloadGrid";
import { siteConfig } from "@/lib/constants";
import { isAppDownloadPublic } from "@/lib/mobile-config";
import { subscribeCms } from "@/lib/cms";

function snapshot() {
  return window.localStorage.getItem("vgmf_mobile_app") ?? "";
}

const STAFF_ROLES = new Set(["admin", "coadmin", "staff"]);

export default function AppDownloadPage() {
  useSyncExternalStore(subscribeCms, snapshot, () => "");
  const { user } = useAuth();
  const visible = isAppDownloadPublic() || STAFF_ROLES.has(user?.role ?? "");

  if (!visible) {
    return (
      <div className="container py-16">
        <div className="mx-auto max-w-xl rounded-3xl border border-border bg-white p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">{siteConfig.shortName}</p>
          <h1 className="mt-2 font-serif text-3xl text-ink">Android apps</h1>
          <p className="mt-4 text-sm leading-7 text-text-muted">
            Public downloads are turned off. Foundation staff can download from Admin → Mobile app, or turn this page on
            from there when the apps are ready to share.
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
          Four Expo (React Native) apps: customer, admin, staff and support. Staging is on this VPS at
          staging.vaidyagogate.org (and stagging.vaidyagogate.org once that A record exists). Demo of the same four apps
          is at demo.vaidyagogate.org. Uninstall the old Flutter app first. After install, each app loads its name and
          logo from the published feed.
          Changing those in <strong>Admin → Mobile app</strong> and publishing updates phones immediately. Do not email the
          APK files; Gmail blocks them. Share these download links instead.
        </p>
        <div className="mt-10">
          <ApkDownloadGrid />
        </div>
      </div>
    </div>
  );
}
