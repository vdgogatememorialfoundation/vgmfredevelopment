import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  Vibration,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import {
  fetchPickPackQueue,
  formatINR,
  formatShortDate,
  runPickPackAction,
  scanLookup,
  sendBalanceReminder,
  uploadAwbPhoto,
  type PortalOrder,
  type PortalSession,
  type PosBook,
} from "./portal-api";
import {
  ActionButton,
  BarcodeScannerModal,
  EmptyBox,
  OrderDetailModal,
  P,
  PortalOrderCard,
  PortalTabBar,
  PortalTopBar,
  SectionHeader,
  StatusPill,
  statusTone,
  styles,
} from "./portal-ui";

/** Hidden 1x1 WebView Web Audio synthesizer for crisp success & failure barcode scan beeps. */
const BEEP_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
<script>
var ctx = null;
function ensureCtx() {
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
window.playScanBeep = function(kind) {
  try {
    var c = ensureCtx();
    if (!c) return;
    var now = c.currentTime;
    if (kind === 'ok') {
      // Crisp bright double chime for successful scan
      [[1046.5, 0, 0.09], [1396.9, 0.095, 0.12]].forEach(function(n) {
        var osc = c.createOscillator();
        var g = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n[0], now + n[1]);
        g.gain.setValueAtTime(0.001, now + n[1]);
        g.gain.exponentialRampToValueAtTime(0.45, now + n[1] + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, now + n[1] + n[2]);
        osc.connect(g);
        g.connect(c.destination);
        osc.start(now + n[1]);
        osc.stop(now + n[1] + n[2] + 0.02);
      });
    } else {
      // Distinct low double-buzz for failed / wrong barcode scan
      [[240, 0, 0.16], [175, 0.19, 0.22]].forEach(function(n) {
        var osc = c.createOscillator();
        var g = c.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(n[0], now + n[1]);
        g.gain.setValueAtTime(0.001, now + n[1]);
        g.gain.exponentialRampToValueAtTime(0.4, now + n[1] + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, now + n[1] + n[2]);
        osc.connect(g);
        g.connect(c.destination);
        osc.start(now + n[1]);
        osc.stop(now + n[1] + n[2] + 0.02);
      });
    }
  } catch (e) {}
};
</script></body></html>`;

/** Clean pure-white HTML5 Camera / File Picker for AWB label photo or PDF upload (with auto JPEG compression). */
const AWB_PICKER_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
  *{box-sizing:border-box;font-family:-apple-system,Roboto,sans-serif;}
  body{margin:0;padding:14px;background:#FFFFFF;color:#111827;}
  .grid{display:flex;gap:10px;}
  label{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:18px 10px;border-radius:14px;border:1.5px dashed #067D62;background:#ECFDF5;color:#067D62;font-weight:700;font-size:13px;text-align:center;cursor:pointer;}
  label.alt{border-color:#D1D5DB;background:#F9FAFB;color:#111827;}
  input{display:none;}
  .prev{margin-top:12px;text-align:center;}
  img{max-width:100%;max-height:220px;border-radius:12px;border:1px solid #E5E7EB;}
  .status{margin-top:8px;font-size:12px;color:#4B5563;font-weight:600;}
</style></head><body>
<div class="grid">
  <label>
    <span style="font-size:22px">📷</span>
    <span>Take AWB Photo</span>
    <input id="cam" type="file" accept="image/*" capture="environment" />
  </label>
  <label class="alt">
    <span style="font-size:22px">📄</span>
    <span>Choose Image / PDF</span>
    <input id="file" type="file" accept="image/*,application/pdf" />
  </label>
</div>
<div class="prev" id="prev"></div>
<script>
function handleFile(file) {
  if (!file) return;
  var prev = document.getElementById('prev');
  prev.innerHTML = '<div class="status">Preparing ' + file.name + '…</div>';
  if (file.type && file.type.indexOf('image/') === 0) {
    var reader = new FileReader();
    reader.onload = function(ev) {
      var img = new Image();
      img.onload = function() {
        var max = 1400;
        var w = img.width, h = img.height;
        if (w > max || h > max) {
          if (w > h) { h = Math.round(h * max / w); w = max; }
          else { w = Math.round(w * max / h); h = max; }
        }
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        var dataUrl = c.toDataURL('image/jpeg', 0.82);
        prev.innerHTML = '<img src="' + dataUrl + '"/><div class="status">Ready to upload (' + Math.round(dataUrl.length * 0.75 / 1024) + ' KB)</div>';
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ dataUrl: dataUrl, filename: file.name || 'awb-label.jpg' }));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  } else {
    var r2 = new FileReader();
    r2.onload = function(ev) {
      var dataUrl = ev.target.result;
      prev.innerHTML = '<div class="status">PDF ready: ' + file.name + '</div>';
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ dataUrl: dataUrl, filename: file.name || 'awb-label.pdf' }));
    };
    r2.readAsDataURL(file);
  }
}
document.getElementById('cam').addEventListener('change', function(e){ handleFile(e.target.files[0]); });
document.getElementById('file').addEventListener('change', function(e){ handleFile(e.target.files[0]); });
</script></body></html>`;

export function ScannerAppShell({ session, onSignOut }: { session: PortalSession; onSignOut: () => void }) {
  const [tab, setTab] = useState("pick");
  const [refreshing, setRefreshing] = useState(false);
  const [pickQueue, setPickQueue] = useState<PortalOrder[]>([]);
  const [packQueue, setPackQueue] = useState<PortalOrder[]>([]);
  const [recentlyPacked, setRecentlyPacked] = useState<PortalOrder[]>([]);
  const [activeOrder, setActiveOrder] = useState<PortalOrder | null>(null);
  const [activeMode, setActiveMode] = useState<"pick" | "pack">("pick");
  const [scanInput, setScanInput] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraPurpose, setCameraPurpose] = useState<"work" | "lookup" | "awb">("work");
  const [lookupCode, setLookupCode] = useState("");
  const [lookupResult, setLookupResult] = useState<{ kind: "order" | "book"; order?: PortalOrder; book?: PosBook } | null>(null);
  const [detailOrder, setDetailOrder] = useState<PortalOrder | null>(null);
  const [awbModalOrder, setAwbModalOrder] = useState<PortalOrder | null>(null);
  const [awbNumber, setAwbNumber] = useState("");
  const [awbFile, setAwbFile] = useState<{ dataUrl: string; filename: string } | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [toastTone, setToastTone] = useState<"ok" | "err">("ok");
  const [remindingId, setRemindingId] = useState("");
  const beepRef = useRef<WebView | null>(null);

  const playScanSound = useCallback(
    (tone: "ok" | "err") => {
      if (soundOn) {
        beepRef.current?.injectJavaScript(`window.playScanBeep && window.playScanBeep('${tone}'); true;`);
      }
      Vibration.vibrate(tone === "ok" ? 65 : [0, 120, 60, 140]);
    },
    [soundOn]
  );

  const notify = useCallback(
    (msg: string, tone: "ok" | "err" = "ok", withSound = true) => {
      setToast(msg);
      setToastTone(tone);
      if (withSound) playScanSound(tone);
    },
    [playScanSound]
  );

  const loadQueues = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await fetchPickPackQueue();
      setPickQueue(data.pickQueue);
      setPackQueue(data.packQueue);
      setRecentlyPacked(data.recentlyPacked);
      if (activeOrder) {
        const all = [...data.pickQueue, ...data.packQueue, ...data.recentlyPacked];
        const found = all.find((o) => o.id === activeOrder.id);
        if (found) setActiveOrder(found);
      }
    } catch (e) {
      notify((e as Error).message, "err", false);
    } finally {
      setRefreshing(false);
    }
  }, [activeOrder, notify]);

  useEffect(() => {
    void loadQueues();
  }, []);

  const handleWorkScan = async (code: string, bookId?: string) => {
    if (!activeOrder) return;
    setBusy(true);
    try {
      const sub = activeMode === "pick" ? "pick-scan" : "pack-scan";
      const res = await runPickPackAction({ sub, orderId: activeOrder.id, code: code.trim() || undefined, bookId });
      setActiveOrder(res.order);
      setScanInput("");
      if (res.orderQrMatched) {
        notify(`Order QR #${activeOrder.id} verified! Now scan items into the box.`, "ok");
      } else if (res.allPicked) {
        notify(`All items picked for #${activeOrder.id}! Moved to Pack Queue.`, "ok");
        setActiveOrder(null);
        await loadQueues();
      } else {
        notify(`Scanned OK: ${res.matchedTitle || code}`, "ok");
      }
    } catch (e) {
      notify((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const finishActive = async () => {
    if (!activeOrder) return;
    setBusy(true);
    try {
      const sub = activeMode === "pick" ? "complete-pick" : "complete-pack";
      const res = await runPickPackAction({ sub, orderId: activeOrder.id });
      notify(
        activeMode === "pick"
          ? `Order #${activeOrder.id} picked! Ready in Pack Queue.`
          : `Order #${activeOrder.id} marked PACKED!${res.order.balanceDue > 0 ? ` Balance due: ${formatINR(res.order.balanceDue)}` : ""}`,
        "ok"
      );
      setActiveOrder(null);
      await loadQueues();
    } catch (e) {
      notify((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const runQuickLookup = async (code: string) => {
    const clean = code.trim();
    if (!clean) return;
    setBusy(true);
    try {
      const res = await scanLookup(clean);
      setLookupResult(res);
      setLookupCode(clean);
      notify(res.kind === "order" ? `Matched Order #${res.order?.id}` : `Matched Book: ${res.book?.title}`, "ok");
    } catch (e) {
      setLookupResult(null);
      notify((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const remindPacked = async (order: PortalOrder) => {
    setRemindingId(order.id);
    try {
      const res = await sendBalanceReminder({ orderId: order.id, channels: ["whatsapp", "email"] });
      notify(
        res.alreadyPaid
          ? `#${order.id} is already paid!`
          : `Balance reminder sent for #${order.id} (WA: ${res.whatsapp}, Email: ${res.email})`,
        "ok"
      );
      await loadQueues();
    } catch (e) {
      notify((e as Error).message, "err");
    } finally {
      setRemindingId("");
    }
  };

  const openAwbUpload = (order: PortalOrder) => {
    setAwbModalOrder(order);
    setAwbNumber(order.trackingId || order.shipment?.awb || "");
    setAwbFile(null);
  };

  const submitAwbUpload = async () => {
    if (!awbModalOrder) return;
    if (!awbFile?.dataUrl) {
      notify("Capture or choose an AWB label photo / PDF first.", "err");
      return;
    }
    setBusy(true);
    try {
      const res = await uploadAwbPhoto({
        orderId: awbModalOrder.id,
        dataUrl: awbFile.dataUrl,
        filename: awbFile.filename,
        awb: awbNumber.trim() || undefined,
      });
      notify(`AWB label uploaded for #${awbModalOrder.id}!`, "ok");
      setAwbModalOrder(res.order);
      setAwbFile(null);
      await loadQueues();
    } catch (e) {
      notify((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const renderActiveBench = () => {
    if (!activeOrder) return null;
    const isPick = activeMode === "pick";
    const map = isPick ? activeOrder.pick?.picked ?? {} : activeOrder.pick?.packScan ?? {};
    const totalUnits = activeOrder.items.reduce((s, i) => s + i.quantity, 0);
    const doneUnits = activeOrder.items.reduce((s, i) => s + Math.min(i.quantity, map[i.bookId] || 0), 0);
    const pct = totalUnits > 0 ? Math.round((doneUnits / totalUnits) * 100) : 0;

    return (
      <View style={[styles.card, { borderColor: P.green, borderWidth: 1.5 }]}>
        <View style={styles.rowBetween}>
          <View>
            <StatusPill label={isPick ? "ACTIVE PICK" : "ACTIVE PACK"} tone="green" />
            <Text style={[styles.modalTitle, { marginTop: 4 }]}>Order #{activeOrder.id}</Text>
            <Text style={styles.bodyMuted}>{activeOrder.deliveryAddress?.fullName || "Customer"}</Text>
          </View>
          <Pressable onPress={() => setActiveOrder(null)} style={styles.iconBtn}>
            <Ionicons name="close" size={18} color={P.ink} />
          </Pressable>
        </View>

        <View style={{ marginTop: 12 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.bodyStrong}>{doneUnits} of {totalUnits} item(s) scanned</Text>
            <Text style={[styles.bodyStrong, { color: P.green }]}>{pct}%</Text>
          </View>
          <View style={{ height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, marginTop: 6, overflow: "hidden" }}>
            <View style={{ width: `${pct}%`, height: 8, backgroundColor: P.green, borderRadius: 4 }} />
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <TextInput
            value={scanInput}
            onChangeText={setScanInput}
            placeholder={isPick ? "Scan SKU / ISBN / Barcode…" : "Scan Order QR or Item Barcode…"}
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={() => void handleWorkScan(scanInput)}
            style={[styles.input, { flex: 1, marginTop: 0 }]}
          />
          <Pressable
            onPress={() => { setCameraPurpose("work"); setCameraOpen(true); }}
            style={[styles.iconBtn, { width: 46, height: 46, backgroundColor: P.greenSoft, borderColor: "#A7F3D0" }]}
          >
            <Ionicons name="camera" size={22} color={P.green} />
          </Pressable>
        </View>

        <View style={{ marginTop: 12, gap: 8 }}>
          {activeOrder.items.map((item) => {
            const count = map[item.bookId] || 0;
            const done = count >= item.quantity;
            return (
              <View
                key={item.bookId}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: done ? P.greenSoft : "#F9FAFB",
                  borderWidth: 1,
                  borderColor: done ? "#A7F3D0" : P.border,
                }}
              >
                <Ionicons name={done ? "checkmark-circle" : "ellipse-outline"} size={22} color={done ? P.green : P.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bodyStrong} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.bodyMuted}>
                    {item.sku ? `SKU ${item.sku} · ` : ""}{count}/{item.quantity} scanned
                  </Text>
                </View>
                {!done ? (
                  <ActionButton
                    compact
                    variant="outline"
                    label="+1 Scan"
                    disabled={busy}
                    onPress={() => void handleWorkScan("", item.bookId)}
                  />
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={{ marginTop: 14, gap: 8 }}>
          <ActionButton
            variant="green"
            icon={isPick ? "checkmark-done" : "cube"}
            label={isPick ? "Complete Pick & Send to Packer" : "Seal Box & Mark Packed"}
            loading={busy}
            onPress={() => void finishActive()}
          />
          {!isPick ? (
            <ActionButton
              compact
              variant="outline"
              icon="cloud-upload-outline"
              label={`Upload AWB Label${activeOrder.awbPhotos?.length ? ` (${activeOrder.awbPhotos.length})` : ""}`}
              onPress={() => openAwbUpload(activeOrder)}
            />
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.white }} edges={["top"]}>
      {/* Hidden 1x1 Audio Synth WebView for instant success & error scan beeps */}
      <View style={{ width: 1, height: 1, opacity: 0.01, position: "absolute" }} pointerEvents="none">
        <WebView
          ref={beepRef}
          originWhitelist={["*"]}
          source={{ html: BEEP_HTML }}
          javaScriptEnabled
          mediaPlaybackRequiresUserAction={false}
        />
      </View>

      <PortalTopBar
        title="Picker & Packer"
        subtitle={`${session.name} · Assigned Orders Only`}
        accent={P.green}
        refreshing={refreshing}
        onRefresh={() => void loadQueues()}
        rightAction={
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Pressable
              onPress={() => {
                const next = !soundOn;
                setSoundOn(next);
                if (next) beepRef.current?.injectJavaScript(`window.playScanBeep && window.playScanBeep('ok'); true;`);
              }}
              style={[styles.iconBtn, soundOn && { backgroundColor: P.greenSoft, borderColor: "#A7F3D0" }]}
              accessibilityLabel="Toggle scan beep sound"
            >
              <Ionicons name={soundOn ? "volume-high-outline" : "volume-mute-outline"} size={19} color={soundOn ? P.green : P.muted} />
            </Pressable>
            <Pressable
              onPress={() => { setCameraPurpose(activeOrder ? "work" : "lookup"); setCameraOpen(true); }}
              style={[styles.iconBtn, { backgroundColor: P.greenSoft, borderColor: "#A7F3D0" }]}
            >
              <Ionicons name="qr-code-outline" size={19} color={P.green} />
            </Pressable>
          </View>
        }
      />

      {toast ? (
        <Pressable
          onPress={() => setToast("")}
          style={{
            backgroundColor: toastTone === "ok" ? P.greenSoft : P.redSoft,
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderBottomWidth: 1,
            borderBottomColor: toastTone === "ok" ? "#A7F3D0" : "#FECACA",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Ionicons name={toastTone === "ok" ? "checkmark-circle" : "alert-circle"} size={16} color={toastTone === "ok" ? P.green : P.red} />
          <Text style={{ flex: 1, fontSize: 12.5, fontWeight: "600", color: toastTone === "ok" ? P.green : P.red }}>{toast}</Text>
          <Ionicons name="close" size={16} color={toastTone === "ok" ? P.green : P.red} />
        </Pressable>
      ) : null}

      <View style={{ flex: 1, backgroundColor: P.bg }}>
        {tab === "pick" ? (
          <ScrollView
            contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 28 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadQueues()} tintColor={P.green} />}
          >
            {activeOrder && activeMode === "pick" ? renderActiveBench() : null}

            <SectionHeader
              title={`Assigned Pick Queue (${pickQueue.length})`}
              subtitle="Only orders assigned to pickers appear here (unassigned orders are hidden)"
            />
            {pickQueue.length ? (
              pickQueue.map((o) => (
                <View key={o.id} style={styles.orderCard}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.orderId}>#{o.id}</Text>
                    <StatusPill label={o.status} tone={statusTone(o.status)} />
                  </View>
                  <Text style={styles.orderCustomer}>{o.deliveryAddress?.fullName || "Customer"}</Text>
                  <Text style={styles.orderItems}>{o.items.map((i) => `${i.title} × ${i.quantity}`).join(", ")}</Text>
                  {o.pick?.assignee ? <Text style={[styles.orderDate, { marginTop: 4 }]}>Picker: {o.pick.assignee}</Text> : null}
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                    <View style={{ flex: 1 }}>
                      <ActionButton
                        compact
                        variant="green"
                        icon="barcode-outline"
                        label="Start Picking"
                        onPress={() => { setActiveMode("pick"); setActiveOrder(o); }}
                      />
                    </View>
                    <ActionButton compact variant="outline" icon="cloud-upload-outline" label="AWB" onPress={() => openAwbUpload(o)} />
                    <ActionButton compact variant="outline" label="Details" onPress={() => setDetailOrder(o)} />
                  </View>
                </View>
              ))
            ) : (
              <EmptyBox
                icon="barcode-outline"
                title="No assigned pick orders"
                subtitle="Orders appear here once Admin assigns a picker to them."
              />
            )}
          </ScrollView>
        ) : null}

        {tab === "pack" ? (
          <ScrollView
            contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 28 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadQueues()} tintColor={P.green} />}
          >
            {activeOrder && activeMode === "pack" ? renderActiveBench() : null}

            <SectionHeader
              title={`Assigned Pack Queue (${packQueue.length})`}
              subtitle="Picked orders assigned for box scanning, sealing & AWB label upload"
            />
            {packQueue.length ? (
              packQueue.map((o) => (
                <View key={o.id} style={styles.orderCard}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.orderId}>#{o.id}</Text>
                    <StatusPill label="Picked" tone="blue" />
                  </View>
                  <Text style={styles.orderCustomer}>{o.deliveryAddress?.fullName || "Customer"}</Text>
                  <Text style={styles.orderItems}>{o.items.map((i) => `${i.title} × ${i.quantity}`).join(", ")}</Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                    <View style={{ flex: 1 }}>
                      <ActionButton
                        compact
                        variant="green"
                        icon="cube-outline"
                        label="Scan & Pack Box"
                        onPress={() => { setActiveMode("pack"); setActiveOrder(o); }}
                      />
                    </View>
                    <ActionButton compact variant="outline" icon="cloud-upload-outline" label="AWB" onPress={() => openAwbUpload(o)} />
                    <ActionButton compact variant="outline" label="Details" onPress={() => setDetailOrder(o)} />
                  </View>
                </View>
              ))
            ) : (
              <EmptyBox
                icon="cube-outline"
                title="No assigned pack orders"
                subtitle="Assigned orders appear here automatically once picking completes."
              />
            )}

            <SectionHeader
              title={`Packed Parcels & AWB Upload (${recentlyPacked.length})`}
              subtitle="Upload AWB label photos or send WhatsApp + Email balance reminders"
            />
            {recentlyPacked.map((o) => (
              <View key={o.id} style={{ gap: 6 }}>
                <PortalOrderCard
                  order={o}
                  onPress={() => setDetailOrder(o)}
                  onRemind={o.balanceDue > 0 ? () => void remindPacked(o) : undefined}
                  reminding={remindingId === o.id}
                />
                <View style={{ flexDirection: "row", gap: 8, marginTop: -2, marginBottom: 4 }}>
                  <View style={{ flex: 1 }}>
                    <ActionButton
                      compact
                      variant="outline"
                      icon="cloud-upload-outline"
                      label={
                        o.awbPhotos?.length
                          ? `Upload AWB Label (${o.awbPhotos.length} uploaded)`
                          : "Upload AWB Label Photo / PDF"
                      }
                      onPress={() => openAwbUpload(o)}
                    />
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {tab === "scan" ? (
          <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Universal QR &amp; Barcode Lookup</Text>
              <Text style={styles.bodyMuted}>Scan any Order QR, Courier AWB, Book SKU, or ISBN. Plays distinct success/error tones.</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <TextInput
                  value={lookupCode}
                  onChangeText={setLookupCode}
                  placeholder="Enter or scan code…"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  returnKeyType="search"
                  onSubmitEditing={() => void runQuickLookup(lookupCode)}
                  style={[styles.input, { flex: 1, marginTop: 0 }]}
                />
                <ActionButton compact variant="green" label="Find" loading={busy} onPress={() => void runQuickLookup(lookupCode)} />
              </View>
              <View style={{ marginTop: 10 }}>
                <ActionButton
                  variant="soft"
                  color={P.green}
                  icon="camera-outline"
                  label="Open Camera Barcode / QR Scanner"
                  onPress={() => { setCameraPurpose("lookup"); setCameraOpen(true); }}
                />
              </View>
            </View>

            {lookupResult?.kind === "order" && lookupResult.order ? (
              <View style={{ gap: 8 }}>
                <PortalOrderCard
                  order={lookupResult.order}
                  onPress={() => setDetailOrder(lookupResult.order!)}
                  onRemind={lookupResult.order.balanceDue > 0 ? () => void remindPacked(lookupResult.order!) : undefined}
                  reminding={remindingId === lookupResult.order.id}
                />
                <ActionButton
                  compact
                  variant="outline"
                  icon="cloud-upload-outline"
                  label="Upload AWB Label for This Order"
                  onPress={() => openAwbUpload(lookupResult.order!)}
                />
              </View>
            ) : null}

            {lookupResult?.kind === "book" && lookupResult.book ? (
              <View style={styles.card}>
                <StatusPill label="PUBLICATION MATCH" tone="green" />
                <Text style={[styles.modalTitle, { marginTop: 8 }]}>{lookupResult.book.title}</Text>
                <Text style={styles.bodyMuted}>
                  SKU: {lookupResult.book.sku || "—"} · Price: {formatINR(lookupResult.book.price)} · Stock: {lookupResult.book.stock ?? "—"}
                </Text>
              </View>
            ) : null}
          </ScrollView>
        ) : null}

        {tab === "account" ? (
          <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }}>
            <View style={styles.card}>
              <Text style={styles.modalTitle}>{session.name}</Text>
              <Text style={styles.bodyMuted}>{session.email}</Text>
              <View style={{ alignSelf: "flex-start", marginTop: 6 }}>
                <StatusPill label={`SCANNER · ${session.role.toUpperCase()}`} tone="green" />
              </View>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Scan Audio &amp; Feedback</Text>
              <Text style={styles.bodyMuted}>Test or toggle success chime and error buzz sounds for barcode scanning.</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <ActionButton compact variant="green" icon="checkmark-circle-outline" label="Test OK Beep" onPress={() => playScanSound("ok")} />
                </View>
                <View style={{ flex: 1 }}>
                  <ActionButton compact variant="outline" icon="alert-circle-outline" label="Test Error Beep" onPress={() => playScanSound("err")} />
                </View>
              </View>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Live Assigned Queue</Text>
              <Text style={styles.bodyMuted}>
                Assigned Picks: {pickQueue.length} · Assigned Packs: {packQueue.length} · Packed Parcels: {recentlyPacked.length}
              </Text>
            </View>
            <ActionButton variant="outline" icon="log-out-outline" label="Sign Out" onPress={onSignOut} />
          </ScrollView>
        ) : null}
      </View>

      <PortalTabBar
        accent={P.green}
        active={tab}
        onSelect={setTab}
        tabs={[
          { id: "pick", label: "Pick", icon: "barcode", badge: pickQueue.length },
          { id: "pack", label: "Pack", icon: "cube", badge: packQueue.length },
          { id: "scan", label: "Scan", icon: "qr-code" },
          { id: "account", label: "Account", icon: "person-circle" },
        ]}
      />

      <BarcodeScannerModal
        visible={cameraOpen}
        title={
          cameraPurpose === "awb"
            ? "Scan AWB Barcode"
            : cameraPurpose === "work"
            ? activeMode === "pick"
              ? "Scan Item to Pick"
              : "Scan Order QR / Item to Pack"
            : "Quick Scan Lookup"
        }
        onClose={() => setCameraOpen(false)}
        onScanned={(code) => {
          setCameraOpen(false);
          if (cameraPurpose === "awb") {
            setAwbNumber(code);
            playScanSound("ok");
          } else if (cameraPurpose === "work") {
            void handleWorkScan(code);
          } else {
            void runQuickLookup(code);
          }
        }}
      />

      {/* Upload AWB Label Photo / PDF Modal */}
      <Modal visible={Boolean(awbModalOrder)} animationType="slide" onRequestClose={() => setAwbModalOrder(null)}>
        {awbModalOrder ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top", "bottom"]}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setAwbModalOrder(null)} style={styles.iconBtn}>
                <Ionicons name="close" size={21} color={P.ink} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Upload AWB Label · #{awbModalOrder.id}</Text>
                <Text style={styles.topSub}>{awbModalOrder.deliveryAddress?.fullName || "Customer"}</Text>
              </View>
              <StatusPill label={`${awbModalOrder.awbPhotos?.length || 0} saved`} tone="green" />
            </View>
            <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 28 }}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>AWB / Tracking Number (optional)</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    value={awbNumber}
                    onChangeText={setAwbNumber}
                    placeholder="Scan or type courier AWB number"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="characters"
                    style={[styles.input, { flex: 1, marginTop: 0 }]}
                  />
                  <Pressable
                    onPress={() => { setCameraPurpose("awb"); setCameraOpen(true); }}
                    style={[styles.iconBtn, { width: 44, height: 44, backgroundColor: P.greenSoft, borderColor: "#A7F3D0" }]}
                  >
                    <Ionicons name="barcode-outline" size={20} color={P.green} />
                  </Pressable>
                </View>
              </View>

              <View style={[styles.card, { padding: 0, overflow: "hidden" }]}>
                <View style={{ padding: 14, paddingBottom: 6 }}>
                  <Text style={styles.cardTitle}>Capture or Select AWB Label</Text>
                  <Text style={styles.bodyMuted}>Take a photo of the sealed parcel with AWB label, or pick an image/PDF file.</Text>
                </View>
                <View style={{ height: 310 }}>
                  <WebView
                    originWhitelist={["*"]}
                    source={{ html: AWB_PICKER_HTML, baseUrl: "https://vaidyagogate.org" }}
                    javaScriptEnabled
                    allowFileAccess
                    onMessage={(ev) => {
                      try {
                        const parsed = JSON.parse(ev.nativeEvent.data) as { dataUrl?: string; filename?: string };
                        if (parsed.dataUrl) {
                          setAwbFile({ dataUrl: parsed.dataUrl, filename: parsed.filename || "awb-label.jpg" });
                          playScanSound("ok");
                        }
                      } catch {
                        /* ignore malformed */
                      }
                    }}
                  />
                </View>
              </View>

              <ActionButton
                variant="green"
                icon="cloud-upload"
                label={busy ? "Uploading AWB Label…" : "Save & Upload AWB Label"}
                disabled={!awbFile || busy}
                loading={busy}
                onPress={() => void submitAwbUpload()}
              />

              {awbModalOrder.awbPhotos?.length ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Uploaded AWB Labels ({awbModalOrder.awbPhotos.length})</Text>
                  <View style={{ gap: 10 }}>
                    {awbModalOrder.awbPhotos.map((p, idx) => {
                      const uri = p.url.startsWith("http") ? p.url : `https://vaidyagogate.org${p.url}`;
                      return (
                        <View key={idx} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }}>
                          {p.url.endsWith(".pdf") ? (
                            <View style={{ width: 54, height: 54, borderRadius: 10, backgroundColor: P.brandSoft, alignItems: "center", justifyContent: "center" }}>
                              <Ionicons name="document-text-outline" size={24} color={P.brand} />
                            </View>
                          ) : (
                            <Image source={{ uri }} style={{ width: 54, height: 54, borderRadius: 10, backgroundColor: "#F3F4F6" }} />
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.bodyStrong}>{p.awb ? `AWB ${p.awb}` : `AWB Label #${idx + 1}`}</Text>
                            <Text style={styles.orderDate}>
                              {formatShortDate(p.at)}{p.byName ? ` · ${p.byName}` : ""}
                            </Text>
                          </View>
                          <StatusPill label="Saved" tone="green" />
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </SafeAreaView>
        ) : null}
      </Modal>

      <OrderDetailModal
        order={detailOrder}
        onClose={() => setDetailOrder(null)}
        onUpdated={(next) => {
          setDetailOrder(next);
          void loadQueues();
        }}
        accent={P.green}
      />
    </SafeAreaView>
  );
}
