"use client";

import type { ReactNode } from "react";
import { useSiteText } from "@/lib/use-site-text";
import type { HomeSectionId } from "@/lib/site-text";

export default function HomeSections({ sections }: { sections: Record<HomeSectionId, ReactNode> }) {
  const { homeOrder, homeHidden } = useSiteText();
  return (
    <>
      {homeOrder
        .filter((id) => !homeHidden[id])
        .map((id) => (
          <div key={id} data-home-section={id}>
            {sections[id]}
          </div>
        ))}
    </>
  );
}
