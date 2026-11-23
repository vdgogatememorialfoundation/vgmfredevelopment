import * as ops from "@/lib/server/rider-ops";
import { getAgentEnrollment } from "@/lib/server/vgmf-logistics";

type Session = { email: string; name?: string; role: string };
type Body = Record<string, unknown> | null | undefined;

const str = (value: unknown) => String(value ?? "").trim();
const list = (value: unknown) => (Array.isArray(value) ? value.map(str).filter(Boolean) : []);

/** Delivery app (courier + hyperlocal riders): every `rider-*` portal action. */
export async function handleRiderAction(action: string, body: Body, session: Session): Promise<Record<string, unknown>> {
  const email = session.email;
  const name = session.name || session.email;
  const admin = ["admin", "superadmin"].includes(session.role);
  switch (action) {
    case "rider-home": {
      const enrollment = getAgentEnrollment(email, session.role);
      return {
        enrollment,
        shifts: ops.shiftOptions(enrollment.hubCode || ""),
        bookings: ops.myBookings(email),
        active: ops.activeBooking(email),
        summary: ops.shiftSummary(email),
        settings: ops.riderSettings(),
      };
    }
    case "rider-book-shift":
      return { booking: ops.bookShift({ email, name, role: session.role, shiftId: str(body?.shiftId), mode: str(body?.mode) === "hyperlocal" ? "hyperlocal" : "courier" }) };
    case "rider-cancel-shift":
      return { booking: ops.cancelShift(email, str(body?.bookingId)) };
    case "rider-check-in":
      return { booking: ops.checkIn({ email, role: session.role, bookingId: str(body?.bookingId) }) };
    case "rider-end-shift":
      return { booking: ops.endShift(email) };
    case "rider-runsheets":
      return { runsheets: ops.riderRunsheets(email) };
    case "rider-accept-runsheet":
      return ops.acceptRunsheet(email, str(body?.runsheetId));
    case "rider-arrive":
      return ops.recordArrival(email, str(body?.awb), Number(body?.lat) || undefined, Number(body?.lng) || undefined);
    case "rider-send-otp":
      return ops.sendGroupOtp(email, list(body?.awbs));
    case "rider-deliver":
      return ops.completeDeliveries({
        email,
        name,
        awbs: list(body?.awbs),
        otp: str(body?.otp),
        last4: str(body?.last4),
        payMode: (["cash", "qr"].includes(str(body?.payMode)) ? str(body?.payMode) : "prepaid") as "prepaid" | "cash" | "qr",
        answers: (body?.answers ?? {}) as Record<string, Record<string, string>>,
        photos: list(body?.photos),
        recipientName: str(body?.recipientName),
      });
    case "rider-fail":
      return ops.failJob({ email, name, awb: str(body?.awb), kind: (str(body?.kind) || "delivery") as ops.JobKind, reason: str(body?.reason), note: str(body?.note) });
    case "rider-pickup":
      return ops.completePickup({ email, name, awb: str(body?.awb), otp: str(body?.otp), photos: list(body?.photos) });
    case "rider-return-pickup":
      return ops.completeReturnPickup({ email, name, returnAwb: str(body?.awb), otp: str(body?.otp), answers: (body?.answers ?? {}) as Record<string, string>, photos: list(body?.photos), hubCode: getAgentEnrollment(email, session.role).hubCode || "" });
    case "rider-shift-summary":
      return { summary: ops.shiftSummary(email) };
    case "rider-handover":
      return { handover: ops.submitHandover({ email, name, role: session.role, declared: Number(body?.declared || 0), denominations: body?.denominations as Record<string, number> | undefined, note: str(body?.note) }) };
    case "rider-wallet":
      return ops.riderWallet(email);
    case "rider-hyper-offers":
      return ops.hyperlocalOffers(email);
    case "rider-hyper-accept":
      return { job: await ops.acceptHyperOrder({ email, name, role: session.role, orderId: str(body?.orderId) }) };
    case "rider-hyper-step":
      return {
        job: ops.hyperStep({
          email,
          name,
          jobId: str(body?.jobId),
          step: str(body?.step) as Parameters<typeof ops.hyperStep>[0]["step"],
          code: str(body?.code),
          photo: str(body?.photo),
          otp: str(body?.otp),
          last4: str(body?.last4),
          answers: (body?.answers ?? undefined) as Record<string, string> | undefined,
          reason: str(body?.reason),
          payMode: (str(body?.payMode) || undefined) as "prepaid" | "cash" | "qr" | undefined,
        }),
      };
    case "rider-admin-handovers":
      if (!admin) throw new Error("Admins only.");
      return { handovers: ops.listHandovers() };
    case "rider-admin-verify-handover":
      if (!admin) throw new Error("Admins only.");
      return { handover: ops.verifyHandover(str(body?.id), body?.ok !== false, name) };
    case "rider-admin-wallet-entry":
      if (!admin) throw new Error("Admins only.");
      return { txn: ops.walletEntry({ email: str(body?.email), type: (str(body?.type) || "payout") as "payout" | "adjustment" | "incentive", amount: Number(body?.amount || 0), note: str(body?.note), by: name }) };
    case "rider-admin-settings":
      if (!admin) throw new Error("Admins only.");
      return { settings: body?.settings ? ops.saveRiderSettings(body.settings as Partial<ops.RiderSettings>) : ops.riderSettings() };
    default:
      throw new Error("Unknown delivery app action.");
  }
}
