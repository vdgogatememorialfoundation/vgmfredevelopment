import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { rider, type HyperJob, type HyperOffer, type RiderSettings } from "./delivery-api";
import { PaymentStep } from "./delivery-pay";
import { Btn, callNumber, Card, d, errorAlert, Field, money, openMaps, PhotoStrip, Questionnaire, SwipeToAccept } from "./delivery-ui";
import { BarcodeScannerModal, P, StatusPill } from "./portal-ui";

export function HyperlocalDuty({ settings }: { settings: RiderSettings }) {
  const [offers, setOffers] = useState<HyperOffer[]>([]);
  const [job, setJob] = useState<HyperJob | null>(null);
  const [finished, setFinished] = useState<HyperJob | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await rider.hyperOffers();
      setOffers(res.offers);
      setJob(res.active[0] ?? null);
    } catch {
      /* keep polling */
    }
  }, []);

  useEffect(() => {
    void poll();
    if (job || finished) return;
    const timer = setInterval(() => void poll(), 5000);
    return () => clearInterval(timer);
  }, [poll, job, finished]);

  if (finished) {
    return (
      <ScrollView contentContainerStyle={d.pad}>
        <Card style={{ alignItems: "center", borderColor: finished.status === "delivered" ? P.green : P.red, backgroundColor: finished.status === "delivered" ? P.greenSoft : P.redSoft }}>
          <Ionicons name={finished.status === "delivered" ? "checkmark-circle" : "close-circle"} size={64} color={finished.status === "delivered" ? P.green : P.red} />
          <Text style={d.h1}>{finished.status === "delivered" ? "Delivered" : "Marked failed"}</Text>
          <Text style={d.body}>Order {finished.orderId}</Text>
          <Btn label="Find next order" icon="flash" onPress={() => { setFinished(null); void poll(); }} />
        </Card>
      </ScrollView>
    );
  }

  if (job) return <HyperJobFlow job={job} settings={settings} onUpdate={setJob} onFinished={(j) => { setJob(null); setFinished(j); }} />;

  return (
    <ScrollView contentContainerStyle={d.pad}>
      {!offers.length ? <Searching /> : null}
      {offers.map((offer) => (
        <Card key={offer.orderId}>
          <View style={d.between}>
            <StatusPill label="NEW ORDER" tone="brand" />
            <Text style={[d.h2, { color: P.green }]}>Earn {money(offer.earning)}</Text>
          </View>
          <Text style={d.h2}>{offer.customerName}</Text>
          <Text style={d.body}>{offer.address}</Text>
          <View style={d.between}>
            <Text style={d.muted}>{offer.items} item{offer.items === 1 ? "" : "s"} · Order {offer.orderId}</Text>
            <StatusPill label={offer.payment === "COD" ? `COD ${money(offer.amount)}` : `Prepaid ${money(offer.amount)}`} tone={offer.payment === "COD" ? "amber" : "green"} />
          </View>
          <SwipeToAccept label="Swipe to accept" onAccept={() => void rider.hyperAccept(offer.orderId).then((r) => setJob(r.job)).catch(errorAlert)} />
        </Card>
      ))}
    </ScrollView>
  );
}

function Searching() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Card style={{ alignItems: "center", paddingVertical: 40 }}>
      <View style={{ width: 160, height: 160, alignItems: "center", justifyContent: "center" }}>
        <Animated.View style={{ position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: P.brandSoft, transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }], opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }} />
        <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: P.brand, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="radio" size={36} color={P.white} />
        </View>
      </View>
      <Text style={d.h2}>Searching for orders…</Text>
      <Text style={[d.muted, { textAlign: "center" }]}>Stay near your dark store. New orders ping here.</Text>
    </Card>
  );
}

function NavModal({ address, visible, onClose }: { address: string; visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: P.white }}>
        <View style={[d.between, { padding: 14, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: P.border }]}>
          <Text style={d.h2} numberOfLines={1}>Navigate</Text>
          <Pressable onPress={onClose}><Ionicons name="close" size={26} color={P.ink} /></Pressable>
        </View>
        <WebView source={{ uri: `https://www.google.com/maps/dir/?api=1&travelmode=two-wheeler&destination=${encodeURIComponent(address)}` }} geolocationEnabled style={{ flex: 1 }} />
      </View>
    </Modal>
  );
}

function HyperJobFlow({ job, settings, onUpdate, onFinished }: { job: HyperJob; settings: RiderSettings; onUpdate: (job: HyperJob) => void; onFinished: (job: HyperJob) => void }) {
  const [scan, setScan] = useState<"" | "scan_order" | "scan_shelf">("");
  const [checked, setChecked] = useState<number[]>([]);
  const [nav, setNav] = useState(false);
  const [busy, setBusy] = useState("");
  const [paid, setPaid] = useState<"prepaid" | "cash" | "qr" | "">(job.amountToCollect > 0 ? "" : "prepaid");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [last4, setLast4] = useState("");
  const [otp, setOtp] = useState("");
  const [failing, setFailing] = useState(false);

  const step = async (name: string, extra: Record<string, unknown> = {}) => {
    setBusy(name);
    try {
      const res = await rider.hyperStep(job.id, name, extra);
      if (res.job.status === "delivered" || res.job.status === "failed") onFinished(res.job);
      else onUpdate(res.job);
    } catch (e) {
      errorAlert(e);
    } finally {
      setBusy("");
    }
  };

  const customer = (
    <Card>
      <Text style={d.label}>Customer</Text>
      <Text style={d.h2}>{job.customerName}</Text>
      <Text style={d.body}>{job.address}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn label="Call" icon="call" tone="green" flex disabled={!job.phone} onPress={() => callNumber(job.phone)} />
        <Btn label="Navigate" icon="navigate" tone="blue" flex onPress={() => setNav(true)} />
        <Pressable onPress={() => openMaps(job.address)} style={{ padding: 12, borderRadius: 12, backgroundColor: P.blueSoft }}>
          <Ionicons name="logo-google" size={20} color={P.blue} />
        </Pressable>
      </View>
      <StatusPill label={job.payment === "COD" ? `COD ${money(job.amountToCollect)}` : "Prepaid"} tone={job.payment === "COD" ? "amber" : "green"} />
    </Card>
  );

  return (
    <ScrollView contentContainerStyle={d.pad} keyboardShouldPersistTaps="handled">
      <Card>
        <View style={d.between}>
          <Text style={d.h2}>Order {job.orderId}</Text>
          {job.openBox ? <StatusPill label="Open box · high value" tone="brand" /> : null}
        </View>
        <Text style={d.muted}>Job {job.id}</Text>
      </Card>

      {job.status === "accepted" ? (
        <>
          <Card>
            <Text style={d.label}>Pick up from</Text>
            <Text style={d.h2}>Dark store {job.pickupFrom || ""}</Text>
            <View style={d.between}>
              <Text style={d.body}>1. Scan order QR</Text>
              {job.orderScanned ? <StatusPill label="Scanned ✓" tone="green" /> : <Btn label="Scan" icon="qr-code" onPress={() => setScan("scan_order")} />}
            </View>
            <View style={d.between}>
              <Text style={d.body}>2. Scan shelf QR</Text>
              {job.shelfScanned ? <StatusPill label={`Shelf ${job.shelfScanned} ✓`} tone="green" /> : <Btn label="Scan" icon="qr-code" disabled={!job.orderScanned} onPress={() => setScan("scan_shelf")} />}
            </View>
          </Card>
          <Card>
            <Text style={d.label}>3. Check all items</Text>
            {job.items.map((item, i) => (
              <Pressable key={i} onPress={() => setChecked((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]))} style={[d.row, { paddingVertical: 6 }]}>
                <Ionicons name={checked.includes(i) ? "checkbox" : "square-outline"} size={22} color={checked.includes(i) ? P.green : P.muted} />
                <Text style={[d.body, { flex: 1 }]}>{item.title} × {item.quantity}</Text>
              </Pressable>
            ))}
          </Card>
          <Btn label="Mark as picked" icon="bag-check" tone="green" busy={busy === "picked"} disabled={!job.orderScanned || !job.shelfScanned || checked.length < job.items.length} onPress={() => void step("picked")} />
        </>
      ) : null}

      {job.status === "picked" ? (
        <>
          {customer}
          <Btn label="Mark as out for delivery" icon="bicycle" tone="green" busy={busy === "out_for_delivery"} onPress={() => void step("out_for_delivery")} />
        </>
      ) : null}

      {job.status === "out_for_delivery" ? (
        <>
          {customer}
          <Btn label="Mark arrived" icon="flag" tone="green" busy={busy === "arrived"} onPress={() => void step("arrived")} />
        </>
      ) : null}

      {job.status === "arrived" ? (
        <>
          {customer}
          <Card>
            <Text style={d.h2}>{job.openBox ? "Open-box delivery" : "Shipment photos"}</Text>
            {job.openBox ? <Text style={d.muted}>Open the box in front of the customer and photograph every item.</Text> : null}
            <PhotoStrip photos={job.photos} onAdd={(url) => void step("photo", { photo: url })} kind="hyperlocal" min={job.openBox ? job.items.length : 1} />
          </Card>
          {job.openBox ? (
            <Card>
              <Questionnaire questions={settings.obdQuestions} answers={answers} onChange={setAnswers} />
              <Field label="Customer's mobile · last 4 digits" value={last4} onChangeText={(v) => setLast4(v.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" maxLength={4} />
            </Card>
          ) : null}
          {!paid ? <PaymentStep orderId={job.orderId} amount={job.amountToCollect} onPaid={setPaid} /> : null}
          {paid ? (
            <Card>
              <Field label="Delivery OTP (from customer)" value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" maxLength={6} style={[d.input, { fontSize: 24, letterSpacing: 8, textAlign: "center" }]} />
              <Btn
                label="Mark as delivered"
                icon="checkmark-circle"
                tone="green"
                busy={busy === "delivered"}
                disabled={otp.length !== 6 || !job.photos.length || (job.openBox && (last4.length !== 4 || settings.obdQuestions.some((q) => !answers[q.id])))}
                onPress={() => void step("delivered", { otp, last4, answers, payMode: paid })}
              />
            </Card>
          ) : null}
          <Btn label="Mark as failed" icon="close-circle" tone="red" onPress={() => setFailing(true)} />
        </>
      ) : null}

      <Modal visible={failing} transparent animationType="slide" onRequestClose={() => setFailing(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(17,24,39,0.35)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: P.white, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, gap: 10 }}>
            <Text style={d.h2}>Why did the delivery fail?</Text>
            {settings.failReasons.map((r) => (
              <Pressable key={r} onPress={() => { setFailing(false); void step("failed", { reason: r }); }} style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor: P.border }}>
                <Text style={d.body}>{r}</Text>
              </Pressable>
            ))}
            <Btn label="Cancel" tone="outline" onPress={() => setFailing(false)} />
          </View>
        </View>
      </Modal>
      <NavModal address={job.address} visible={nav} onClose={() => setNav(false)} />
      <BarcodeScannerModal
        visible={Boolean(scan)}
        title={scan === "scan_order" ? "Scan order QR" : "Scan shelf QR"}
        hint={scan === "scan_order" ? "QR on the order slip / packet" : "QR label on the rack shelf"}
        onClose={() => setScan("")}
        onScanned={(code) => {
          const which = scan;
          setScan("");
          if (which) void step(which, { code });
        }}
      />
    </ScrollView>
  );
}
