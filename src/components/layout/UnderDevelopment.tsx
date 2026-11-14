export function UnderDevelopment({ title = "Under development" }: { title?: string }) {
  return (
    <div className="container py-16">
      <div className="mx-auto max-w-lg rounded-3xl border border-border bg-white p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">VGMF</p>
        <h1 className="mt-2 font-serif text-3xl text-ink">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          This section is under development. It will appear here when the Foundation publishes it.
        </p>
        <a href="/" className="btn-primary mt-6 inline-flex">
          Back to home
        </a>
      </div>
    </div>
  );
}

export function UnderDevelopmentBand({ label }: { label: string }) {
  return (
    <section className="container py-8" aria-label={`${label} under development`}>
      <div className="rounded-2xl border border-border bg-white px-6 py-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Under development</p>
        <h2 className="mt-2 font-serif text-2xl text-ink">{label}</h2>
        <p className="mt-2 text-sm text-text-muted">This section is under development.</p>
      </div>
    </section>
  );
}
