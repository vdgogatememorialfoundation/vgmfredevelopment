import { useCallback, useEffect, useState } from "react";
import { Modal, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { formatDate, listOrders, money, startBalancePayment, str, verifyBalancePayment, type Row } from "../../src/api";
import { razorpayPage } from "../../src/razorpay";
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
      setPayment(
        razorpayPage({
          key: started.keyId,
          orderId: started.razorpayOrderId,
          amount: Math.round(Number(started.amount ?? 0) * 100),
          name: str(address.fullName, session?.name ?? ""),
          email: session?.email ?? "",
          phone: str(address.phone),
          description: `Pre-order balance · ${str(order.id)}`,
        })
      );
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

  return (
    <Screen>
      <PageHeader kicker={`Order ${str(order.id)}`} title={str(order.status, "Ordered")} subtitle={`Placed ${formatDate(order.date)} · ${str(order.paymentStatus, "Pending")}`} />
      <Card>
        <Heading>Items</Heading>
        {items.map((item, index) => (
          <Muted key={`${item.bookId ?? ""}-${index}`}>
            {str(item.title)} × {item.quantity ?? 1} · {money((Number(item.price) || 0) * (Number(item.quantity) || 1))}
          </Muted>
        ))}
        <Divider />
        {Number(order.discount) > 0 ? <Muted>Discount −{money(order.discount)}</Muted> : null}
        <Muted>Shipping {Number(order.shipping) > 0 ? money(order.shipping) : "Free"}</Muted>
        {Number(order.gst) > 0 ? <Muted>GST {money(order.gst)}</Muted> : null}
        <Heading>Total {money(order.total)}</Heading>
      </Card>

      <Card>
        <Heading>{pickup ? "Store pickup" : "Delivery address"}</Heading>
        {pickup ? (
          <Muted>Collect from the Foundation store. Show your pickup OTP at the counter.</Muted>
        ) : (
          <Muted>
            {[str(address.fullName), str(address.line1), str(address.landmark), str(address.city), str(address.state), str(address.pincode)].filter(Boolean).join(", ")}
          </Muted>
        )}
      </Card>

      {trackers.length ? (
        trackers.map((tracker, index) => (
          <Card key={tracker.shipmentId || index} featured>
            <Heading>{trackers.length > 1 ? `Shipment ${tracker.part || index + 1} of ${trackers.length}` : "Tracking"}</Heading>
            <View style={{ height: 10 }} />
            <InfoTiles
              tiles={[
                { label: "Order", value: str(order.id) },
                { label: "Date", value: formatDate(order.date) },
                { label: "Status", value: str(order.status, "Ordered") },
                { label: "Courier", value: str(tracker.courier) },
              ]}
            />
            <Pipeline
              stages={tracker.stages ?? []}
              current={Number(tracker.current) || 0}
              failed={/cancel|fail|rto/i.test(str(order.status))}
              expected={str(order.status) === "Delivered" ? "" : str(tracker.expected)}
              footer={tracker.trackingId ? `Courier: ${[str(tracker.courier), `Tracking id: ${str(tracker.trackingId)}`].filter(Boolean).join(" · ")}` : undefined}
            />
          </Card>
        ))
      ) : (
        <Card>
          <Heading>Order progress</Heading>
          {[...history].reverse().map((step, index) => (
            <View key={`${step.at ?? ""}-${index}`} style={{ marginTop: 8 }}>
              <Body>{str(step.custom) || str(step.status)}</Body>
              <Muted>{[when(step.at), str(step.note)].filter(Boolean).join(" · ")}</Muted>
            </View>
          ))}
          {!history.length ? <Muted>Recorded {when(order.date)}</Muted> : null}
        </Card>
      )}
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
