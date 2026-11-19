import { useState } from "react";
import { router } from "expo-router";
import { money, str, trackOrder, type Row } from "../src/api";
import { Banner, Button, Card, Field, Heading, Muted, PageHeader, Screen } from "../src/ui";

export default function TrackScreen() {
  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [order, setOrder] = useState<Row | null>(null);

  const lookUp = async () => {
    setBusy(true);
    setMessage("");
    setOrder(null);
    try {
      const found = await trackOrder(orderId, phone);
      if (!found) setMessage("No shipment matches that order number and mobile number.");
      else setOrder(found);
    } catch {
      setMessage("Tracking could not be loaded. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const history = (Array.isArray(order?.history) ? order?.history : []) as { at?: string; status?: string; note?: string }[];
  const items = (Array.isArray(order?.items) ? order?.items : []) as { title?: string; quantity?: number }[];

  return (
    <Screen>
      <PageHeader kicker="Orders" title="Track a shipment" subtitle="Enter your order number and the mobile number used at checkout." />
      <Field label="Order number" value={orderId} onChange={setOrderId} autoCapitalize="none" />
      <Field label="Mobile number" value={phone} onChange={setPhone} keyboard="phone-pad" />
      <Button label={busy ? "Looking up…" : "Track"} disabled={busy || !orderId.trim() || !phone.trim()} onPress={() => void lookUp()} />
      <Banner text={message} tone="error" />
      {order ? (
        <Card>
          <Heading>{str(order.id)}</Heading>
          <Muted>Status · {str(order.status)}</Muted>
          {str(order.courier) ? <Muted>Courier · {str(order.courier)}{str(order.awb) ? ` · AWB ${str(order.awb)}` : ""}</Muted> : null}
          {items.map((item, index) => (
            <Muted key={`${item.title}-${index}`}>{str(item.title)} × {item.quantity ?? 1}</Muted>
          ))}
          <Muted>Total {money(Number(order.total) || 0)}</Muted>
          {history
            .slice()
            .reverse()
            .map((step, index) => (
              <Muted key={`${step.at}-${index}`}>
                {step.at ? new Date(step.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : ""} · {str(step.status)}
                {step.note ? ` — ${step.note}` : ""}
              </Muted>
            ))}
          <Button kind="ghost" label="Open full order" onPress={() => router.push(`/order/${encodeURIComponent(str(order.id))}` as never)} />
        </Card>
      ) : null}
    </Screen>
  );
}
