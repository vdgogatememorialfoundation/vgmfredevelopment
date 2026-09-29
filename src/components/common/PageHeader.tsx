import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import Mandala from "@/components/graphics/Mandala";
import Wave from "@/components/graphics/Wave";

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
    <section className="relative overflow-hidden bg-hero text-white">
      <div className="absolute inset-0 bg-grid opacity-60" aria-hidden="true" />
      <Mandala className="absolute -right-24 -top-24 h-[420px] w-[420px] text-gold/20 animate-spin-slow" />
      <Mandala className="absolute -bottom-40 -left-32 h-[360px] w-[360px] text-white/5" />

      <div className="container relative pb-20 pt-14 sm:pb-24 sm:pt-20">
        <nav aria-label="Breadcrumb" className="mb-6 animate-fade-up">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-white/60">
            <li>
              <Link href="/" className="flex items-center gap-1.5 transition hover:text-gold">
                <Home size={14} />
                Home
              </Link>
            </li>
            {breadcrumb?.map((item) => (
              <li key={item.href} className="flex items-center gap-1.5">
                <ChevronRight size={14} aria-hidden="true" />
                <Link href={item.href} className="transition hover:text-gold">
                  {item.name}
                </Link>
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <ChevronRight size={14} aria-hidden="true" />
              <span className="font-medium text-white" aria-current="page">
                {title}
              </span>
            </li>
          </ol>
        </nav>

        {eyebrow && (
          <p className="eyebrow text-gold animate-fade-up [animation-delay:80ms]">
            <span className="h-px w-6 bg-gold/60" />
            {eyebrow}
          </p>
        )}

        <h1 className="max-w-4xl font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl animate-fade-up [animation-delay:140ms]">
          {title}
        </h1>

        {description && (
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/70 animate-fade-up [animation-delay:220ms]">
            {description}
          </p>
        )}
      </div>

      <Wave className="absolute inset-x-0 -bottom-px text-background" />
    </section>
  );
}
