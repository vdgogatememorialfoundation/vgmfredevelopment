import { SEMINAR_ADSENSE_SCRIPT } from "@/lib/seminar-ads";

/** The AdSense snippet stays with seminar recordings in the signed-in dashboard, not on the public site. */
export default function AccountSeminarVideosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script async src={SEMINAR_ADSENSE_SCRIPT} crossOrigin="anonymous" />
      {children}
    </>
  );
}
