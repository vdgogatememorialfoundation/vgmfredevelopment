import Link from "next/link";

export default function NotFound() {
  return (
    <section className="section bg-background">
      <div className="container flex min-h-[50vh] flex-col items-center justify-center text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-burgundy">
          Error 404
        </p>

        <h1 className="heading-1 mt-4">Page Not Found</h1>

        <p className="mt-5 max-w-md text-body">
          The page you are looking for could not be found. It may have
          moved, or the address may be incorrect.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link href="/" className="btn-primary">
            Return Home
          </Link>
          <Link href="/events" className="btn-outline">
            Explore Events
          </Link>
        </div>
      </div>
    </section>
  );
}