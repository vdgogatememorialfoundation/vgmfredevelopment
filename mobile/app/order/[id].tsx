import { useCallback, useEffect, useState } from "react";
import { Modal, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { formatDate, listOrders, money, startBalancePayment, str, verifyBalancePayment, type Row } from "../../src/api";
import { nativeCheckout, razorpayPage } from "../../src/razorpay";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import { useAuth } from "../../src/auth";
import { Banner, Body, Button, Card, Divider, Empty, Heading, Loading, Muted, PageHeader, Screen } from "../../src/ui";

const REFUND_CREDIT_NOTE = "The amount will be credited to your bank account within 5–7 working days after the refund is processed. If it has not arrived by then, please contact your bank.";

/** Same rule as the website: credited 7 working days after Razorpay processes the refund. */
function refundCredited(refund: Row) {
  const processed = Date.parse(str(refund.processedAt));
  if (!Number.isFinite(processed)) return false;
  const date = new Date(processed);
  for (let left = 7; left > 0; ) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) left -= 1;
  }
  return Date.now() >= date.getTime();
}
import { InfoTiles, Pipeline, type TrackStage } from "../../src/tracker";

type Item = { bookId?: string; title?: string; quantity?: number; price?: number };
type Step = { at?: string; status?: string; note?: string; custom?: string };
type Tracker = { shipmentId?: string; part?: number; courier?: string; trackingId?: string; expected?: string; current?: number; stages?: TrackStage[] };

function when(value: unknown) {
  const text = str(value);
  if (!text) return "";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const RETURN_STEPS = ["Pending Review", "Accepted", "Return Approved", "Pickup Scheduled", "Picked Up", "Refunded"];

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = String(id ?? "");
  const { session } = useAuth();
  const [order, setOrder] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [payment, setPayment] = useState("");
  const [link, setLink] = useState("");
  const [paying, setPaying] = useState(false);
  const [payNote, setPayNote] = useState("");
  const [payTone, setPayTone] = useState<"error" | "success">("error");

  const load = useCallback(async () => {
    try {
      const rows = await listOrders();
      setOrder(rows.find((row) => str(row.id) === orderId) ?? null);
      setNote("");
    } catch (error) {
      setNote((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!session) {
      router.replace("/login");
      return;
    }
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => clearInterval(timer);
  }, [session, load]);

  if (loading) return <Loading label="Opening the order…" />;
  if (!order) {
    return (
      <Screen>
        <Empty icon="receipt-outline" label={note || "This order was not found on your account."} actionLabel="My orders" onAction={() => router.replace("/account/orders")} />
      </Screen>
    );
  }

  const items = (Array.isArray(order.items) ? order.items : []) as Item[];
  const history = (Array.isArray(order.history) ? order.history : []) as Step[];
  const trackers = (Array.isArray(order.tracking) ? order.tracking : []) as Tracker[];
  const preorder = (order.preorderPayment ?? null) as { balance?: number; balancePaidAt?: string; shippingDue?: boolean } | null;
  const waiting = ["Pending", "Paid", "Awaiting Confirmation", "Ordered"].includes(str(order.status));
  const proceed = async () => {
    setPaying(true);
    setPayNote("");
    try {
      const started = await startBalancePayment(str(order.id));
      if (!started.keyId || !started.razorpayOrderId) throw new Error("Online payment is not available right now. Please try again later.");
      const address = (order.deliveryAddress ?? {}) as Row;
      const options = {
        key: started.keyId,
        orderId: started.razorpayOrderId,
        amount: Math.round(Number(started.amount ?? 0) * 100),
        name: str(address.fullName, session?.name ?? ""),
        email: session?.email ?? "",
        phone: str(address.phone),
        description: `Balance · ${str(order.id)}`,
      };
      const native = await nativeCheckout(options);
      if (native) {
        setPaying(false);
        await onPayment(native as WebViewMessageEvent);
        return;
      }
      setPayment(razorpayPage(options));
      void load();
    } catch (error) {
      setPayTone("error");
      setPayNote((error as Error).message);
    } finally {
      setPaying(false);
    }
  };
  const onPayment = async (event: WebViewMessageEvent) => {
    setPayment("");
    let message: { type?: string; paymentId?: string; razorpayOrderId?: string; signature?: string; error?: string } = {};
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      message = { type: "error" };
    }
    if (message.type !== "success") {
      setPayTone("error");
      setPayNote(message.type === "dismiss" ? "Payment was cancelled." : message.error || "The payment did not go through.");
      return;
    }
    try {
      await verifyBalancePayment({ orderId: str(order.id), paymentId: message.paymentId, razorpayOrderId: message.razorpayOrderId, signature: message.signature });
      setPayTone("success");
      setPayNote("Balance paid. Your order will be dispatched.");
      void load();
    } catch (error) {
      setPayTone("error");
      setPayNote((error as Error).message);
    }
  };
  const links: { label: string; url: string; amount?: number }[] = [];
  const pushLink = (label: string, value: unknown, amount?: unknown, done?: unknown) => {
    const url = str((value as Row | null | undefined)?.url);
    const expires = str((value as Row | null | undefined)?.expiresAt);
    if (url && !done && !(expires && Date.parse(expires) < Date.now())) links.push({ label, url, amount: Number(amount) || undefined });
  };
  const paymentLink = (order.paymentLink ?? null) as Row | null;
  pushLink("Complete your payment", paymentLink, paymentLink?.amount ?? order.total, str(order.paymentStatus) === "Paid");
  const upgrade = (order.courierUpgrade ?? null) as Row | null;
  pushLink("Courier charge", upgrade?.link, upgrade?.amount, upgrade?.paidAt);
  const returned = (order.returnShipment ?? null) as Row | null;
  pushLink("Return courier charge", returned?.chargeLink, returned?.charge, returned?.chargePaidAt || str(returned?.chargePaidBy) === "foundation");
  const returnRequest = (order.returnRequest ?? null) as Row | null;
  const returnShipment = (order.returnShipment ?? null) as Row | null;
  const refunds = (Array.isArray(order.refunds) ? order.refunds : []) as Row[];
  const address = (order.deliveryAddress ?? {}) as Row;
  const pickup = str(order.deliveryMode) === "store_pickup";
  const isPaid = str(order.paymentStatus) === "Paid" && (!preorder || Boolean(preorder.balancePaidAt) || !preorder.balance);
  const topExpected = (() => {
    const raw = str(trackers[0]?.expected || order.eta);
    return raw && !/yet to be dispatched|pending|n\/a/i.test(raw) ? raw : "";
  })();

  return (
    <Screen>
      {/* Flipkart Order ID Top Band */}
      <View style={{ backgroundColor: "#FFFFFF", marginHorizontal: -20, marginTop: -8, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8, borderBottomWidth: 1, borderColor: "#E4E7EC" }}>
        <Text style={{ fontSize: 12, color: "#666E7A", fontWeight: "600" }}>Order ID - {str(order.id)}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: "#212121" }}>{str(order.status, "Ordered")}</Text>
          {isPaid && str(order.status) !== "Cancelled" ? (
            <View style={{ backgroundColor: "#EAF7EE", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: "#26A541" }}>✔ Paid</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ fontSize: 12, color: "#666E7A", marginTop: 2 }}>
          Placed on {formatDate(order.date)} · {str(order.paymentStatus, "Pending")}
        </Text>
      </View>

      {trackers.length ? (
        trackers.map((tracker, index) => {
          const exp = str(tracker.expected || order.eta);
          const safeExp = exp && !/yet to be dispatched|pending|n\/a/i.test(exp) ? exp : "";
          return (
            <View key={tracker.shipmentId || index} style={{ backgroundColor: "#FFFFFF", marginHorizontal: -20, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#E4E7EC" }}>
              {trackers.length > 1 ? (
                <Text style={{ fontSize: 14.5, fontWeight: "800", color: "#212121", marginBottom: 10 }}>
                  Shipment {tracker.part || index + 1} of {trackers.length}
                </Text>
              ) : null}
              <InfoTiles
                tiles={[
                  { label: "Order", value: str(order.id) },
                  { label: "Date", value: formatDate(order.date) },
                  { label: "Status", value: str(order.status, "Ordered") },
                  { label: "Courier", value: str(tracker.courier) },
                ]}
              />
              {!pickup && str(order.status) !== "Delivered" && str(order.status) !== "Cancelled" && safeExp ? (
                <Text style={{ fontSize: 13.5, color: "#212121", marginBottom: 10 }}>
                  <Text style={{ fontWeight: "800" }}>Expected delivery by </Text>
                  <Text style={{ color: "#26A541", fontWeight: "800" }}>{safeExp}</Text>
                </Text>
              ) : null}
              <Pipeline
                stages={tracker.stages ?? []}
                current={Number(tracker.current) || 0}
                failed={/cancel|fail|rto/i.test(str(order.status))}
                expected={str(order.status) === "Delivered" ? "" : safeExp}
                shippedWith={tracker.trackingId || tracker.courier ? [`Shipped with ${str(tracker.courier) || "the courier"}`, tracker.trackingId ? `Tracking id: ${str(tracker.trackingId)}` : ""].filter(Boolean).join(" · ") : undefined}
                footer={tracker.trackingId ? `Courier: ${[str(tracker.courier), `Tracking id: ${str(tracker.trackingId)}`].filter(Boolean).join(" · ")}` : undefined}
              />
            </View>
          );
        })
      ) : (
        <View style={{ backgroundColor: "#FFFFFF", marginHorizontal: -20, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#E4E7EC" }}>
          <Heading>Order Updates</Heading>
          {topExpected && str(order.status) !== "Delivered" && str(order.status) !== "Cancelled" ? (
            <Text style={{ fontSize: 13.5, color: "#26A541", fontWeight: "700", marginTop: 4 }}>Expected delivery by {topExpected}</Text>
          ) : null}
          {[...history].reverse().filter((step, index, list) => str(step.status) && list.findIndex((other) => str(other.status) === str(step.status)) === index).map((step, index) => (
            <View key={`${step.at ?? ""}-${index}`} style={{ marginTop: 8 }}>
              <Body>{str(step.status)}</Body>
              <Muted>{when(step.at)}</Muted>
            </View>
          ))}
          {!history.length ? <Muted>Recorded {when(order.date)}</Muted> : null}
        </View>
      )}

      {/* Flipkart Edge-to-Edge Price Details Band */}
      <View style={{ backgroundColor: "#FFFFFF", marginHorizontal: -20, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#E4E7EC" }}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: "#212121", marginBottom: 8 }}>Price Details</Text>
        {items.map((item, index) => (
          <View key={`${item.bookId ?? ""}-${index}`} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10, paddingVertical: 4 }}>
            <Text style={{ flex: 1, fontSize: 13.5, color: "#212121", fontWeight: "600" }}>{str(item.title)} × {item.quantity ?? 1}</Text>
            <Text style={{ fontSize: 13.5, color: "#212121", fontWeight: "700" }}>{money((Number(item.price) || 0) * (Number(item.quantity) || 1))}</Text>
          </View>
        ))}
        <View style={{ height: 1, backgroundColor: "#E4E7EC", marginVertical: 8 }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
          <Text style={{ fontSize: 13, color: "#666E7A" }}>List Price</Text>
          <Text style={{ fontSize: 13, color: "#212121" }}>{money((Number(order.subtotal) || 0) + (Number(order.discount) || 0))}</Text>
        </View>
        {Number(order.discount) > 0 ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
            <Text style={{ fontSize: 13, color: "#666E7A" }}>Discount</Text>
            <Text style={{ fontSize: 13, color: "#26A541", fontWeight: "700" }}>− {money(Number(order.discount) || 0)}</Text>
          </View>
        ) : null}
        {Number(order.gst) > 0 ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
            <Text style={{ fontSize: 13, color: "#666E7A" }}>GST</Text>
            <Text style={{ fontSize: 13, color: "#212121" }}>{money(order.gst)}</Text>
          </View>
        ) : null}
        {Number(order.platformFee) > 0 ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
            <Text style={{ fontSize: 13, color: "#666E7A" }}>Platform fee</Text>
            <Text style={{ fontSize: 13, color: "#212121" }}>{money(order.platformFee)}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
          <Text style={{ fontSize: 13, color: "#666E7A" }}>Shipping</Text>
          <Text style={{ fontSize: 13, color: Number(order.shipping) > 0 ? "#212121" : "#26A541", fontWeight: "700" }}>
            {pickup
              ? "Store pickup · FREE"
              : Number(order.shipping) > 0
                ? money(order.shipping)
                : order.shippingDue || preorder?.shippingDue
                  ? "Calculated once packed"
                  : "FREE"}
          </Text>
        </View>
        <View style={{ height: 1, backgroundColor: "#E4E7EC", marginVertical: 8 }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 15.5, fontWeight: "800", color: "#212121" }}>Total Amount</Text>
          <Text style={{ fontSize: 16.5, fontWeight: "900", color: "#212121" }}>{money(order.total)}</Text>
        </View>
      </View>

      {/* Flipkart Edge-to-Edge Shipping Details Band */}
      <View style={{ backgroundColor: "#FFFFFF", marginHorizontal: -20, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#E4E7EC" }}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: "#212121", marginBottom: 6 }}>{pickup ? "Store Pickup Details" : "Shipping Details"}</Text>
        {pickup ? (
          <Text style={{ fontSize: 13, color: "#666E7A", lineHeight: 19 }}>Collect from the Foundation store, Pune. Show your pickup OTP at the counter.</Text>
        ) : (
          <>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#212121" }}>{str(address.fullName)}</Text>
            <Text style={{ fontSize: 13, color: "#4B5563", marginTop: 3, lineHeight: 19 }}>
              {[str(address.line1), str(address.landmark), str(address.city), str(address.state), str(address.pincode)].filter(Boolean).join(", ")}
            </Text>
            {str(address.phone) ? <Text style={{ fontSize: 13, color: "#212121", fontWeight: "600", marginTop: 4 }}>Phone: {str(address.phone)}</Text> : null}
          </>
        )}
      </View>
      <Modal visible={Boolean(payment)} animationType="slide" onRequestClose={() => void onPayment({ nativeEvent: { data: JSON.stringify({ type: "dismiss" }) } } as WebViewMessageEvent)}>
        {payment ? <WebView originWhitelist={["*"]} source={{ html: payment, baseUrl: "https://api.razorpay.com" }} onMessage={(event) => void onPayment(event)} javaScriptEnabled /> : null}
      </Modal>
      {preorder && !preorder.balancePaidAt && (Number(preorder.balance) > 0 || preorder.shippingDue) && str(order.status) !== "Cancelled" ? (
        <Card featured>
          <Heading>Pre-order balance{Number(preorder.balance) > 0 ? ` · ${money(preorder.balance)}` : ""}{preorder.shippingDue ? " + courier charge" : ""}</Heading>
          <Muted>{waiting ? "You can pay this once your order is processed." : "Your order is processed. Pay the remaining amount to get it dispatched."}</Muted>
          <Banner text={payNote} tone={payTone} />
          {waiting ? null : <Button icon="card-outline" label={paying ? "Working out the courier charge…" : "Proceed to pay"} disabled={paying} onPress={() => void proceed()} />}
        </Card>
      ) : null}
      {returnRequest ? (
        <Card featured>
          <Heading>{str(returnRequest.kind) === "replacement" ? "Replacement" : "Return"} · {str(returnRequest.status, "Pending Review")}</Heading>
          <Muted>Requested {formatDate(returnRequest.requestedAt)}{str(returnRequest.reason) ? ` · ${str(returnRequest.reason)}` : ""}</Muted>
          {RETURN_STEPS.map((step, index) => {
            const current = RETURN_STEPS.indexOf(str(returnRequest.status));
            const done = str(returnRequest.status) === "Rejected" ? index === 0 : current >= index;
            return <Muted key={step}>{done ? "●" : "○"} {step}</Muted>;
          })}
          {str(returnRequest.status) === "Rejected" ? <Muted>✕ Rejected{str(returnRequest.note) ? ` · ${str(returnRequest.note)}` : ""}</Muted> : null}
          {returnShipment && str(returnShipment.awb) ? <Muted>Return pickup · AWB {str(returnShipment.awb)}{str(returnShipment.courierName) ? ` · ${str(returnShipment.courierName)}` : ""}</Muted> : null}
          {Number(returnRequest.refundAmount) > 0 ? <Muted>Refund amount {money(returnRequest.refundAmount)}</Muted> : null}
          {str(returnRequest.replacementOrderId) ? <Button kind="ghost" icon="swap-horizontal-outline" label={`Replacement order ${str(returnRequest.replacementOrderId)}`} onPress={() => router.push(`/order/${str(returnRequest.replacementOrderId)}` as never)} /> : null}
        </Card>
      ) : null}
      {refunds.length ? (
        <Card featured>
          <Heading>Refunds</Heading>
          {refunds.map((refund, index) => {
            const toWallet = str(refund.destination) === "store_credit";
            const failed = str(refund.status) === "failed";
            const processed = str(refund.status) === "processed" || Boolean(str(refund.processedAt));
            const credited = toWallet || refundCredited(refund);
            const bankRef = str(refund.utr || refund.arn || refund.rrn);
            const stages: TrackStage[] = [
              { id: "initiated", label: "Refund initiated", caption: `${money(refund.amount)} · ${formatDate(refund.at)}`, reached: true },
              { id: "bank", label: "Refund processing", caption: "Takes 3–5 working days", reached: true },
              failed
                ? { id: "failed", label: "Refund failed", caption: "The Foundation will contact you", reached: true }
                : { id: "processed", label: "Refund processed", caption: [str(refund.processedAt) ? formatDate(refund.processedAt) : "", bankRef ? `Bank ref ${bankRef}` : ""].filter(Boolean).join(" · "), reached: processed || toWallet },
              ...(failed ? [] : [{ id: "credited", label: toWallet ? "Added to your wallet" : "Credited to your account", caption: toWallet ? "" : REFUND_CREDIT_NOTE, reached: credited }]),
            ];
            return (
              <View key={str(refund.id, String(index))} style={{ marginTop: 8 }}>
                <Body>{money(refund.amount)} · {toWallet ? "To your wallet" : "To the original payment method"}</Body>
                <Pipeline stages={stages} current={stages.map((stage) => Boolean(stage.reached)).lastIndexOf(true)} failed={failed} />
              </View>
            );
          })}
        </Card>
      ) : null}
      {links.map((item) => (
        <Card key={item.url} featured>
          <Heading>{item.label}{item.amount ? ` · ${money(item.amount)}` : ""}</Heading>
          <Muted>The Foundation sent a payment request for this order. Pay it here in the app.</Muted>
          <Button icon="card-outline" label={item.amount ? `Pay ${money(item.amount)}` : "Pay now"} onPress={() => setLink(item.url)} />
        </Card>
      ))}
      <Modal visible={Boolean(link)} animationType="slide" onRequestClose={() => { setLink(""); void load(); }}>
        {link ? (
          <View style={{ flex: 1, paddingTop: 36 }}>
            <Button kind="ghost" icon="close-outline" label="Close and refresh the order" onPress={() => { setLink(""); void load(); }} />
            <WebView source={{ uri: link }} javaScriptEnabled style={{ flex: 1 }} />
          </View>
        ) : null}
      </Modal>
      <Button kind="ghost" icon="refresh-outline" label="Refresh tracking" onPress={() => void load()} />
      <Button kind="ghost" icon="help-buoy-outline" label="Need help with this order?" onPress={() => router.push("/support")} />
    </Screen>
  );
}
