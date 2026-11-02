import SectionHeader from "@/components/account/SectionHeader";
import { SeminarVideoLibrary } from "@/components/videos/SeminarVideoLibrary";

export default function AccountSeminarVideosPage() {
  return (
    <div>
      <SectionHeader title="Seminar videos" />
      <SeminarVideoLibrary />
    </div>
  );
}
