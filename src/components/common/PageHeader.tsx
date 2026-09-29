import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import FallingPetals from "@/components/graphics/FallingPetals";
import LeafSprig from "@/components/graphics/LeafSprig";
import Lotus from "@/components/graphics/Lotus";
import Mandala from "@/components/graphics/Mandala";
import Toran from "@/components/graphics/Toran";
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
    <section className="relative overflow-hidden bg-hero text-text-primary">
      <Toran className="absolute inset-x-0 top-0 z-10" />
      <div className="absolute inset-0 bg-rangoli opacity-70" aria-hidden="true" />
      <Mandala className="absolute -right-24 -top-24 h-[420px] w-[420px] text-burgundy/20 animate-spin-slow" />
      <Lotus className="absolute bottom-10 right-8 hidden h-32 w-44 opacity-90 animate-float lg:block" />
      <LeafSprig className="absolute bottom-12 right-56 hidden h-28 w-14 origin-bottom animate-sway lg:block" />
      <FallingPetals />

      <div className="container relative pb-20 pt-20 sm:pb-24 sm:pt-24">
        <nav aria-label="Breadcrumb" className="mb-6 animate-fade-up">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-text-muted">
            <li>
              <Link href="/" className="flex items-center gap-1.5 transition hover:text-burgundy">
                <Home size={14} />
                Home
              </Link>
            </li>
            {breadcrumb?.map((item) => (
              <li key={item.href} className="flex items-center gap-1.5">
                <ChevronRight size={14} aria-hidden="true" />
                <Link href={item.href} className="transition hover:text-burgundy">
                  {item.name}
                </Link>
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <ChevronRight size={14} aria-hidden="true" />
              <span className="font-medium text-burgundy" aria-current="page">
                {title}
              </span>
            </li>
          </ol>
        </nav>

        {eyebrow && (
          <p className="eyebrow animate-fade-up [animation-delay:80ms]">
            <span className="h-px w-6 bg-burgundy/50" />
            {eyebrow}
          </p>
        )}

        <h1 className="max-w-4xl font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl animate-fade-up [animation-delay:140ms]">
          {title}
        </h1>

        {description && (
          <p className="mt-6 max-w-3xl text-lg leading-8 text-text-muted animate-fade-up [animation-delay:220ms]">
            {description}
          </p>
        )}
      </div>

      <Wave className="absolute inset-x-0 -bottom-px text-background" />
    </section>
  );
}
