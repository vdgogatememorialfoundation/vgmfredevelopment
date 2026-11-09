import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { formatDate, listOrders, money, str, type Row } from "../../src/api";
import { useAuth } from "../../src/auth";
import { Body, Button, Card, Divider, Empty, Heading, Loading, Muted, PageHeader, Screen } from "../../src/ui";
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
      {preorder && !preorder.balancePaidAt && Number(preorder.balance) > 0 ? (
        <Card>
          <Heading>Pre-order balance · {money(preorder.balance)}{preorder.shippingDue ? " + courier charge" : ""}</Heading>
          <Muted>{/Awaiting|^Ordered$/.test(str(order.status)) ? "You can pay this once your order is processed." : "Your order is processed. Pay the remaining amount to get it dispatched."}</Muted>
        </Card>
      ) : null}
      <Button kind="ghost" icon="refresh-outline" label="Refresh tracking" onPress={() => void load()} />
      <Button kind="ghost" icon="help-buoy-outline" label="Need help with this order?" onPress={() => router.push("/support")} />
    </Screen>
  );
}
