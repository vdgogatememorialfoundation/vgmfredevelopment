export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startShipmentSync } = await import("@/lib/server/shipment-sync");
  startShipmentSync();
  const { startBirthdayMail } = await import("@/lib/server/birthday-mail");
  startBirthdayMail();
}
