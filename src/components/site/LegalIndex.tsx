"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PageHeader from "@/components/common/PageHeader";
import { useI18n } from "@/components/i18n/LanguageProvider";
import { defaultPolicies, getPolicies, subscribePolicies, policyHref, policyIds } from "@/lib/policies";

export default function LegalIndex() {
  const { t } = useI18n();
  const [docs, setDocs] = useState(defaultPolicies);

  useEffect(() => {
    setDocs(getPolicies());
    return subscribePolicies(() => setDocs(getPolicies()));
  }, []);

  return (
    <main>
      <PageHeader eyebrow={t("legal.eyebrow")} title={t("nav.legal")} description="All policies of the Foundation in one place." />
      <section className="section bg-background">
        <div className="container grid max-w-4xl gap-4 sm:grid-cols-2">
          {policyIds.map((id) => (
            <Link key={id} href={policyHref[id]} className="rounded-2xl border border-border bg-white p-5 transition hover:border-burgundy">
              <h2 className="heading-3 text-burgundy">{docs[id].title}</h2>
              {docs[id].description && <p className="mt-2 text-sm text-text-muted">{docs[id].description}</p>}
              <p className="mt-3 text-xs text-text-muted">{t("legal.lastUpdated")}: {docs[id].lastUpdated}</p>
            </Link>
          ))}
          <Link href="/faq" className="rounded-2xl border border-border bg-white p-5 transition hover:border-burgundy">
            <h2 className="heading-3 text-burgundy">{t("footer.faq")}</h2>
          </Link>
        </div>
      </section>
    </main>
  );
}
