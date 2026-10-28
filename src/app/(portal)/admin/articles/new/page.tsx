"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArticleEditor } from "@/components/admin/PublishingDesk";
import ClientOnly from "@/components/common/ClientOnly";

function Editor() {
  const id = useSearchParams().get("id");
  const editor = <ArticleEditor key={id ?? "new"} articleId={id} />;
  return id ? <ClientOnly>{editor}</ClientOnly> : editor;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ClientOnly>
        <Editor />
      </ClientOnly>
    </Suspense>
  );
}
