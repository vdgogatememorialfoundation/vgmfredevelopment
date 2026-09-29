import Link from "next/link";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumb?: { name: string; href: string }[];
}

export default function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumb,
}: PageHeaderProps) {
  return (
    <section className="border-b border-border bg-warm-cream">
      <div className="container py-14 sm:py-20">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
              <li>
                <Link
                  href="/"
                  className="transition hover:text-burgundy"
                >
                  Home
                </Link>
              </li>
              {breadcrumb.map((item, index) => (
                <li key={item.href} className="flex items-center gap-2">
                  <span aria-hidden="true">/</span>
                  {index === breadcrumb.length - 1 ? (
                    <span className="font-medium text-text-primary">
                      {item.name}
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      className="transition hover:text-burgundy"
                    >
                      {item.name}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        {eyebrow && (
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-burgundy">
            {eyebrow}
          </p>
        )}

        <h1 className="heading-1">{title}</h1>

        {description && (
          <p className="mt-5 max-w-3xl text-body-lg">{description}</p>
        )}
      </div>
    </section>
  );
}