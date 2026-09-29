import Link from "next/link";

interface EmptyStateProps {
  title: string;
  description: string;
  cta?: { label: string; href: string };
}

export default function EmptyState({ title, description, cta }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-14 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warm-cream text-2xl">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-text-muted"
        >
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <path d="M2 10h20" />
        </svg>
      </div>
      <h2 className="mt-4 font-semibold text-text-primary">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-text-muted">
        {description}
      </p>
      {cta && (
        <Link href={cta.href} className="btn-primary mt-6">
          {cta.label}
        </Link>
      )}
    </div>
  );
}