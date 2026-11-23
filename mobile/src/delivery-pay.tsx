import { useState } from "react";
import { Image, Linking, Pressable, Text, View } from "react-native";
import { rider } from "./delivery-api";
import { Btn, Card, d, errorAlert, money } from "./delivery-ui";
import { P, StatusPill } from "./portal-ui";

/** COD / prepaid step. Prepaid just continues; COD takes cash or a UPI QR from the payment gateway. */
export function PaymentStep({ orderId, amount, onPaid }: { orderId: string; amount: number; onPaid: (mode: "prepaid" | "cash" | "qr") => void }) {
  const [mode, setMode] = useState<"cash" | "qr">("cash");
  const [qr, setQr] = useState<{ url: string; ref: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (amount <= 0) {
    return (
      <Card>
        <StatusPill label="PREPAID ORDER" tone="green" />
        <Text style={d.h2}>Nothing to collect from the customer</Text>
        <Text style={d.muted}>The customer has already paid online. Do not collect any money.</Text>
        <Btn label="Continue to delivery OTP" icon="arrow-forward" onPress={() => onPaid("prepaid")} />
      </Card>
    );
  }

  const makeQr = async () => {
    setBusy(true);
    try {
      const res = await rider.codQr(orderId);
      setQr({ url: res.paymentUrl || res.qrData, ref: res.referenceId });
    } catch (e) {
      errorAlert(e);
    } finally {
      setBusy(false);
    }
  };

  const checkQr = async () => {
    if (!qr) return;
    setBusy(true);
    try {
      await rider.codConfirm(orderId, "razorpay", qr.ref);
      onPaid("qr");
    } catch (e) {
      errorAlert(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <StatusPill label="CASH ON DELIVERY (COD)" tone="amber" />
      <Text style={d.label}>Amount to collect from the customer</Text>
      <Text style={d.big}>{money(amount)}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["cash", "qr"] as const).map((m) => (
          <Pressable key={m} onPress={() => setMode(m)} style={[d.filter, { flex: 1, alignItems: "center" }, mode === m && d.filterOn]}>
            <Text style={[d.filterText, mode === m && { color: P.white }]}>{m === "cash" ? "Cash" : "UPI QR"}</Text>
          </Pressable>
        ))}
      </View>
      {mode === "cash" ? (
        <Btn label={`I have collected ${money(amount)} cash`} icon="cash" tone="green" onPress={() => onPaid("cash")} />
      ) : !qr ? (
        <Btn label="Show UPI payment QR to the customer" icon="qr-code" busy={busy} onPress={makeQr} />
      ) : (
        <View style={{ alignItems: "center", gap: 10 }}>
          <Image source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(qr.url)}` }} style={{ width: 240, height: 240 }} />
          <Text style={d.muted}>Ask the customer to scan this QR with any UPI app (Google Pay, PhonePe, Paytm).</Text>
          <Btn label="Open the payment link" tone="outline" onPress={() => void Linking.openURL(qr.url)} />
          <Btn label="Check if the payment is received" icon="checkmark-circle" tone="green" busy={busy} onPress={checkQr} />
        </View>
      )}
    </Card>
  );
}
