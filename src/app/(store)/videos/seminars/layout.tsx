import { SEMINAR_ADSENSE_SCRIPT } from "@/lib/seminar-ads";

/** The AdSense snippet is rendered only with seminar recordings, not on the rest of the site. */
export default function SeminarVideosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script async src={SEMINAR_ADSENSE_SCRIPT} crossOrigin="anonymous" />
      {children}
    </>
  );
}
