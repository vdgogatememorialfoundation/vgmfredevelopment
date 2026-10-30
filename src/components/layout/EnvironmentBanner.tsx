import { platformEnv } from "@/lib/platform";

export function EnvironmentBanner() {
  const env = platformEnv();
  if (env !== "demo" && env !== "staging") return null;
  const demo = env === "demo";
  return (
    <div
      className={`z-50 px-4 py-2 text-center text-xs font-semibold tracking-wide ${
        demo ? "bg-amber-500 text-ink" : "bg-ink text-white"
      }`}
    >
      {demo
        ? "Demo platform — customer, admin, staff and support at demo.vaidyagogate.org. Sister demos: demo.fellowship.vaidyagogate.org and demo.autism.vaidyagogate.org. No live payments."
        : "Staging — this is not the public website. Publish here before production."}
    </div>
  );
}
