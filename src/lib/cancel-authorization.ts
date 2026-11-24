/** Admin-side cancellations need an OTP sent to every Admin / Co-admin. One OTP covers a whole bulk selection. */
export async function authorizeCancellation(orderIds: string[]): Promise<boolean> {
  const post = async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/admin/cancel-otp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    return (await response.json().catch(() => ({ ok: false, error: "Server error." }))) as { ok: boolean; error?: string; message?: string; requestId?: string };
  };
  const sent = await post({ action: "send", orderIds });
  if (!sent.ok || !sent.requestId) throw new Error(sent.error || "Could not send the cancellation OTP.");
  const label = orderIds.length === 1 ? `order ${orderIds[0]}` : `${orderIds.length} orders`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = window.prompt(`${sent.message}\n\nEnter the 6-digit OTP to cancel ${label}:`);
    if (!code) return false;
    const check = await post({ action: "verify", requestId: sent.requestId, orderIds, code });
    if (check.ok) return true;
    if (check.error !== "Incorrect OTP.") throw new Error(check.error || "OTP check failed.");
    window.alert("Incorrect OTP. Try again.");
  }
  throw new Error("Incorrect OTP entered 3 times. Start the cancellation again.");
}
