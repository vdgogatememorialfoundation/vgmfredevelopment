"use client";

import Link from "next/link";
import PageHeader from "@/components/common/PageHeader";
import { NaturalImage } from "@/components/common/NaturalImage";
import { useState } from "react";
import { anaghaPortrait, buildTree, rbPortrait, useAbout, type AboutPerson, type TreeBranch } from "@/lib/about";
import { useI18n } from "@/components/i18n/LanguageProvider";

function Initials({ name, size }: { name: string; size: string }) {
  return (
    <div className={`flex ${size} shrink-0 items-center justify-center rounded-full border-2 border-burgundy/30 bg-burgundy/5 font-semibold text-burgundy`}>
      {name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("")}
    </div>
  );
}

function paragraphs(text: string) {
  return text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
}

function BioBlock({ text }: { text: string }) {
  return (
    <>
      {paragraphs(text).map((paragraph) => (
        <p key={paragraph.slice(0, 48)} className="text-body mb-4 whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </>
  );
}

function excerpt(text: string, count = 2) {
  return paragraphs(text).slice(0, count).join("\n\n");
}

function PortraitSquare({ src, alt, fallback, placeholder }: { src?: string; alt: string; fallback?: string; placeholder?: string }) {
  const start = src || fallback || "";
  const [shown, setShown] = useState(start);
  if (!shown) {
    return (
      <div className="mx-auto flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-slate-50 sm:mx-0 sm:h-40 sm:w-40">
        <Initials name={placeholder || alt} size="h-16 w-16" />
      </div>
    );
  }
  return (
    <div className="mx-auto h-32 w-32 shrink-0 overflow-hidden rounded-2xl border border-border bg-white shadow-sm sm:mx-0 sm:h-40 sm:w-40">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={shown}
        alt={alt}
        width={160}
        height={160}
        onError={() => {
          if (fallback && shown !== fallback) setShown(fallback);
        }}
        className="h-full w-full object-cover object-top"
      />
    </div>
  );
}

function PersonSplit({
  image,
  title,
  body,
  href,
  imageAlt,
  placeholder,
  fallback,
}: {
  image?: string;
  title: string;
  body: string;
  href?: string;
  imageAlt: string;
  placeholder?: string;
  fallback?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-4 sm:grid sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-8">
      <PortraitSquare src={image} alt={imageAlt} placeholder={placeholder} fallback={fallback} />
      <div className="w-full">
        <h2 className="heading-3">{title}</h2>
        <div className="mt-3">
          <BioBlock text={body} />
        </div>
        {href ? (
          <Link href={href} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-burgundy">
            {t("about.learnMore")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function AboutLive() {
  const about = useAbout();
  const { t } = useI18n();
  const letter = paragraphs(about.intro);
  const portrait = rbPortrait(about);
  const people = new Set(["s-legacy", "s-anagha"]);
  const others = about.sections.filter((section) => !people.has(section.id));
  return (
    <main>
      <PageHeader eyebrow={t("about.eyebrow")} title={about.title} />
      <section className="section bg-background">
        <div className="container">
          <PersonSplit
            image={portrait}
            title={about.legacy.title}
            body={excerpt(about.legacy.biography)}
            href="/about/legacy-of-vaidya-rb-gogate"
            imageAlt="Vaidya R. B. Gogate"
            placeholder="R B Gogate"
            fallback="/about/rb-gogate.jpg"
          />
        </div>
      </section>
      <section className="section bg-warm-cream">
        <div className="container">
          <PersonSplit
            image={anaghaPortrait(about)}
            title={about.anagha.title}
            body={excerpt(about.anagha.biography)}
            href="/about/dr-anagha-gogate"
            imageAlt={about.anagha.title}
            placeholder="A G"
            fallback="/about/anagha-gogate.jpg"
          />
        </div>
      </section>
      {letter.length > 0 && (
        <section className="border-b border-border bg-paper">
          <div className="container py-8 sm:py-10">
            <article className="mx-auto max-w-3xl space-y-5">
              {letter.map((paragraph) => (
                <p key={paragraph.slice(0, 48)} className="text-base leading-7 text-text-muted whitespace-pre-line">
                  {paragraph}
                </p>
              ))}
            </article>
          </div>
        </section>
      )}
      <section className="section bg-background">
        <div className="container grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {others.map((section) => {
            const body = (
              <>
                {section.image && (
                  <NaturalImage src={section.image} alt="" fit="card" className="mb-5 rounded-xl" />
                )}
                <h2 className="heading-3">{section.title}</h2>
                <p className="mt-3 whitespace-pre-line text-text-muted">{section.body}</p>
                {section.href && <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-burgundy">{t("about.learnMore")}</span>}
              </>
            );
            return section.href ? (
              <Link key={section.id} href={section.href} className="card p-8 transition hover:-translate-y-0.5">{body}</Link>
            ) : (
              <div key={section.id} className="card p-8">{body}</div>
            );
          })}
        </div>
      </section>
      {about.gallery.length > 0 && (
        <section className="section bg-warm-cream">
          <div className="container">
            <h2 className="heading-2 mb-8 text-center">{t("about.glimpses")}</h2>
            <div className="columns-1 gap-6 sm:columns-2 lg:columns-3">
              {about.gallery.map((photo) => (
                <figure key={photo.id} className="mb-6 break-inside-avoid overflow-hidden rounded-2xl border border-border bg-white">
                  <NaturalImage src={photo.src} alt={photo.title} fit="content" />
                  <figcaption className="p-5">
                    {photo.title && <p className="font-semibold text-text-primary">{photo.title}</p>}
                    {photo.description && <p className="mt-1 text-sm leading-6 text-text-muted">{photo.description}</p>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}
      {about.legacy.tree.length > 1 && (
        <section className="section bg-background">
          <div className="container">
            <FamilyTree />
            <div className="mt-8 text-center">
              <Link href="/about/legacy-of-vaidya-rb-gogate" className="btn-outline">{t("about.readLegacy")}</Link>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function TreeNode({ branch }: { branch: TreeBranch }) {
  return (
    <li className="flex flex-col items-center">
      <div className="relative flex w-48 flex-col items-center rounded-2xl border border-border bg-white p-4 text-center shadow-sm">
        {branch.photo ? (
          <NaturalImage src={branch.photo} alt={branch.name} fit="thumb" className="h-16 w-16 rounded-full border-2 border-gold/50" imgClassName="h-16 w-16 rounded-full object-cover" />
        ) : (
          <Initials name={branch.name} size="h-16 w-16" />
        )}
        <p className="mt-3 text-sm font-semibold leading-tight text-text-primary">{branch.name}</p>
        {branch.relation && <p className="mt-1 text-xs font-medium text-burgundy">{branch.relation}</p>}
        {branch.years && <p className="mt-0.5 text-[11px] text-text-muted">{branch.years}</p>}
        {branch.note && <p className="mt-2 text-xs leading-5 text-text-muted">{branch.note}</p>}
      </div>
      {branch.children.length > 0 && (
        <>
          <span className="h-6 w-px bg-burgundy/30" aria-hidden="true" />
          <ul className="relative flex flex-wrap justify-center gap-x-6 gap-y-8 border-t border-burgundy/30 pt-6">
            {branch.children.map((child) => (
              <TreeNode key={child.id} branch={child} />
            ))}
          </ul>
        </>
      )}
    </li>
  );
}

export function FamilyTree() {
  const about = useAbout();
  const { t } = useI18n();
  const roots = buildTree(about.legacy.tree);
  if (!roots.length) return null;
  return (
    <div>
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{t("about.legacyTree")}</p>
        <h2 className="heading-2 mt-2">{about.legacy.treeTitle}</h2>
        {about.legacy.treeIntro && <p className="mt-3 text-text-muted">{about.legacy.treeIntro}</p>}
      </div>
      <div className="overflow-x-auto pb-4">
        <ul className="flex min-w-max justify-center gap-10 px-4">
          {roots.map((root) => (
            <TreeNode key={root.id} branch={root} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function PersonCard({ person, featured }: { person: AboutPerson; featured?: boolean }) {
  const initials = person.name.split(" ").filter(Boolean).map((part) => part[0]).slice(-2).join("");
  if (featured) {
    return (
      <div className="card p-6 text-center">
        {person.photo ? (
          <NaturalImage src={person.photo} alt={person.name} fit="thumb" className="mx-auto h-20 w-20 rounded-full border-2 border-burgundy/20" imgClassName="h-20 w-20 rounded-full object-cover" />
        ) : (
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-burgundy/20 bg-burgundy/5">
            <span className="text-sm font-bold text-burgundy">{initials}</span>
          </div>
        )}
        <h3 className="mt-4 text-lg font-semibold text-text-primary">{person.name}</h3>
        {person.role ? <p className="mt-1 text-sm font-medium text-burgundy">{person.role}</p> : null}
        {person.bio ? <p className="mt-3 text-sm leading-6 text-text-muted">{person.bio}</p> : null}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-white p-5">
      {person.photo ? (
        <NaturalImage src={person.photo} alt={person.name} fit="thumb" className="h-12 w-12 shrink-0 rounded-full border border-burgundy/20" imgClassName="h-12 w-12 rounded-full object-cover" />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-burgundy/20 bg-burgundy/5">
          <span className="text-xs font-bold text-burgundy">{initials}</span>
        </div>
      )}
      <div>
        <p className="font-semibold text-text-primary">{person.name}</p>
        {person.role ? <p className="text-sm text-text-muted">{person.role}</p> : null}
        {person.bio ? <p className="mt-1 text-sm text-text-muted">{person.bio}</p> : null}
      </div>
    </div>
  );
}

export function FoundationLive() {
  const { foundation } = useAbout();
  const { t } = useI18n();
  return (
    <main>
      <PageHeader eyebrow={t("about.eyebrow")} title={foundation.title} description={foundation.intro} breadcrumb={[{ name: t("nav.about"), href: "/about" }]} />
      <section className="section bg-background">
        <div className="container grid gap-12 lg:grid-cols-2">
          <div>
            {foundation.sections.map((section) => (
              <div key={section.id} className="mb-10 last:mb-0">
                {section.image ? <NaturalImage src={section.image} alt="" fit="content" className="mb-4 rounded-xl" /> : null}
                <h2 className="heading-3 mb-4">{section.title}</h2>
                {section.body.includes("\n") && !section.body.includes("\n\n") ? (
                  <ul className="space-y-3 text-body" role="list">
                    {section.body.split("\n").filter(Boolean).map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className="mt-2 text-burgundy">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-body whitespace-pre-line">{section.body}</p>
                )}
              </div>
            ))}
          </div>
          <div>
            {foundation.activities.length > 0 ? <h2 className="heading-3 mb-4">{t("about.activities")}</h2> : null}
            <ul className="space-y-4" role="list">
              {foundation.activities.map((activity) => (
                <li key={activity.id} className="card p-6">
                  {activity.href ? (
                    <Link href={activity.href} className="font-semibold text-text-primary transition hover:text-burgundy">
                      {activity.title}
                    </Link>
                  ) : (
                    <p className="font-semibold text-text-primary">{activity.title}</p>
                  )}
                  <p className="mt-2 text-sm leading-6 text-text-muted">{activity.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}

export function HistoryLive() {
  const { history } = useAbout();
  const { t } = useI18n();
  return (
    <main>
      <PageHeader eyebrow={t("about.eyebrow")} title={history.title} description={history.intro} breadcrumb={[{ name: t("nav.about"), href: "/about" }]} />
      <section className="section bg-background">
        <div className="container max-w-4xl">
          <ol className="relative space-y-10 border-l-2 border-border pl-8" role="list">
            {history.timeline.map((item) => (
              <li key={item.id} className="relative">
                <span className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-burgundy bg-white" aria-hidden="true">
                  <span className="h-2 w-2 rounded-full bg-burgundy" />
                </span>
                <p className="text-sm font-bold uppercase tracking-[0.15em] text-burgundy">{item.year}</p>
                <h2 className="heading-3 mt-1">{item.title}</h2>
                <p className="mt-2 text-body">{item.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}

export function TrusteesLive() {
  const { trustees } = useAbout();
  const { t } = useI18n();
  return (
    <main>
      <PageHeader eyebrow={t("about.eyebrow")} title={trustees.title} description={trustees.intro} breadcrumb={[{ name: t("nav.about"), href: "/about" }]} />
      <section className="section bg-background">
        <div className="container">
          <h2 className="heading-3 mb-8">{trustees.trusteesHeading}</h2>
          {trustees.trustees.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-3">
              {trustees.trustees.map((person) => (
                <PersonCard key={person.id} person={person} featured />
              ))}
            </div>
          ) : (
            <p className="max-w-3xl text-body">{t("about.trusteesEmpty")}</p>
          )}
        </div>
      </section>
      <section className="section bg-warm-cream">
        <div className="container">
          <h2 className="heading-3 mb-8">{trustees.teamHeading}</h2>
          {trustees.team.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trustees.team.map((person) => (
                <PersonCard key={person.id} person={person} />
              ))}
            </div>
          ) : (
            <p className="max-w-3xl text-body">{t("about.teamEmpty")}</p>
          )}
        </div>
      </section>
    </main>
  );
}

export function LegacyLive() {
  const about = useAbout();
  const { legacy } = about;
  const { t, locale } = useI18n();
  const primary = locale === "mr" && legacy.biographyMr ? legacy.biographyMr : legacy.biography;
  const other = locale === "mr" ? legacy.biography : legacy.biographyMr;
  const secondary = other && other !== primary ? other : "";
  const secondaryLabel = locale === "mr" ? "English" : "मराठी";
  return (
    <main>
      <PageHeader eyebrow={t("about.eyebrow")} title={legacy.title} breadcrumb={[{ name: t("nav.about"), href: "/about" }]} />
      <section className="section bg-background">
        <div className="container">
          <PersonSplit
            image={rbPortrait(about)}
            title={t("about.biography")}
            body={primary}
            imageAlt="Vaidya R. B. Gogate"
            placeholder="R B Gogate"
            fallback="/about/rb-gogate.jpg"
          />
          {secondary ? (
            <div className="mt-12">
              <h2 className="heading-3 mb-4">{secondaryLabel}</h2>
              <BioBlock text={secondary} />
            </div>
          ) : null}
          <div className="mt-12">
            <h2 className="heading-3 mb-4">{t("about.philosophy")}</h2>
            <p className="text-body whitespace-pre-line">{legacy.philosophy}</p>
          </div>
        </div>
      </section>
      <section className="section bg-warm-cream">
        <div className="container max-w-4xl">
          <h2 className="heading-3 mb-10 text-center">{t("about.timeline")}</h2>
          <ol className="relative space-y-10 border-l-2 border-border pl-8" role="list">
            {legacy.timeline.map((item) => (
              <li key={item.id} className="relative">
                <span className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-burgundy bg-white" aria-hidden="true">
                  <span className="h-2 w-2 rounded-full bg-burgundy" />
                </span>
                <p className="text-sm font-bold uppercase tracking-[0.15em] text-burgundy">{item.year}</p>
                <h3 className="mt-1 text-xl font-semibold text-text-primary">{item.title}</h3>
                <p className="mt-2 text-body">{item.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="section bg-background">
        <div className="container">
          <FamilyTree />
        </div>
      </section>
    </main>
  );
}

export function AnaghaLive() {
  const { anagha } = useAbout();
  const { t } = useI18n();
  return (
    <main>
      <PageHeader eyebrow={t("about.eyebrow")} title={anagha.title} breadcrumb={[{ name: t("nav.about"), href: "/about" }]} />
      <section className="section bg-background">
        <div className="container">
          <PersonSplit
            image={anaghaPortrait({ anagha })}
            title={t("about.biography")}
            body={anagha.biography}
            imageAlt={anagha.title}
            placeholder="A G"
            fallback="/about/anagha-gogate.jpg"
          />
        </div>
      </section>
    </main>
  );
}

export function AwardsLive() {
  const { awards } = useAbout();
  const { t } = useI18n();
  return (
    <main>
      <PageHeader eyebrow={t("about.eyebrow")} title={awards.title} description={awards.intro} breadcrumb={[{ name: t("nav.about"), href: "/about" }]} />
      <section className="section bg-background">
        <div className="container grid gap-6 md:grid-cols-2">
          {awards.items.map((item) => (
            <article key={item.id} className="card p-8">
              {item.image ? <NaturalImage src={item.image} alt="" fit="card" className="mb-5 rounded-xl" /> : null}
              <h2 className="heading-3">{item.title}</h2>
              <p className="mt-3 whitespace-pre-line text-text-muted">{item.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export function ScholarshipLive() {
  const { scholarship } = useAbout();
  const { t } = useI18n();
  return (
    <main>
      <PageHeader eyebrow={t("about.eyebrow")} title={scholarship.title} description={scholarship.intro} breadcrumb={[{ name: t("nav.about"), href: "/about" }]} />
      <section className="section bg-background">
        <div className="container grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="heading-3 mb-6">{scholarship.booksTitle}</h2>
            <ul className="space-y-3" role="list">
              {scholarship.books.map((book) => (
                <li key={book} className="rounded-2xl border border-border bg-white px-5 py-4 font-semibold text-text-primary">
                  {book}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="heading-3 mb-6">{scholarship.researchTitle}</h2>
            <ul className="space-y-3" role="list">
              {scholarship.research.map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-2xl border border-border bg-white px-5 py-4">
                  <span className="mt-1 text-burgundy">✓</span>
                  <span className="text-text-primary">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
