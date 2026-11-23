import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { rider, type Job, type RiderSettings, type Runsheet } from "./delivery-api";
import { PaymentStep } from "./delivery-pay";
import { sounds } from "./delivery-sounds";
import { Btn, callNumber, Card, CountChip, d, errorAlert, Field, KindTag, money, openMaps, PhotoStrip, Questionnaire } from "./delivery-ui";
import { BarcodeScannerModal, P, StatusPill } from "./portal-ui";

type Filter = "all" | "delivery" | "pickup" | "priority";
const FILTERS: [Filter, string][] = [["all", "All"], ["delivery", "Delivery"], ["pickup", "Pickups"], ["priority", "Priority"]];
const matches = (job: Job, f: Filter) => f === "all" || (f === "priority" ? job.priority : f === "pickup" ? job.kind === "pickup" || job.kind === "return" : job.kind !== "pickup" && job.kind !== "return");

export function CourierDuty({ settings }: { settings: RiderSettings }) {
  const [sheets, setSheets] = useState<Runsheet[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [sheetId, setSheetId] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [stop, setStop] = useState<{ job: Job; awbs: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const known = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = (await rider.runsheets()).runsheets;
      if (known.current && next.some((sheet) => !known.current?.has(sheet.id))) sounds.notify();
      known.current = new Set(next.map((sheet) => sheet.id));
      setSheets(next);
    } catch (e) {
      errorAlert(e);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const sheet = sheets.find((s) => s.id === sheetId) ?? null;
  const finish = () => {
    setStop(null);
    setJob(null);
    void load();
  };

  if (stop) return <StopFlow job={stop.job} awbs={stop.awbs} sheet={sheet} settings={settings} onDone={finish} onBack={() => setStop(null)} />;
  if (job && sheet) return <JobDetail job={job} sheet={sheet} settings={settings} onBack={() => setJob(null)} onArrived={(awbs) => setStop({ job, awbs })} onChanged={finish} />;

  const filters = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {FILTERS.map(([id, label]) => (
        <Pressable key={id} onPress={() => setFilter(id)} style={[d.filter, filter === id && d.filterOn]}>
          <Text style={[d.filterText, filter === id && { color: P.white }]}>{label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  if (sheet) {
    const jobs = sheet.jobs.filter((j) => matches(j, filter));
    return (
      <ScrollView contentContainerStyle={d.pad} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <Pressable onPress={() => setSheetId("")} style={d.row}>
          <Ionicons name="arrow-back" size={20} color={P.ink} />
          <Text style={d.h2}>Runsheet {sheet.id}</Text>
        </Pressable>
        <Card>
          <Text style={d.label}>Jobsheet for this runsheet</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <CountChip icon="arrow-up-circle" label="Pickups" value={sheet.counts.pickup + sheet.counts.return} color={P.blue} />
            <CountChip icon="cube" label="Deliveries" value={sheet.counts.delivery + sheet.counts.obd + sheet.counts.replacement} color={P.green} />
            <CountChip icon="close-circle" label="Failed" value={sheet.failed} color={P.red} />
          </View>
          {sheet.cashToCollect > 0 ? <Text style={d.muted}>Cash to collect on this runsheet: {money(sheet.cashToCollect)}</Text> : null}
        </Card>
        {filters}
        {jobs.map((j, i) => (
          <Pressable key={j.awb} onPress={() => setJob(j)}>
            <Card>
              <View style={d.between}>
                <View style={d.row}>
                  <KindTag kind={j.kind} />
                  {j.priority ? <StatusPill label="Priority" tone="red" /> : null}
                </View>
                <Text style={d.muted}>{i + 1}/{jobs.length}</Text>
              </View>
              <Text style={d.h2}>{j.customerName}</Text>
              <Text style={d.muted} numberOfLines={2}>{j.address}</Text>
              <View style={d.between}>
                <Text style={d.body}>{j.awb}</Text>
                <StatusPill label={j.payment === "COD" ? `COD ${money(j.amountToCollect)}` : "Prepaid"} tone={j.payment === "COD" ? "amber" : "green"} />
              </View>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  const visible = sheets.filter((s) => s.jobs.some((j) => matches(j, filter)));
  return (
    <ScrollView contentContainerStyle={d.pad} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      {filters}
      {!visible.length ? (
        <Card>
          <Text style={d.h2}>No runsheets assigned yet</Text>
          <Text style={d.muted}>Runsheets for your current shift appear here as soon as the hub assigns parcels to you. Pull down to refresh.</Text>
        </Card>
      ) : null}
      {visible.map((s) => (
        <Card key={s.id}>
          <View style={d.between}>
            <Text style={d.h2}>{s.id}</Text>
            <StatusPill label={s.accepted ? "Accepted" : "New"} tone={s.accepted ? "green" : "blue"} />
          </View>
          <Text style={d.body}>{s.total} shipment{s.total === 1 ? "" : "s"}{s.priority ? ` · ${s.priority} priority` : ""}</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <CountChip icon="arrow-up-circle" label="Pickup" value={s.counts.pickup} color={P.blue} />
            <CountChip icon="cube" label="Delivery" value={s.counts.delivery} color={P.green} />
            <CountChip icon="eye" label="Open-box (OBD)" value={s.counts.obd} color={P.brand} />
            <CountChip icon="return-down-back" label="Returns" value={s.counts.return} color={P.amber} />
            <CountChip icon="swap-horizontal" label="Replacements" value={s.counts.replacement} color="#6D28D9" />
          </View>
          {s.accepted ? (
            <Btn label="Open this runsheet" icon="list" onPress={() => setSheetId(s.id)} />
          ) : (
            <Btn label="Accept this runsheet" icon="checkmark" tone="green" onPress={() => void rider.acceptRunsheet(s.id).then(() => { setSheetId(s.id); void load(); }).catch(errorAlert)} />
          )}
        </Card>
      ))}
    </ScrollView>
  );
}

function RejectModal({ visible, reasons, onClose, onReject }: { visible: boolean; reasons: string[]; onClose: () => void; onReject: (reason: string, note: string) => void }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(17,24,39,0.35)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: P.white, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, gap: 10 }}>
          <Text style={d.h2}>Why are you rejecting this shipment?</Text>
          {reasons.map((r) => (
            <Pressable key={r} onPress={() => setReason(r)} style={[d.between, { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: reason === r ? P.red : P.border, backgroundColor: reason === r ? P.redSoft : P.white }]}>
              <Text style={d.body}>{r}</Text>
              {reason === r ? <Ionicons name="checkmark-circle" size={18} color={P.red} /> : null}
            </Pressable>
          ))}
          <Field label="Add a note for the hub (optional)" value={note} onChangeText={setNote} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn label="Cancel, go back" tone="outline" flex onPress={onClose} />
            <Btn label="Reject shipment" tone="red" flex disabled={!reason} onPress={() => onReject(reason, note)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function JobDetail({ job, sheet, settings, onBack, onArrived, onChanged }: { job: Job; sheet: Runsheet; settings: RiderSettings; onBack: () => void; onArrived: (awbs: string[]) => void; onChanged: () => void }) {
  const [reject, setReject] = useState(false);
  const [busy, setBusy] = useState(false);
  const same = sheet.jobs.filter((j) => j.phone && j.phone === job.phone);
  const index = sheet.jobs.findIndex((j) => j.awb === job.awb) + 1;
  const count = (kinds: string[]) => same.filter((j) => kinds.includes(j.kind)).length;
  const cod = same.reduce((sum, j) => sum + j.amountToCollect, 0);

  const arrive = async () => {
    setBusy(true);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.granted) {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }
      const res = await rider.arrive(job.awb, lat, lng);
      const awbs = job.kind === "pickup" || job.kind === "return" ? [job.awb] : res.shipments;
      onArrived(awbs.includes(job.awb) ? awbs : [job.awb, ...awbs]);
    } catch (e) {
      errorAlert(e);
    } finally {
      setBusy(false);
    }
  };

  const askArrival = () =>
    Alert.alert("Are you at the location?", job.address, [
      { text: "Go to map", onPress: () => openMaps(job.address) },
      { text: "I have arrived", onPress: () => void arrive() },
    ]);

  return (
    <ScrollView contentContainerStyle={d.pad}>
      <Pressable onPress={onBack} style={d.row}>
        <Ionicons name="arrow-back" size={20} color={P.ink} />
        <Text style={d.h2}>Shipment {index}/{sheet.jobs.length}</Text>
      </Pressable>
      <Card>
        <View style={d.between}>
          <KindTag kind={job.kind} />
          {job.failedTries ? <StatusPill label={`Attempt ${job.failedTries + 1}`} tone="amber" /> : null}
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <CountChip icon="arrow-up-circle" label="Pickup" value={count(["pickup"])} color={P.blue} />
          <CountChip icon="cube" label="Delivery" value={count(["delivery", "replacement"])} color={P.green} />
          <CountChip icon="return-down-back" label="Return to origin (RTO)" value={count(["return"])} color={P.amber} />
          <CountChip icon="eye" label="Open-box (OBD)" value={count(["obd"])} color={P.brand} />
        </View>
        <View style={d.between}>
          <Text style={d.label}>Amount to collect from the customer</Text>
          <Text style={d.h2}>{cod > 0 ? money(cod) : "Prepaid"}</Text>
        </View>
      </Card>
      <Card>
        <Text style={d.label}>Receiver details</Text>
        <View style={d.between}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={d.h2}>{job.customerName}</Text>
            <Text style={d.body}>{job.address}</Text>
          </View>
          <Pressable onPress={() => openMaps(job.address)} style={{ padding: 10, borderRadius: 12, backgroundColor: P.blueSoft }}>
            <Ionicons name="location" size={24} color={P.blue} />
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Btn label="Call" icon="call" tone="green" flex disabled={!job.phone} onPress={() => callNumber(job.phone)} />
          <Btn label="Reject shipment" icon="close-circle" tone="red" flex onPress={() => setReject(true)} />
        </View>
      </Card>
      <Card>
        <Text style={d.label}>Items in this shipment</Text>
        {job.items.map((item, i) => (
          <Text key={i} style={d.body}>{item.title} × {item.quantity}</Text>
        ))}
      </Card>
      <Card>
        <Text style={d.label}>Tracking ID (AWB)</Text>
        <View style={d.between}>
          <Text style={d.big}>{job.awb}</Text>
          <Pressable onPress={askArrival} style={{ padding: 12, borderRadius: 12, backgroundColor: P.brand }}>
            <Ionicons name="scan" size={24} color={P.white} />
          </Pressable>
        </View>
        <Btn label="I have arrived" icon="flag" busy={busy} onPress={askArrival} />
      </Card>
      <RejectModal
        visible={reject}
        reasons={settings.failReasons}
        onClose={() => setReject(false)}
        onReject={(reason, note) => {
          setReject(false);
          void rider.fail(job.awb, job.kind, reason, note).then(onChanged).catch(errorAlert);
        }}
      />
    </ScrollView>
  );
}

type Step = "scan" | "consent" | "obd" | "returnq" | "pay" | "otp" | "done";

function StopFlow({ job, awbs, sheet, settings, onDone, onBack }: { job: Job; awbs: string[]; sheet: Runsheet | null; settings: RiderSettings; onDone: () => void; onBack: () => void }) {
  const jobs = useMemo(() => awbs.map((awb) => sheet?.jobs.find((j) => j.awb === awb) ?? { ...job, awb }), [awbs, sheet, job]);
  const isPickup = job.kind === "pickup";
  const isReturn = job.kind === "return";
  const [scanned, setScanned] = useState<string[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [scanOpen, setScanOpen] = useState(false);
  const [rejectFor, setRejectFor] = useState("");
  const [step, setStep] = useState<Step>("scan");
  const [last4, setLast4] = useState("");
  const [consent, setConsent] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({});
  const [verified, setVerified] = useState<string[]>([]);
  const [payMode, setPayMode] = useState<"prepaid" | "cash" | "qr">("prepaid");
  const [otp, setOtp] = useState("");
  const [otpInfo, setOtpInfo] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string[]>([]);

  const open = jobs.filter((j) => !rejected.includes(j.awb));
  const pending = open.filter((j) => !scanned.includes(j.awb));
  const current = pending[0];
  const obdJobs = open.filter((j) => j.kind === "obd");
  const cod = open.reduce((sum, j) => sum + j.amountToCollect, 0);

  const afterScan = () => {
    if (!open.length) return onDone();
    if (isReturn) return setStep("returnq");
    if (isPickup) return setStep("otp");
    if (obdJobs.length) return setStep("consent");
    setStep("pay");
  };

  const sendOtp = async () => {
    if (isPickup || isReturn) {
      setOtpInfo(isPickup ? "Ask the seller for the pickup OTP." : "Ask the customer for the return pickup OTP.");
      return;
    }
    try {
      const res = await rider.sendOtp(open.map((j) => j.awb));
      setOtpInfo(`OTP sent to the customer${res.maskedPhone ? ` (${res.maskedPhone})` : ""}${res.sentTo ? ` · ${res.sentTo}` : ""}.`);
    } catch (e) {
      errorAlert(e);
    }
  };

  useEffect(() => {
    if (step === "otp") void sendOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const confirm = async () => {
    setBusy(true);
    try {
      if (isPickup) {
        await rider.pickup(job.awb, otp, photos);
        setDone([job.awb]);
      } else if (isReturn) {
        await rider.returnPickup(job.awb, otp, answers[job.awb] ?? {}, photos);
        setDone([job.awb]);
      } else {
        const res = await rider.deliver({ awbs: open.map((j) => j.awb), otp, last4, payMode, answers, photos });
        setDone(res.delivered);
      }
      sounds.success();
      setStep("done");
    } catch (e) {
      errorAlert(e);
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <Card>
      <Text style={d.label}>Shipment ID to scan</Text>
      <Text style={d.big}>{current?.awb ?? open[0]?.awb ?? job.awb}</Text>
      <Text style={d.muted}>Shipments {Math.min(scanned.length + 1, open.length || 1)}/{open.length || jobs.length} · {job.customerName}</Text>
    </Card>
  );

  return (
    <ScrollView contentContainerStyle={d.pad} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onBack} style={d.row}>
        <Ionicons name="arrow-back" size={20} color={P.ink} />
        <Text style={d.h2}>{isPickup ? "Pickup" : isReturn ? "Return pickup" : "Delivery"} · {job.customerName}</Text>
      </Pressable>

      {step === "scan" ? (
        <>
          {header}
          {jobs.map((j) => (
            <Card key={j.awb}>
              <View style={d.between}>
                <View style={{ gap: 4 }}>
                  <KindTag kind={j.kind} />
                  <Text style={d.h2}>{j.awb}</Text>
                </View>
                {scanned.includes(j.awb) ? <StatusPill label="Scanned successfully ✓" tone="green" /> : rejected.includes(j.awb) ? <StatusPill label="Rejected" tone="red" /> : <StatusPill label="Not scanned yet" tone="neutral" />}
              </View>
            </Card>
          ))}
          {current ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Btn label="Scan barcode" icon="scan" flex onPress={() => setScanOpen(true)} />
              <Btn label="Reject shipment" icon="close-circle" tone="red" flex onPress={() => setRejectFor(current.awb)} />
            </View>
          ) : (
            <Btn label="Continue to next step" icon="arrow-forward" tone="green" onPress={afterScan} />
          )}
          {scanned.length && current ? <Text style={[d.muted, { textAlign: "center" }]}>Scanned successfully. Now scan the next shipment for this customer.</Text> : null}
          <Btn label="Go back" tone="outline" onPress={onBack} />
        </>
      ) : null}

      {step === "consent" ? (
        <Card>
          <Text style={d.h2}>Open-box delivery consent</Text>
          <Text style={d.muted}>The customer opens the box and checks each product in front of you before accepting it.</Text>
          {obdJobs.map((j) => (
            <View key={j.awb} style={d.between}>
              <Text style={d.body}>{j.awb}</Text>
              <StatusPill label={consent ? "Consent taken" : "Pending"} tone={consent ? "green" : "amber"} />
            </View>
          ))}
          <Field label="Last 4 digits of the customer's mobile number" value={last4} onChangeText={(v) => setLast4(v.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" maxLength={4} />
          <Btn label="Take customer's consent" icon="hand-left" disabled={last4.length !== 4} onPress={() => { setConsent(true); setStep("obd"); }} />
        </Card>
      ) : null}

      {step === "obd" ? (
        <>
          {obdJobs.map((j) => (
            <Card key={j.awb}>
              <View style={d.between}>
                <Text style={d.h2}>{j.awb}</Text>
                {verified.includes(j.awb) ? <StatusPill label="Verified ✓" tone="green" /> : null}
              </View>
              {j.items.map((item, i) => <Text key={i} style={d.muted}>{item.title} × {item.quantity}</Text>)}
              <Questionnaire questions={settings.obdQuestions} answers={answers[j.awb] ?? {}} onChange={(next) => setAnswers((a) => ({ ...a, [j.awb]: next }))} />
              <Btn label="Verify this product" icon="checkmark-done" tone="green" disabled={settings.obdQuestions.some((q) => !answers[j.awb]?.[q.id])} onPress={() => setVerified((v) => [...new Set([...v, j.awb])])} />
            </Card>
          ))}
          <PhotoStrip photos={photos} onAdd={(url) => setPhotos((p) => [...p, url])} kind="obd" />
          <Btn label="Continue to payment step" icon="arrow-forward" disabled={obdJobs.some((j) => !verified.includes(j.awb)) || !photos.length} onPress={() => setStep("pay")} />
        </>
      ) : null}

      {step === "returnq" ? (
        <Card>
          <Text style={d.h2}>Return quality check · {job.awb}</Text>
          <Questionnaire questions={settings.returnQuestions} answers={answers[job.awb] ?? {}} onChange={(next) => setAnswers((a) => ({ ...a, [job.awb]: next }))} />
          <PhotoStrip photos={photos} onAdd={(url) => setPhotos((p) => [...p, url])} kind="return" />
          <Btn label="Continue to next step" icon="arrow-forward" disabled={settings.returnQuestions.some((q) => !answers[job.awb]?.[q.id]) || !photos.length} onPress={() => setStep("otp")} />
        </Card>
      ) : null}

      {step === "pay" ? <PaymentStep orderId={open[0]?.orderId ?? job.orderId} amount={cod} onPaid={(mode) => { setPayMode(mode); setStep("otp"); }} /> : null}

      {step === "otp" ? (
        <Card>
          <Text style={d.h2}>{isPickup ? "Pickup OTP" : isReturn ? "Return pickup OTP" : "Delivery OTP"}</Text>
          {otpInfo ? <Text style={d.muted}>{otpInfo}</Text> : null}
          {open.map((j) => (
            <View key={j.awb} style={d.between}>
              <Text style={d.body}>{j.awb}</Text>
              <StatusPill label="Scanned successfully ✓" tone="green" />
            </View>
          ))}
          <Field label="Delivery OTP from the customer" value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" maxLength={6} style={[d.input, { fontSize: 24, letterSpacing: 8, textAlign: "center" }]} />
          {!isPickup && !isReturn ? <Btn label="Resend OTP" icon="refresh" tone="outline" onPress={() => void sendOtp()} /> : null}
          {isPickup ? <PhotoStrip photos={photos} onAdd={(url) => setPhotos((p) => [...p, url])} kind="pickup" min={0} /> : null}
          <Btn label="Confirm delivery" icon="checkmark-circle" tone="green" busy={busy} disabled={otp.length < 4} onPress={confirm} />
        </Card>
      ) : null}

      {step === "done" ? (
        <Card style={{ alignItems: "center", borderColor: P.green, backgroundColor: P.greenSoft }}>
          <Ionicons name="checkmark-circle" size={64} color={P.green} />
          <Text style={d.h1}>{isPickup || isReturn ? "Pickup successful" : "Delivered successfully"}</Text>
          {done.map((awb) => <Text key={awb} style={d.body}>✓ {awb}</Text>)}
          {payMode === "cash" ? <Text style={d.muted}>Cash {money(cod)} added to your shift cash.</Text> : null}
          <Btn label="Go to the next shipment" icon="arrow-forward" onPress={onDone} />
        </Card>
      ) : null}

      <BarcodeScannerModal
        visible={scanOpen}
        title="Scan shipment"
        hint="Scan the AWB barcode on the parcel"
        onClose={() => setScanOpen(false)}
        onScanned={(code) => {
          setScanOpen(false);
          const hit = open.find((j) => j.awb.toUpperCase() === code.trim().toUpperCase() || j.orderId === code.trim());
          if (!hit) {
            sounds.scanError();
            return Alert.alert("Wrong parcel", `${code} is not on this stop. Scan a parcel that belongs to this customer.`);
          }
          setScanned((s) => [...new Set([...s, hit.awb])]);
        }}
      />
      <RejectModal
        visible={Boolean(rejectFor)}
        reasons={settings.failReasons}
        onClose={() => setRejectFor("")}
        onReject={(reason, note) => {
          const awb = rejectFor;
          setRejectFor("");
          const target = jobs.find((j) => j.awb === awb);
          void rider.fail(awb, target?.kind ?? job.kind, reason, note).then(() => setRejected((r) => [...r, awb])).catch(errorAlert);
        }}
      />
    </ScrollView>
  );
}
