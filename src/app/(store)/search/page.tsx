import { Suspense } from "react";
import SiteSearch from "@/components/store/SiteSearch";

export const metadata = { title: "Search | Vaidya Gogate Memorial Foundation" };

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SiteSearch />
    </Suspense>
  );
}
