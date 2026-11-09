import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { formatDate, listOrders, money, str, type Row } from "../../src/api";
import { useAuth } from "../../src/auth";
import { Body, Button, Card, Divider, Empty, Heading, Loading, Muted, PageHeader, Screen, StatusChip } from "../../src/ui";

type Item = { bookId?: string; title?: string; quantity?: number; price?: number };
type Step = { at?: string; status?: string; note?: string; custom?: string };
type Scan = { at?: string; status?: string; location?: string };
type Shipment = { id?: string; courier?: string; awb?: string; status?: string; expectedBy?: string; tracking?: Scan[]; part?: number };

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
  const shipments = (Array.isArray(order.shipments) ? order.shipments : []) as Shipment[];
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

      {shipments.map((shipment, index) => {
        const scans = [...(shipment.tracking ?? [])].sort((a, b) => Date.parse(str(b.at)) - Date.parse(str(a.at)));
        return (
          <Card key={shipment.id ?? index} featured>
            <Heading>{shipments.length > 1 ? `Shipment ${shipment.part ?? index + 1}` : "Shipment"}</Heading>
            <StatusChip label={str(shipment.status, "Booked")} />
            <Muted>
              {[str(shipment.courier), shipment.awb ? `Tracking ID ${shipment.awb}` : ""].filter(Boolean).join(" · ")}
            </Muted>
            {shipment.expectedBy && shipment.status !== "Delivered" ? <Body>Expected delivery by {str(shipment.expectedBy)}</Body> : null}
            {scans.map((scan, scanIndex) => (
              <View key={`${scan.at ?? ""}-${scanIndex}`} style={{ marginTop: 8 }}>
                <Body>{str(scan.status)}</Body>
                <Muted>{[when(scan.at), str(scan.location)].filter(Boolean).join(" · ")}</Muted>
              </View>
            ))}
          </Card>
        );
      })}
      {!shipments.length && str(order.trackingId) ? (
        <Card featured>
          <Heading>Shipment</Heading>
          <Muted>{[str(order.courierName), `Tracking ID ${str(order.trackingId)}`].filter(Boolean).join(" · ")}</Muted>
          {order.eta ? <Body>Expected delivery by {str(order.eta)}</Body> : null}
        </Card>
      ) : null}

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
      <Button kind="ghost" icon="refresh-outline" label="Refresh tracking" onPress={() => void load()} />
      <Button kind="ghost" icon="help-buoy-outline" label="Need help with this order?" onPress={() => router.push("/support")} />
    </Screen>
  );
}
