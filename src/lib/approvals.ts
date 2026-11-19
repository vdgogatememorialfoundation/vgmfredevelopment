import { getSession } from "@/lib/auth";
import { getOrder, patchOrder } from "@/lib/admin-store";
import type { ApprovalRequest } from "@/types";

export const APPROVAL_LABELS: Record<ApprovalRequest["kind"], string> = {
  cancellation: "Cancellation",
  refund: "Refund",
  return: "Return",
  replacement: "Replacement",
};

export function staffName() {
  const user = getSession("portal");
  return [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Staff";
}

export function requestApproval(orderId: string, input: Pick<ApprovalRequest, "kind" | "note" | "amount" | "destination">) {
  const order = getOrder(orderId);
  if (!order) throw new Error("Order not found.");
  if (order.approval?.status === "Pending") throw new Error("This order is already waiting for approval.");
  const approval: ApprovalRequest = {
    id: String(Date.now()),
    status: "Pending",
    requestedAt: new Date().toISOString(),
    requestedBy: staffName(),
    ...input,
  };
  patchOrder(orderId, { approval });
  return approval;
}

/** Records the senior reviewer's decision. The approved action itself is carried out by the caller. */
export function decideApproval(orderId: string, approve: boolean, note?: string) {
  const order = getOrder(orderId);
  if (!order?.approval || order.approval.status !== "Pending") throw new Error("Nothing is waiting for approval on this order.");
  patchOrder(orderId, {
    approval: {
      ...order.approval,
      status: approve ? "Approved" : "Rejected",
      decidedAt: new Date().toISOString(),
      decidedBy: staffName(),
      decisionNote: note || undefined,
    },
  });
}
