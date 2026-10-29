"use client";

import { useEffect, useState } from "react";
import LegalPage from "@/components/common/LegalPage";
import { defaultPolicies, getPolicy, subscribePolicies, type PolicyId } from "@/lib/policies";
import { useI18n } from "@/components/i18n/LanguageProvider";

export default function PolicyView({ id }: { id: PolicyId }) {
  const { t } = useI18n();
  const [doc, setDoc] = useState(defaultPolicies[id]);

  useEffect(() => {
    setDoc(getPolicy(id));
    return subscribePolicies(() => setDoc(getPolicy(id)));
  }, [id]);

  return (
    <LegalPage
      eyebrow={t("legal.eyebrow")}
      title={doc.title}
      description={doc.description}
      lastUpdated={doc.lastUpdated}
      sections={doc.sections}
    />
  );
}
