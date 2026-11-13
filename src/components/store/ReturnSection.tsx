"use client";

import { useState } from "react";
import Link from "next/link";
import { classNames } from "@/lib/utils";
import { getOrders, getReturnRequest, submitCustomerRequest, uploadReturnEvidence } from "@/lib/store";
import { RETURN_EVIDENCE, canCustomerRequestReplacement, canCustomerReturn, customerOrderPolicyCopy } from "@/lib/integrations";
import { useOrderSettings } from "@/lib/use-cms";
import { statusDay } from "@/lib/delivery-expectation";
import type { DeliveryAddress, Order, ReturnEvidenceKind, ReturnRequest, ReturnResolution } from "@/types";

type Step = "items" | "reason" | "details" | "evidence" | "resolution" | "address" | "review";

const RESOLUTION_LABEL: Record<ReturnResolution, string> = {
  refund: "Refund",
  return_refund: "Return for refund (after admin approval)",
  replacement: "Replacement copy (free)",
};

const btn = "rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60";
const primary = `${btn} bg-burgundy text-white hover:bg-burgundy-dark`;
const outline = `${btn} border border-border text-burgundy hover:bg-warm-cream`;

export default function ReturnSection({ order, phone }: { order: Order; phone?: string }) {
  const settings = useOrderSettings();
  const windowDays = order.returnableDays || settings.returns.windowDays;
  const policy = customerOrderPolicyCopy(settings);
  const [, setTick] = useState(0);
  const request = getReturnRequest(order.id) ?? order.returnRequest;
  const canReplace = canCustomerRequestReplacement({ ...order, returnRequest: request }, settings);
  const canReturn = canCustomerReturn({ ...order, returnRequest: request }, settings);
  const rules = settings.returns.reasonRules;

  const [flow, setFlow] = useState<"return" | "replacement" | null>(null);
  const [step, setStep] = useState<Step>("items");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState<Partial<Record<ReturnEvidenceKind, string[]>>>({});
  const [uploading, setUploading] = useState<ReturnEvidenceKind | "">("");
  const [resolution, setResolution] = useState<ReturnResolution>("return_refund");
  const [newAddress, setNewAddress] = useState(false);
  const [address, setAddress] = useState<DeliveryAddress | undefined>(order.deliveryAddress);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const rule = rules.find((item) => item.label === reason);
  const reasons = flow === "replacement" ? rules.filter((item) => item.replacement) : rules;
  const resolutions: ReturnResolution[] = [
    ...(canReturn ? (["return_refund"] as const) : []),
    ...(canReplace && rule?.replacement ? (["replacement"] as const) : []),
  ];
  const chosen = flow === "replacement" ? "replacement" : resolution;
  const steps: Step[] = [
    "items",
    "reason",
    "details",
    "evidence",
    ...(flow === "return" ? (["resolution"] as const) : []),
    ...(chosen === "replacement" ? (["address"] as const) : []),
    "review",
  ];
  const at = steps.indexOf(step);
  const picked = order.items.filter((item) => (qty[item.bookId] ?? 0) > 0);

  const start = (next: "return" | "replacement") => {
    setFlow(next);
    setStep("items");
    setQty(order.items.length === 1 ? { [order.items[0].bookId]: order.items[0].quantity } : {});
    setReason("");
    setEvidence({});
    setResolution(next === "replacement" ? "replacement" : "return_refund");
    setError("");
  };

  const problem = (current: Step): string => {
    if (current === "items" && !picked.length) return "Choose at least one product.";
    if (current === "reason" && !rule) return "Choose a reason.";
    if (current === "details" && note.trim().length < 5) return "Describe the problem.";
    if (current === "evidence" && rule?.require.some((kind) => !evidence[kind]?.length)) return "Add the evidence marked required.";
    if (current === "resolution" && !resolutions.includes(resolution)) return "Choose a resolution.";
    if (current === "address" && newAddress && !(address?.fullName && address.phone && address.line1 && address.city && address.pincode)) return "Fill in the replacement address.";
    return "";
  };

  const next = () => {
    const issue = problem(step);
    setError(issue);
    if (!issue) setStep(steps[Math.min(steps.length - 1, at + 1)]);
  };

  const upload = async (kind: ReturnEvidenceKind, files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    setUploading(kind);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, kind === "video" ? 1 : 6)) urls.push(await uploadReturnEvidence(file, order.id, phone));
      setEvidence((current) => ({ ...current, [kind]: [...(kind === "video" ? [] : current[kind] ?? []), ...urls].slice(0, 6) }));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not upload the file.");
    } finally {
      setUploading("");
    }
  };

  const submit = () => {
    setBusy(true);
    setError("");
    try {
      submitCustomerRequest(order, {
        resolution: chosen,
        items: picked.map((item) => ({ bookId: item.bookId, quantity: qty[item.bookId] })),
        reason,
        note,
        evidence,
        replacementAddress: chosen === "replacement" && newAddress ? address : undefined,
      });
      setFlow(null);
      setTick((value) => value + 1);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not send the request.");
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof DeliveryAddress, label: string) => (
    <label className="block">
      <span className="mb-1 block font-semibold text-text-primary">{label}</span>
      <input
        className="input-field"
        value={String(address?.[key] ?? "")}
        onChange={(event) => setAddress({ ...(address ?? { fullName: "", phone: "", line1: "", city: "", state: "", pincode: "" }), [key]: event.target.value })}
      />
    </label>
  );

  return (
    <div className="rounded-2xl border border-border bg-white p-5 text-xs text-text-muted">
      <p className="font-semibold text-text-primary">Returns and replacements</p>

      {request ? (
        <ReplacementStatus request={request} order={order} />
      ) : flow ? (
        <div className="mt-4 space-y-4">
          <p className="font-semibold text-text-primary">
            {flow === "replacement" ? "Replacement" : "Return"} · step {at + 1} of {steps.length}
          </p>

          {step === "items" && (
            <div className="space-y-2">
              <p className="text-text-primary">Select the products and quantities.</p>
              {order.items.map((item) => (
                <label key={item.bookId} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2">
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={(qty[item.bookId] ?? 0) > 0}
                      onChange={(event) => setQty({ ...qty, [item.bookId]: event.target.checked ? item.quantity : 0 })}
                    />
                    <span className="text-text-primary">{item.title}</span>
                  </span>
                  <select
                    className="rounded border border-border px-2 py-1"
                    value={qty[item.bookId] ?? 0}
                    onChange={(event) => setQty({ ...qty, [item.bookId]: Number(event.target.value) })}
                  >
                    {Array.from({ length: item.quantity + 1 }, (_, n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}

          {step === "reason" && (
            <div className="space-y-2">
              <p className="text-text-primary">Select the reason.</p>
              {reasons.map((item) => (
                <label key={item.label} className="flex items-center gap-2 rounded-lg border border-border p-2 text-text-primary">
                  <input type="radio" name="return-reason" checked={reason === item.label} onChange={() => setReason(item.label)} />
                  {item.label}
                </label>
              ))}
            </div>
          )}

          {step === "details" && (
            <label className="block">
              <span className="mb-1.5 block font-semibold text-text-primary">Describe the problem</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} className="input-field" placeholder="What is wrong with the product you received?" />
            </label>
          )}

          {step === "evidence" && (
            <div className="space-y-3">
              <p className="text-text-primary">Upload evidence. Items marked required are needed for this reason.</p>
              {RETURN_EVIDENCE.map((kind) => {
                const required = rule?.require.includes(kind.id);
                const files = evidence[kind.id] ?? [];
                return (
                  <div key={kind.id} className="rounded-lg border border-border p-2">
                    <p className="font-semibold text-text-primary">
                      {kind.label} <span className={required ? "text-red-600" : ""}>{required ? "(required)" : "(optional)"}</span>
                    </p>
                    <input
                      type="file"
                      accept={kind.id === "video" ? "video/*" : "image/*"}
                      capture="environment"
                      multiple={kind.id !== "video"}
                      disabled={Boolean(uploading)}
                      onChange={(event) => void upload(kind.id, event.target.files)}
                      className="mt-1 block w-full text-xs"
                    />
                    {uploading === kind.id && <p className="mt-1">Uploading…</p>}
                    {files.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {files.map((src, index) =>
                          kind.id === "video" ? (
                            <video key={src} src={src} controls className="h-24 rounded-lg" />
                          ) : (
                            <button key={src} type="button" title="Remove" onClick={() => setEvidence({ ...evidence, [kind.id]: files.filter((_, i) => i !== index) })} className="h-16 w-16 overflow-hidden rounded-lg border border-border">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={src} alt={`${kind.label} ${index + 1}`} className="h-full w-full object-cover" />
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {step === "resolution" && (
            <div className="space-y-2">
              <p className="text-text-primary">Select the resolution.</p>
              {resolutions.map((item) => (
                <label key={item} className="flex items-center gap-2 rounded-lg border border-border p-2 text-text-primary">
                  <input type="radio" name="return-resolution" checked={resolution === item} onChange={() => setResolution(item)} />
                  {RESOLUTION_LABEL[item]}
                </label>
              ))}
              <p>No refund is sent until the desk approves the request{resolution === "return_refund" ? " and checks the returned item" : ""}.</p>
            </div>
          )}

          {step === "address" && (
            <div className="space-y-2">
              <p className="text-text-primary">Where should the replacement go?</p>
              <label className="flex items-center gap-2 text-text-primary">
                <input type="radio" checked={!newAddress} onChange={() => setNewAddress(false)} />
                Order address: {[order.deliveryAddress?.line1, order.deliveryAddress?.city, order.deliveryAddress?.pincode].filter(Boolean).join(", ") || "store pickup"}
              </label>
              {settings.returns.replacementAddressChange && (
                <label className="flex items-center gap-2 text-text-primary">
                  <input type="radio" checked={newAddress} onChange={() => setNewAddress(true)} />
                  Use a corrected address
                </label>
              )}
              {newAddress && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {field("fullName", "Full name")}
                  {field("phone", "Phone")}
                  {field("line1", "Address")}
                  {field("landmark", "Landmark")}
                  {field("city", "City")}
                  {field("state", "State")}
                  {field("pincode", "Pincode")}
                </div>
              )}
            </div>
          )}

          {step === "review" && (
            <div className="space-y-1 rounded-xl bg-warm-cream/60 p-3 text-text-primary">
              <p>Order <span className="font-mono">{order.id}</span></p>
              <p>Products: {picked.map((item) => `${qty[item.bookId]} × ${item.title}`).join(", ")}</p>
              <p>Reason: {reason}</p>
              <p>Details: {note}</p>
              <p>Evidence: {RETURN_EVIDENCE.filter((kind) => evidence[kind.id]?.length).map((kind) => `${kind.label} (${evidence[kind.id]?.length})`).join(", ") || "none"}</p>
              <p>Resolution: {RESOLUTION_LABEL[chosen]}</p>
              {chosen === "replacement" && newAddress && address && <p>Send to: {[address.fullName, address.line1, address.city, address.pincode].filter(Boolean).join(", ")}</p>}
              <p className="text-text-muted">There is no charge to you. The desk reviews the request and emails you.</p>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex flex-wrap gap-2">
            {at > 0 && (
              <button type="button" className={outline} onClick={() => { setError(""); setStep(steps[at - 1]); }}>
                Back
              </button>
            )}
            {step === "review" ? (
              <button type="button" className={primary} disabled={busy} onClick={submit}>
                {busy ? "Sending…" : "Submit request"}
              </button>
            ) : (
              <button type="button" className={primary} disabled={Boolean(uploading)} onClick={next}>
                Next
              </button>
            )}
            <button type="button" className={outline} onClick={() => setFlow(null)}>
              Close
            </button>
          </div>
        </div>
      ) : canReturn || canReplace ? (
        <div className="mt-3 space-y-3">
          <p>
            {canReturn ? "Return a product for a refund" : ""}
            {canReturn && canReplace ? ", or " : ""}
            {canReplace ? `${canReturn ? "ask" : "Ask"} for a free replacement if you received a wrong, damaged or defective item` : ""}. The Foundation desk reviews every request and emails you.
          </p>
          <div className="flex flex-wrap gap-2">
            {canReturn && <button type="button" className={primary} onClick={() => start("return")}>Return</button>}
            {canReplace && <button type="button" className={canReturn ? outline : primary} onClick={() => start("replacement")}>Replacement</button>}
            <Link href="/contact" className={outline}>Contact support</Link>
          </div>
        </div>
      ) : (
        <p className="mt-2">
          {order.status === "Delivered"
            ? `The ${windowDays}-day return and replacement window has closed.`
            : "After delivery you can request a return or a replacement here."}
        </p>
      )}

      <div className="mt-4 rounded-xl bg-warm-cream/60 p-3">
        <p className="font-semibold text-text-primary">{policy.title}</p>
        <p className="mt-1">{policy.body}</p>
      </div>
    </div>
  );
}

function ReplacementStatus({ request, order }: { request: ReturnRequest; order: Order }) {
  const tone =
    request.status === "Rejected"
      ? "bg-red-50 text-red-700"
      : request.status === "Replacement Created" || request.status === "Accepted"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-burgundy/10 text-burgundy";
  const replacement = request.replacementOrderId ? getOrders().find((item) => item.id === request.replacementOrderId) : undefined;
  const back = order.returnShipment;

  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-xl bg-warm-cream/60 p-3">
        <p className="font-semibold text-text-primary">
          {request.kind === "replacement" ? "Replacement" : "Return"} request <span className="font-mono text-burgundy">{request.id}</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={classNames("rounded-full px-2.5 py-0.5 text-[11px] font-bold", tone)}>{request.status}</span>
          <span>Requested {statusDay(request.requestedAt)}</span>
        </div>
        {request.reason && (
          <p className="mt-2">
            Reason: <span className="font-medium text-text-primary">{request.reason}</span>
          </p>
        )}
        {request.items?.length ? <p className="mt-1">Products: {request.items.map((item) => `${item.quantity} × ${item.title}`).join(", ")}</p> : null}
        {request.resolution && <p className="mt-1">Resolution: {RESOLUTION_LABEL[request.resolution]}</p>}
        {request.note && <p className="mt-1">{request.note}</p>}
        {request.decisionNote && request.status !== "Pending Review" && <p className="mt-1">{request.decisionNote}</p>}
        {request.images?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {request.images.map((src, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`${request.id}-${index}`} src={src} alt={`Damage photo ${index + 1}`} className="h-16 w-16 rounded-lg object-cover" />
            ))}
          </div>
        ) : null}
        {request.evidence?.video?.length ? <video src={request.evidence.video[0]} controls className="mt-2 h-28 rounded-lg" /> : null}
        {request.stages?.length ? (
          <ol className="mt-3 space-y-1">
            {request.stages.map((stage) => (
              <li key={stage.id} className={stage.reached ? "text-text-primary" : ""}>
                {stage.reached ? "●" : "○"} {stage.title}
                {stage.reached && stage.at ? ` · ${statusDay(stage.at)}` : ""}
                {stage.detail ? ` — ${stage.detail}` : ""}
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      {back?.awb && !request.replacementOrderId ? (
        <div className="rounded-xl border border-burgundy/30 bg-white p-3">
          <p className="font-semibold text-text-primary">Send the item back</p>
          <p className="mt-1">
            Return AWB <span className="font-mono text-burgundy">{back.awb}</span>
            {back.courierName ? ` · ${back.courierName}` : ""}
          </p>
          <p className="mt-1">Download the label, paste it on the parcel with the defective item and hand it to the courier. The replacement ships once we have checked the item.</p>
          {back.labelUrl ? (
            <a href={back.labelUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block rounded-full bg-burgundy px-4 py-1.5 text-xs font-semibold text-white">
              Download return label
            </a>
          ) : (
            <p className="mt-1 text-xs">The desk will share the label shortly.</p>
          )}
          {back.chargePaidBy === "customer" && back.charge ? (
            back.chargePaidAt ? (
              <p className="mt-2 font-semibold text-emerald-700">Return courier charge ₹{back.charge} paid.</p>
            ) : back.chargeLink ? (
              <a href={back.chargeLink.url} className="mt-2 ml-2 inline-block rounded-full border border-burgundy px-4 py-1.5 text-xs font-semibold text-burgundy">
                Pay return courier charge ₹{back.charge}
              </a>
            ) : null
          ) : back.chargePaidBy === "foundation" ? (
            <p className="mt-2">The Foundation pays the return courier charge.</p>
          ) : null}
        </div>
      ) : null}

      {replacement && (
        <p>
          <Link href={`/account/orders/${encodeURIComponent(replacement.id)}`} className="font-semibold text-burgundy">
            Open replacement order {replacement.id}
          </Link>
        </p>
      )}
    </div>
  );
}
