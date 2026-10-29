"use client";

import Link from "next/link";
import PageHeader from "@/components/common/PageHeader";
import { buildTree, useAbout, type AboutPerson, type TreeBranch } from "@/lib/about";
import { useI18n } from "@/components/i18n/LanguageProvider";

function Initials({ name, size }: { name: string; size: string }) {
  return (
    <div className={`flex ${size} shrink-0 items-center justify-center rounded-full border-2 border-burgundy/30 bg-burgundy/5 font-semibold text-burgundy`}>
      {name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("")}
    </div>
  );
}

export function AboutLive() {
  const about = useAbout();
  const { t } = useI18n();
  return (
    <main>
      <PageHeader eyebrow={t("about.eyebrow")} title={about.title} description={about.intro} />
      {about.heroImage && (
        <section className="bg-background pt-10">
          <div className="container">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={about.heroImage} alt="" className="aspect-[21/8] w-full rounded-2xl border border-border object-cover" />
          </div>
        </section>
      )}
      <section className="section bg-background">
        <div className="container grid gap-6 md:grid-cols-2">
          {about.sections.map((section) => {
            const body = (
              <>
                {section.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={section.image} alt="" className="mb-5 aspect-[16/8] w-full rounded-xl object-cover" />
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
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {about.gallery.map((photo) => (
                <figure key={photo.id} className="overflow-hidden rounded-2xl border border-border bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.src} alt={photo.title} className="aspect-[4/3] w-full object-cover" />
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
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branch.photo} alt={branch.name} className="h-16 w-16 rounded-full border-2 border-gold/50 object-cover" />
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
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.photo} alt={person.name} className="mx-auto h-20 w-20 rounded-full border-2 border-burgundy/20 object-cover" />
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
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.photo} alt={person.name} className="h-12 w-12 shrink-0 rounded-full border border-burgundy/20 object-cover" />
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
                {section.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={section.image} alt="" className="mb-4 aspect-[16/8] w-full rounded-xl object-cover" />
                ) : null}
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
          <div className="grid gap-6 md:grid-cols-3">
            {trustees.trustees.map((person) => (
              <PersonCard key={person.id} person={person} featured />
            ))}
          </div>
        </div>
      </section>
      <section className="section bg-warm-cream">
        <div className="container">
          <h2 className="heading-3 mb-8">{trustees.teamHeading}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trustees.team.map((person) => (
              <PersonCard key={person.id} person={person} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export function LegacyLive() {
  const { legacy } = useAbout();
  const { t } = useI18n();
  return (
    <main>
      <PageHeader eyebrow={t("about.eyebrow")} title={legacy.title} description={legacy.intro} breadcrumb={[{ name: t("nav.about"), href: "/about" }]} />
      <section className="section bg-background">
        <div className="container grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="heading-3 mb-4">{t("about.biography")}</h2>
            {legacy.biography.split(/\n\s*\n/).map((paragraph, index) => (
              <p key={index} className="text-body mb-4">{paragraph}</p>
            ))}
            <h2 className="heading-3 mb-4 mt-10">{t("about.philosophy")}</h2>
            <p className="text-body whitespace-pre-line">{legacy.philosophy}</p>
          </div>
          <div>
            <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
              {legacy.portrait ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={legacy.portrait} alt="Vaidya R. B. Gogate" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center bg-slate-50 p-8 text-center">
                  <div>
                    <Initials name="R B" size="mx-auto mb-5 h-24 w-24" />
                    <p className="text-lg font-bold text-text-primary">Vaidya R. B. Gogate</p>
                    <p className="mt-2 text-sm text-text-muted">{t("legacy.portraitRole")}</p>
                  </div>
                </div>
              )}
            </div>
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
