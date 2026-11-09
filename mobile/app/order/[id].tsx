import { useCallback, useEffect, useState } from "react";
import { Modal, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { formatDate, listOrders, money, startBalancePayment, str, verifyBalancePayment, type Row } from "../../src/api";
import { razorpayPage } from "../../src/razorpay";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import { useAuth } from "../../src/auth";
import { Banner, Body, Button, Card, Divider, Empty, Heading, Loading, Muted, PageHeader, Screen } from "../../src/ui";
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

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = String(id ?? "");
  const { session } = useAuth();
  const [order, setOrder] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [payment, setPayment] = useState("");
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
      <Button kind="ghost" icon="refresh-outline" label="Refresh tracking" onPress={() => void load()} />
      <Button kind="ghost" icon="help-buoy-outline" label="Need help with this order?" onPress={() => router.push("/support")} />
    </Screen>
  );
}
