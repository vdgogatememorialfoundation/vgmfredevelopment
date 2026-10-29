import { appFlavors } from "@/lib/mobile-config";

export function ApkDownloadGrid({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`grid gap-4 ${compact ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2"}`}>
      {appFlavors.map((app) => (
        <article key={app.id} className="rounded-3xl border border-gold/40 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">{app.label}</p>
          <h2 className="mt-2 font-serif text-2xl text-ink">{app.defaultName}</h2>
          <p className="mt-2 break-all text-xs text-text-muted">{app.androidPackage}</p>
          <a href={app.download} className="btn-primary mt-5 inline-flex" download={`vgmf-${app.id}.apk`}>
            Download APK
          </a>
        </article>
      ))}
    </div>
  );
}
