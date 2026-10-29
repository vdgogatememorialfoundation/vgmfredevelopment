"use client";

import { useEffect, useState } from "react";
import LegalPage from "@/components/common/LegalPage";
import { defaultPolicies, getPolicy, subscribePolicies, type PolicyId } from "@/lib/policies";

export default function PolicyView({ id }: { id: PolicyId }) {
  const [doc, setDoc] = useState(defaultPolicies[id]);

  useEffect(() => {
    setDoc(getPolicy(id));
    return subscribePolicies(() => setDoc(getPolicy(id)));
  }, [id]);

  return (
    <LegalPage
      eyebrow="Legal"
      title={doc.title}
      description={doc.description}
      lastUpdated={doc.lastUpdated}
      sections={doc.sections}
    />
  );
}
