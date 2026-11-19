"use client";

import type { ReactNode } from "react";
import { UnderDevelopmentBand } from "@/components/layout/UnderDevelopment";
import { homeSections, type HomeSectionId } from "@/lib/site-text";
import { useSiteText } from "@/lib/use-site-text";

export default function HomeSections({ sections }: { sections: Record<HomeSectionId, ReactNode> }) {
  const { homeOrder, homeHidden, developing } = useSiteText();
  return (
    <>
      {homeOrder
        .filter((id) => !homeHidden[id])
        .map((id) => (
          <div key={id} data-home-section={id}>
            {developing?.[`home:${id}`] ? (
              <UnderDevelopmentBand label={homeSections.find((section) => section.id === id)?.label ?? id} />
            ) : (
              sections[id]
            )}
          </div>
        ))}
    </>
  );
}
