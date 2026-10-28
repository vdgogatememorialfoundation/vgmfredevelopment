"use client";

import { SiteModuleHub } from "@/components/admin/SiteModules";
import { SupportUsDesk } from "@/components/admin/PublishingDesk";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <div className="space-y-8">
      <ClientOnly>
        <SupportUsDesk />
      </ClientOnly>
      <SiteModuleHub />
    </div>
  );
}
