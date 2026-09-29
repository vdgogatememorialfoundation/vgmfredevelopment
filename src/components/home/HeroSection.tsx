import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-warm-cream">
      <div className="container grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
        {/* Content */}
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-burgundy">
            Vaidya Gogate Memorial Foundation
          </p>

          <h1 className="heading-1 max-w-3xl">
            Preserving Ayurveda.
            <br />
            Advancing Knowledge.
            <br />
            Serving Society.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-text-muted">
            A foundation dedicated to Ayurveda, education, research,
            professional development and the enduring legacy of
            Vaidya R. B. Gogate.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/events" className="btn-primary">
              Explore Events
            </Link>

            <Link
              href="/about/legacy-of-vaidya-rb-gogate"
              className="btn-secondary"
            >
              Discover Our Legacy
            </Link>
          </div>
        </div>

        {/* Hero visual */}
        <div className="relative">
          <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-warm-cream to-[#E9DDD0] p-8 text-center">
              <div>
                <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full border-2 border-burgundy">
                  <span className="font-bold text-burgundy">
                    VGMF
                  </span>
                </div>

                <h2 className="text-2xl font-bold text-text-primary">
                  Vaidya Gogate Memorial Foundation
                </h2>

                <p className="mt-2 text-text-muted">
                  Ayurveda • Education • Research
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}