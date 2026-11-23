import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CourierDuty } from "./delivery-courier";
import { HyperlocalDuty } from "./delivery-hyperlocal";
import { LocationGate, useRiderLocation } from "./delivery-location";
import { rider, type Enrollment, type RiderSettings, type ShiftBooking, type ShiftOption, type ShiftSummary, type Wallet } from "./delivery-api";
import { Btn, Card, d, errorAlert, Field, money, PhotoStrip } from "./delivery-ui";
import { callPortal, portalLogin, savePortalSession, type PortalSession } from "./portal-api";
import { P, PortalTabBar, PortalTopBar, StatusPill } from "./portal-ui";

/* ---------------- Sign in / Sign up ---------------- */

export function DeliveryAuth({ onSignedIn }: { onSignedIn: (session: PortalSession) => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === "signin") {
        onSignedIn(await portalLogin(email.trim(), password));
      } else {
        const res = await callPortal<{ token: string; session: PortalSession }>("delivery-signup", { name, email: email.trim(), phone, password });
        const session = { ...res.session, token: res.token };
        await savePortalSession(session);
        onSignedIn(session);
      }
    } catch (e) {
      errorAlert(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[d.screen, { backgroundColor: P.white }]}>
      <ScrollView contentContainerStyle={{ padding: 22, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", gap: 8, marginTop: 24 }}>
          <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: P.brandSoft, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="bicycle" size={38} color={P.brand} />
          </View>
          <Text style={d.h1}>VGMF Delivery</Text>
          <Text style={[d.muted, { textAlign: "center" }]}>Vaidya Gogate Memorial Foundation · Delivery executives and hyperlocal riders</Text>
        </View>
        <View style={{ flexDirection: "row", backgroundColor: P.bg, borderRadius: 12, padding: 4 }}>
          {(["signin", "signup"] as const).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)} style={{ flex: 1, paddingVertical: 10, borderRadius: 9, backgroundColor: mode === m ? P.white : "transparent", alignItems: "center" }}>
              <Text style={{ fontWeight: "800", color: mode === m ? P.brand : P.muted }}>{m === "signin" ? "Sign in" : "Sign up"}</Text>
            </Pressable>
          ))}
        </View>
        {mode === "signup" ? <Field label="Full name (as on ID)" value={name} onChangeText={setName} /> : null}
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        {mode === "signup" ? <Field label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={13} /> : null}
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <Btn label={mode === "signin" ? "Sign in" : "Create account"} icon={mode === "signin" ? "log-in" : "person-add"} onPress={submit} busy={busy} disabled={!email || password.length < 6 || (mode === "signup" && (!name || phone.replace(/\D/g, "").length < 10))} />
        {mode === "signup" ? <Text style={[d.muted, { textAlign: "center" }]}>Next you'll do KYC and get activated at your hub or dark store.</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------------- App shell ---------------- */

type Home = { enrollment: Enrollment; shifts: ShiftOption[]; bookings: ShiftBooking[]; active: ShiftBooking | null; summary: ShiftSummary; settings: RiderSettings };

export function DeliveryAppShell({ session, onSignOut }: { session: PortalSession; onSignOut: () => void }) {
  const [tab, setTab] = useState("duty");
  const [home, setHome] = useState<Home | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setHome(await rider.home());
    } catch (e) {
      errorAlert(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activated = home?.enrollment.status === "approved";
  const active = home?.active ?? null;
  const location = useRiderLocation(Boolean(active));
  const tabs = [
    { id: "duty", label: "Home", icon: "home" },
    { id: "work", label: active?.mode === "hyperlocal" ? "Orders" : "Runsheets", icon: active?.mode === "hyperlocal" ? "flash" : "list" },
    { id: "wallet", label: "Earnings", icon: "wallet" },
    { id: "account", label: "Account", icon: "person-circle" },
  ];

  return (
    <SafeAreaView style={d.screen} edges={["top"]}>
      <PortalTopBar title={tab === "work" ? (active?.mode === "hyperlocal" ? "Hyperlocal" : "Runsheets") : tab === "wallet" ? "Earnings & wallet" : tab === "account" ? "Account" : "Home · my shifts"} subtitle={session.name} onRefresh={load} refreshing={loading} />
      {home && activated ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: active ? "#E7F6EC" : "#F2F4F5", borderBottomWidth: 1, borderBottomColor: "#D5D9D9" }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: active ? P.green : P.muted }} />
          <Text style={{ flex: 1, fontSize: 13.5, fontWeight: "700", color: "#0F1111" }}>
            {active ? `On duty · ${active.mode === "hyperlocal" ? "Hyperlocal" : "Normal orders"} · ${active.shiftName} until ${active.end}` : "Off duty · book a shift and check in to get work"}
          </Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        {!home ? null : activated && tab !== "account" && (location.state === "denied" || location.state === "off") ? (
          <LocationGate state={location.state} retry={location.retry} />
        ) : !activated && tab !== "account" ? (
          <Onboarding enrollment={home.enrollment} onDone={load} />
        ) : tab === "duty" ? (
          <DutyScreen home={home} reload={load} openWork={() => setTab("work")} />
        ) : tab === "work" ? (
          !active ? (
            <ScrollView contentContainerStyle={d.pad}>
              <Card>
                <Text style={d.h2}>You're not on duty</Text>
                <Text style={d.muted}>Book a shift and check in on the Duty tab. You get runsheets and orders only during your checked-in shift.</Text>
                <Btn label="Go to Duty" icon="time" onPress={() => setTab("duty")} />
              </Card>
            </ScrollView>
          ) : active.mode === "hyperlocal" ? (
            <HyperlocalDuty settings={home.settings} />
          ) : (
            <CourierDuty settings={home.settings} />
          )
        ) : tab === "wallet" ? (
          <WalletScreen />
        ) : (
          <ScrollView contentContainerStyle={d.pad}>
            <Card>
              <Text style={d.h2}>{session.name}</Text>
              <Text style={d.muted}>{session.email}</Text>
              <View style={d.row}>
                <StatusPill label={activated ? "Activated" : home?.enrollment.status === "pending" ? "Awaiting activation" : "KYC needed"} tone={activated ? "green" : "amber"} />
                {home?.enrollment.hubCode ? <StatusPill label={`Hub ${home.enrollment.hubCode}`} tone="blue" /> : null}
              </View>
            </Card>
            <Btn label="Sign out" icon="log-out" tone="outline" onPress={() => Alert.alert("Sign out?", "", [{ text: "Cancel" }, { text: "Sign out", style: "destructive", onPress: onSignOut }])} />
          </ScrollView>
        )}
      </View>
      <PortalTabBar tabs={tabs} active={tab} onSelect={setTab} />
    </SafeAreaView>
  );
}

/* ---------------- KYC + activation ---------------- */

function Onboarding({ enrollment, onDone }: { enrollment: Enrollment; onDone: () => void }) {
  const [hubs, setHubs] = useState<{ code: string; name: string; city?: string; type?: string }[]>([]);
  const [hubCode, setHubCode] = useState(enrollment.hubCode || "");
  const [serviceMode, setServiceMode] = useState<"normal" | "hyperlocal" | "both">("normal");
  const [docType, setDocType] = useState("Aadhaar");
  const [docNo, setDocNo] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [phone, setPhone] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void callPortal<{ hubs: { code: string; name: string; city?: string; type?: string }[] }>("delivery-dashboard").then((res) => setHubs(res.hubs ?? [])).catch(() => undefined);
  }, []);

  const submit = async () => {
    setBusy(true);
    try {
      await rider.kycSubmit({ documentType: docType, documentNumber: docNo, idPhotoUrl: photos[0] || "", phone, vehicleNo: vehicle });
      await callPortal("delivery-request-hub", { hubCode, serviceMode });
      Alert.alert("Submitted", "Go to your hub / dark store with your original ID. The hub manager activates your ID.");
      onDone();
    } catch (e) {
      errorAlert(e);
    } finally {
      setBusy(false);
    }
  };

  if (enrollment.status === "pending") {
    return (
      <ScrollView contentContainerStyle={d.pad}>
        <Card>
          <Ionicons name="hourglass" size={34} color={P.amber} />
          <Text style={d.h2}>Waiting for activation</Text>
          <Text style={d.body}>Your KYC is submitted. Visit hub / dark store {enrollment.hubCode || ""} with your original ID and vehicle papers. Once the hub manager activates you, pull to refresh.</Text>
          <Btn label="Check activation status" icon="refresh" tone="outline" onPress={onDone} />
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={d.pad} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={d.h2}>Step 1 · KYC</Text>
        <Text style={d.label}>ID document</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {["Aadhaar", "PAN", "Driving licence", "Voter ID"].map((t) => (
            <Pressable key={t} onPress={() => setDocType(t)} style={[d.filter, docType === t && d.filterOn]}>
              <Text style={[d.filterText, docType === t && { color: P.white }]}>{t}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="Document number" value={docNo} onChangeText={setDocNo} autoCapitalize="characters" />
        <Field label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label="Vehicle number" value={vehicle} onChangeText={setVehicle} autoCapitalize="characters" placeholder="MH12AB1234" />
        <PhotoStrip photos={photos} onAdd={(url) => setPhotos((p) => [...p, url])} kind="kyc" />
      </Card>
      <Card>
        <Text style={d.h2}>Step 2 · Work type and hub</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {([["normal", "Courier delivery"], ["hyperlocal", "Hyperlocal"], ["both", "Both"]] as const).map(([id, label]) => (
            <Pressable key={id} onPress={() => setServiceMode(id)} style={[d.filter, { flex: 1, alignItems: "center" }, serviceMode === id && d.filterOn]}>
              <Text style={[d.filterText, serviceMode === id && { color: P.white }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={d.label}>{serviceMode === "hyperlocal" ? "Dark store" : "Hub"}</Text>
        {hubs.map((hub) => (
          <Pressable key={hub.code} onPress={() => setHubCode(hub.code)} style={[d.between, { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: hubCode === hub.code ? P.brand : P.border, backgroundColor: hubCode === hub.code ? P.brandSoft : P.white }]}>
            <Text style={d.body}>{hub.name} {hub.city ? `· ${hub.city}` : ""}</Text>
            <Text style={d.muted}>{hub.code}</Text>
          </Pressable>
        ))}
      </Card>
      <Btn label="Submit KYC and request activation" icon="shield-checkmark" onPress={submit} busy={busy} disabled={!docNo || !hubCode || !photos.length} />
    </ScrollView>
  );
}

/* ---------------- Duty: shift booking, check-in, end of shift ---------------- */

function DutyScreen({ home, reload, openWork }: { home: Home; reload: () => void; openWork: () => void }) {
  const [busy, setBusy] = useState("");
  const [handover, setHandover] = useState(false);
  const act = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    try {
      await fn();
      if (done) Alert.alert("Done", done);
      reload();
    } catch (e) {
      errorAlert(e);
    } finally {
      setBusy("");
    }
  };

  const onDuty = home.bookings.find((b) => b.status === "on_duty") ?? null;
  if (handover && onDuty) return <HandoverScreen summary={home.summary} onClose={() => setHandover(false)} onDone={() => { setHandover(false); reload(); }} />;

  const section = (mode: "courier" | "hyperlocal") => {
    const hyper = mode === "hyperlocal";
    const mine = home.bookings.filter((b) => b.mode === mode);
    const duty = mine.find((b) => b.status === "on_duty") ?? null;
    const upcoming = mine.filter((b) => b.status === "booked");
    const booked = new Set(mine.map((b) => b.shiftId));
    return (
      <View key={mode} style={{ gap: 12 }}>
        <View style={[d.row, { marginTop: 6 }]}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: hyper ? P.amberSoft : P.blueSoft, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={hyper ? "flash" : "cube"} size={20} color={hyper ? P.amber : P.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={d.h2}>{hyper ? "Hyperlocal orders" : "Normal orders (courier delivery)"}</Text>
            <Text style={d.muted}>{hyper ? "Quick deliveries from your dark store to nearby customers." : "Runsheets of deliveries, pickups, returns and open-box parcels from your hub."}</Text>
          </View>
        </View>
        {duty ? (
          <Card style={{ borderColor: P.green, backgroundColor: P.greenSoft }}>
            <StatusPill label="ON DUTY" tone="green" />
            <Text style={d.h2}>{duty.shiftName} · {duty.start} to {duty.end}</Text>
            <Text style={d.label}>Shift confirmation ID</Text>
            <Text style={d.big}>{duty.id}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[["Delivered", home.summary.delivered ?? 0], ["Pickups", home.summary.pickups ?? 0], ["Returns", home.summary.returns ?? 0], ["Failed", home.summary.failed ?? 0]].map(([label, value]) => (
                <View key={String(label)} style={[d.chip, { backgroundColor: P.white }]}>
                  <Text style={d.chipValue}>{value}</Text>
                  <Text style={d.chipLabel}>{label}</Text>
                </View>
              ))}
            </View>
            <Btn label={hyper ? "Start finding hyperlocal orders" : "Open my runsheets"} icon="play" tone="green" onPress={openWork} />
            <Btn label="End shift and hand over cash" icon="cash" tone="outline" onPress={() => setHandover(true)} />
          </Card>
        ) : null}
        {upcoming.map((b) => {
          const live = home.shifts.find((s) => s.id === b.shiftId)?.live;
          return (
            <Card key={b.id}>
              <StatusPill label="BOOKED" tone="blue" />
              <Text style={d.h2}>{b.shiftName} · {b.start} to {b.end}</Text>
              <Text style={d.label}>Shift confirmation ID</Text>
              <Text style={d.big}>{b.id}</Text>
              {live ? (
                <Btn label="Check in and start my duty" icon="finger-print" tone="green" busy={busy === b.id} disabled={Boolean(onDuty)} onPress={() => act(b.id, () => rider.checkIn(b.id), `You are checked in. Your duty runs until ${b.end}.`)} />
              ) : (
                <Text style={d.muted}>Check-in opens {home.settings.checkInGraceMinutes ?? 15} minutes before your shift starts at {b.start}.</Text>
              )}
              <Btn label="Cancel this booking" tone="outline" busy={busy === `x${b.id}`} onPress={() => act(`x${b.id}`, () => rider.cancelShift(b.id))} />
            </Card>
          );
        })}
        <Card>
          <Text style={d.label}>Book a {hyper ? "hyperlocal" : "courier delivery"} shift for today</Text>
          {home.shifts.map((s) => (
            <View key={s.id} style={[d.between, { paddingVertical: 10, borderTopWidth: 1, borderTopColor: P.border }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={d.body}>{s.name} · {s.startTime} to {s.endTime}</Text>
                <View style={d.row}>
                  {s.live ? <StatusPill label="Running now" tone="green" /> : null}
                  {s.surge > 1 ? <StatusPill label={`Surge pay ×${s.surge}`} tone="amber" /> : null}
                  {!s.bookable ? <Text style={d.muted}>This shift has ended</Text> : null}
                </View>
              </View>
              {booked.has(s.id) ? (
                <StatusPill label="Booked" tone="blue" />
              ) : (
                <Btn label="Book shift" busy={busy === `${mode}${s.id}`} disabled={!s.bookable} onPress={() => act(`${mode}${s.id}`, () => rider.bookShift(s.id, mode), `Shift booked. Check in when it starts.`)} />
              )}
            </View>
          ))}
        </Card>
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={d.pad} refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
      {section("courier")}
      {section("hyperlocal")}
    </ScrollView>
  );
}

const NOTES = [500, 200, 100, 50, 20, 10];

function HandoverScreen({ summary, onClose, onDone }: { summary: ShiftSummary; onClose: () => void; onDone: () => void }) {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [coins, setCoins] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const declared = NOTES.reduce((sum, n) => sum + n * Number(counts[n] || 0), 0) + Number(coins || 0);
  const expected = summary.cashExpected ?? 0;
  const diff = Math.round((declared - expected) * 100) / 100;

  const submit = async () => {
    setBusy(true);
    try {
      const denominations = Object.fromEntries(NOTES.map((n) => [String(n), Number(counts[n] || 0)]));
      if (expected > 0 || declared > 0) await rider.handover(declared, { ...denominations, coins: Number(coins || 0) }, note);
      await rider.endShift();
      Alert.alert("Shift ended", expected > 0 ? `Handover of ${money(declared)} submitted to the hub.` : "No cash to hand over.");
      onDone();
    } catch (e) {
      errorAlert(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={d.pad} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onClose} style={d.row}>
        <Ionicons name="arrow-back" size={20} color={P.ink} />
        <Text style={d.h2}>End of shift · cash reconciliation</Text>
      </Pressable>
      <Card>
        <View style={d.between}><Text style={d.body}>Cash collected (COD)</Text><Text style={d.h2}>{money(expected)}</Text></View>
        <View style={d.between}><Text style={d.body}>UPI / QR collected</Text><Text style={d.body}>{money(summary.qrCollected ?? 0)}</Text></View>
        <View style={d.between}><Text style={d.muted}>Delivered {summary.delivered ?? 0} · Pickups {summary.pickups ?? 0} · Returns {summary.returns ?? 0} · Failed {summary.failed ?? 0}</Text></View>
        {(summary.cashOrders ?? []).map((row) => (
          <View key={row.awb} style={d.between}><Text style={d.muted}>{row.awb}</Text><Text style={d.muted}>{money(row.amount)}</Text></View>
        ))}
      </Card>
      <Card>
        <Text style={d.h2}>Count your cash</Text>
        {NOTES.map((n) => (
          <View key={n} style={d.between}>
            <Text style={[d.body, { width: 70 }]}>₹{n} ×</Text>
            <Field label="" value={counts[n] ?? ""} onChangeText={(v) => setCounts((c) => ({ ...c, [n]: v.replace(/\D/g, "") }))} keyboardType="number-pad" style={[d.input, { width: 90 }]} />
            <Text style={[d.body, { width: 80, textAlign: "right" }]}>{money(n * Number(counts[n] || 0))}</Text>
          </View>
        ))}
        <Field label="Coins (₹)" value={coins} onChangeText={(v) => setCoins(v.replace(/[^\d.]/g, ""))} keyboardType="decimal-pad" />
        <View style={d.between}><Text style={d.h2}>Handing over</Text><Text style={d.h2}>{money(declared)}</Text></View>
        <View style={d.between}>
          <Text style={d.body}>Difference</Text>
          <StatusPill label={diff === 0 ? "Matches" : diff > 0 ? `${money(diff)} extra` : `${money(-diff)} short`} tone={diff === 0 ? "green" : "red"} />
        </View>
        {diff !== 0 ? <Field label="Reason for difference" value={note} onChangeText={setNote} /> : null}
      </Card>
      <Btn label="Hand over to hub and end shift" icon="checkmark-done" tone="green" busy={busy} disabled={diff !== 0 && !note.trim()} onPress={submit} />
    </ScrollView>
  );
}

/* ---------------- Earnings & surge wallet ---------------- */

function WalletScreen() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const load = useCallback(() => {
    void rider.wallet().then(setWallet).catch(errorAlert);
  }, []);
  useEffect(load, [load]);
  if (!wallet) return null;
  return (
    <ScrollView contentContainerStyle={d.pad} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
      <Card style={{ backgroundColor: P.brandSoft, borderColor: P.brand }}>
        <Text style={d.label}>Wallet balance</Text>
        <Text style={d.big}>{money(wallet.balance)}</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[["Today", money(wallet.today)], ["Surge today", money(wallet.todaySurge)], ["Jobs today", String(wallet.todayJobs)], ["7 days", money(wallet.week)]].map(([label, value]) => (
            <View key={label} style={[d.chip, { backgroundColor: P.white }]}>
              <Text style={[d.chipValue, { fontSize: 14 }]}>{value}</Text>
              <Text style={d.chipLabel}>{label}</Text>
            </View>
          ))}
        </View>
        <Text style={d.muted}>Paid out so far: {money(wallet.paidOut)}</Text>
      </Card>
      <Card>
        <Text style={d.h2}>Rate card</Text>
        {Object.entries(wallet.rates).map(([kind, rate]) => (
          <View key={kind} style={d.between}><Text style={[d.body, { textTransform: "capitalize" }]}>{kind === "obd" ? "Open-box delivery" : kind}</Text><Text style={d.body}>{money(rate)}</Text></View>
        ))}
        {Object.keys(wallet.surge).length ? <Text style={d.muted}>Surge shifts: {Object.entries(wallet.surge).map(([id, m]) => `${id} ×${m}`).join(", ")}</Text> : null}
      </Card>
      <Card>
        <Text style={d.h2}>Transactions</Text>
        {wallet.transactions.length ? null : <Text style={d.muted}>No earnings yet.</Text>}
        {wallet.transactions.map((t) => (
          <View key={t.id} style={[d.between, { paddingVertical: 8, borderTopWidth: 1, borderTopColor: P.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={d.body}>{t.note}</Text>
              <Text style={d.muted}>{new Date(t.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · {t.id}</Text>
            </View>
            <Text style={[d.h2, { color: t.amount < 0 ? P.red : t.type === "surge" ? P.amber : P.green }]}>{t.amount < 0 ? "−" : "+"}{money(Math.abs(t.amount))}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}
