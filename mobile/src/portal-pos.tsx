import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  Vibration,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import {
  createPosOrder,
  fetchPortalOrders,
  fetchPosCatalog,
  formatINR,
  formatShortDate,
  posEdcStart,
  posEdcStatus,
  posRazorpayLink,
  posRazorpayLinkCheck,
  posRazorpayStart,
  sendBalanceReminder,
  type PortalOrder,
  type PortalSession,
  type PosBook,
  type PosCustomer,
  type PosOrderSettings,
} from "./portal-api";
import {
  ActionButton,
  BarcodeScannerModal,
  EmptyBox,
  OrderDetailModal,
  P,
  PortalTabBar,
  PortalTopBar,
  SectionHeader,
  StatusPill,
  statusTone,
  styles,
} from "./portal-ui";
import { RAZORPAY_DESKTOP_SPOOF_JS, razorpayUpiQrPage } from "./razorpay";

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const PAYMENT_METHODS = [
  { id: "Razorpay UPI", label: "Razorpay UPI QR", icon: "qr-code-outline" },
  { id: "Cash at Store", label: "Cash", icon: "cash-outline" },
  { id: "Razorpay EDC", label: "Razorpay EDC", icon: "card-outline" },
  { id: "Paytm EDC", label: "Paytm EDC", icon: "phone-portrait-outline" },
  { id: "Razorpay Pay Link", label: "Pay Link", icon: "link-outline" },
];

type CartLine = { book: PosBook; quantity: number; unitPrice: number };

function unitPriceOf(book: PosBook) {
  if (book.offer?.active && Number(book.offer.price) > 0) return Number(book.offer.price);
  return Math.max(0, Number(book.price || 0));
}

function bookIsPreorder(book: PosBook) {
  if (book.isPreorderable) return true;
  const enabled = typeof book.preorder === "object" ? Boolean(book.preorder?.enabled) : Boolean(book.preorder);
  const purchasable = book.stockStatus !== "out_of_stock" && Number(book.stock ?? 0) > 0;
  return enabled && !purchasable;
}

function calcPreorderAdvance(total: number, copies: number, settings?: PosOrderSettings) {
  if (total <= 0) return 0;
  const plan = settings?.preorderPayment;
  const raw = Number(plan?.advanceValue);
  const part =
    plan?.advanceType === "amount"
      ? Math.max(1, Number.isFinite(raw) ? raw : 100) * Math.max(1, Math.floor(copies || 1))
      : Math.round((total * (Number.isFinite(raw) ? Math.min(99, Math.max(1, raw)) : 50)) / 100);
  return Math.min(total, Math.max(1, Math.round(part * 100) / 100));
}

export function PosAppShell({ session, onSignOut }: { session: PortalSession; onSignOut: () => void }) {
  const [tab, setTab] = useState("counter");
  const [refreshing, setRefreshing] = useState(false);
  const [books, setBooks] = useState<PosBook[]>([]);
  const [customers, setCustomers] = useState<PosCustomer[]>([]);
  const [orderSettings, setOrderSettings] = useState<PosOrderSettings | undefined>(undefined);
  const [edcConfigured, setEdcConfigured] = useState(false);
  const [sales, setSales] = useState<PortalOrder[]>([]);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);

  // Order type, fulfillment & partial payment state
  const [orderType, setOrderType] = useState<"normal" | "preorder">("normal");
  const [deliveryMode, setDeliveryMode] = useState<"store_pickup" | "delivery">("store_pickup");
  const [shippingCharge, setShippingCharge] = useState("");
  const [shippingLater, setShippingLater] = useState(true);
  const [payMode, setPayMode] = useState<"full" | "partial">("full");
  const [partialAmount, setPartialAmount] = useState("");
  const [discount, setDiscount] = useState("");

  // Customer & delivery address
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [custQuery, setCustQuery] = useState("");
  const [addrLine1, setAddrLine1] = useState("");
  const [addrLandmark, setAddrLandmark] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("Maharashtra");
  const [addrPincode, setAddrPincode] = useState("");

  // Payment gateway state
  const [paymentMethod, setPaymentMethod] = useState("Razorpay UPI");
  const [paymentRef, setPaymentRef] = useState("");
  const [rzpModal, setRzpModal] = useState<{ html: string; razorpayOrderId: string } | null>(null);
  const [payLinkModal, setPayLinkModal] = useState<{ linkId: string; url: string; amount: number } | null>(null);
  const [edcModal, setEdcModal] = useState<{ razorpayOrderId: string; activityId: string; amount: number } | null>(null);

  // Other UI modals
  const [scannerOpen, setScannerOpen] = useState(false);
  const [receipt, setReceipt] = useState<PortalOrder | null>(null);
  const [detailOrder, setDetailOrder] = useState<PortalOrder | null>(null);
  const [remindingId, setRemindingId] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [cat, posOrders] = await Promise.all([fetchPosCatalog(), fetchPortalOrders("pos")]);
      setBooks(cat.books);
      setCustomers(cat.customers);
      setOrderSettings(cat.orderSettings);
      setEdcConfigured(Boolean(cat.razorpayEdcConfigured));
      setSales(posOrders.orders);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, []);

  const addToCart = (book: PosBook) => {
    const pre = bookIsPreorder(book);
    if (pre) {
      setOrderType("preorder");
      setPayMode("partial");
    }
    setCart((prev) => {
      const existing = prev.find((l) => l.book.id === book.id);
      if (existing) {
        return prev.map((l) => (l.book.id === book.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { book, quantity: 1, unitPrice: unitPriceOf(book) }];
    });
    Vibration.vibrate(35);
    setToast(`Added ${book.title}${pre ? " (Pre-order)" : ""}`);
  };

  const setQty = (bookId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.book.id === bookId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  };

  const onBarcodeScan = (raw: string) => {
    setScannerOpen(false);
    const code = raw.trim().toLowerCase();
    const match = books.find((b) =>
      [b.id, b.sku, b.isbn, b.barcode]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase() === code || code.includes(String(v).toLowerCase()))
    );
    if (match) addToCart(match);
    else setToast(`No publication matched barcode "${raw}".`);
  };

  const filteredBooks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return books;
    return books.filter((b) =>
      [b.title, b.author, b.language, b.sku, b.isbn].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [books, query]);

  const filteredCustomers = useMemo(() => {
    const q = custQuery.trim().toLowerCase();
    if (!q) return [];
    return customers
      .filter((c) => [c.name, c.phone, c.email].some((v) => v.toLowerCase().includes(q)))
      .slice(0, 5);
  }, [customers, custQuery]);

  const itemCount = cart.reduce((s, l) => s + l.quantity, 0);
  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const discountNum = Math.max(0, Math.min(subtotal, Number(discount) || 0));
  const shippingNum =
    deliveryMode === "delivery" && !shippingLater ? Math.max(0, Math.round(Number(shippingCharge) || 0)) : 0;
  const total = Math.max(0, Math.round((subtotal - discountNum + shippingNum) * 100) / 100);
  const suggestedAdvance = calcPreorderAdvance(total, itemCount, orderSettings);

  useEffect(() => {
    if (orderType === "preorder" && payMode === "partial" && !partialAmount && suggestedAdvance > 0) {
      setPartialAmount(String(suggestedAdvance));
    }
  }, [orderType, payMode, suggestedAdvance]);

  const parsedPartial = Math.round(Number(partialAmount || suggestedAdvance) * 100) / 100;
  const payNow =
    payMode === "partial" && total > 0
      ? Math.max(1, Math.min(total, Number.isFinite(parsedPartial) && parsedPartial > 0 ? parsedPartial : suggestedAdvance))
      : total;
  const balanceLater = Math.max(0, Math.round((total - payNow) * 100) / 100);

  const resetBill = () => {
    setCart([]);
    setDiscount("");
    setShippingCharge("");
    setPaymentRef("");
    setPartialAmount("");
    setOrderType("normal");
    setDeliveryMode("store_pickup");
    setPayMode("full");
    setCustomerName("Walk-in Customer");
    setCustomerPhone("");
    setCustomerEmail("");
    setAddrLine1("");
    setAddrLandmark("");
    setAddrCity("");
    setAddrPincode("");
  };

  const buildOrderPayload = (extra: Record<string, unknown> = {}) => ({
    items: cart.map((l) => ({ bookId: l.book.id, quantity: l.quantity, price: l.unitPrice })),
    orderType,
    deliveryMode,
    address:
      deliveryMode === "delivery"
        ? {
            line1: addrLine1.trim(),
            landmark: addrLandmark.trim() || undefined,
            city: addrCity.trim(),
            state: addrState.trim(),
            pincode: addrPincode.trim(),
          }
        : undefined,
    shipping: shippingNum,
    shippingDue: deliveryMode === "delivery" && shippingLater,
    discount: discountNum,
    payNow,
    paymentMethod,
    paymentRef: paymentRef.trim() || undefined,
    customerName: customerName.trim() || "Walk-in Customer",
    customerPhone: customerPhone.trim() || undefined,
    customerEmail: customerEmail.trim() || undefined,
    ...extra,
  });

  const finalizeOrder = async (extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      const res = await createPosOrder(buildOrderPayload(extra) as Parameters<typeof createPosOrder>[0]);
      Vibration.vibrate(80);
      resetBill();
      setPayLinkModal(null);
      setEdcModal(null);
      setRzpModal(null);
      setReceipt(res.order);
      setSales((prev) => [res.order, ...prev]);
    } catch (e) {
      Alert.alert("Could not record sale", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const validateBeforePay = () => {
    if (!cart.length) {
      Alert.alert("Empty bill", "Add publications from Counter first.");
      return false;
    }
    if (orderType === "preorder" && !customerPhone.trim()) {
      Alert.alert("Customer mobile needed", "Enter the customer's mobile number so we can send pre-order balance updates & reminders.");
      return false;
    }
    if (deliveryMode === "delivery" && (!addrLine1.trim() || !addrCity.trim() || !/^\d{6}$/.test(addrPincode.trim()))) {
      Alert.alert("Delivery address required", "Enter full address, city, and 6-digit PIN code for home delivery.");
      return false;
    }
    return true;
  };

  const startCheckout = async () => {
    if (!validateBeforePay()) return;

    // 1. Live Razorpay Dynamic UPI Amount QR (customer scans directly with GPay/PhonePe/Paytm)
    if (paymentMethod === "Razorpay UPI") {
      setBusy(true);
      try {
        const started = await posRazorpayStart({ amount: payNow });
        const options = {
          key: started.keyId,
          orderId: started.razorpayOrderId,
          amount: Math.round(payNow * 100),
          name: customerName.trim() || "Walk-in Customer",
          email: customerEmail.trim(),
          phone: customerPhone.trim(),
          description: `${orderType === "preorder" ? "VGMF Pre-order Advance" : "VGMF Store POS"} ${started.receipt}`,
        };
        setRzpModal({ html: razorpayUpiQrPage(options), razorpayOrderId: started.razorpayOrderId });
      } catch (e) {
        Alert.alert("Razorpay Error", (e as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }

    // 2. Live Razorpay Payment Link + Scannable QR
    if (paymentMethod === "Razorpay Pay Link") {
      setBusy(true);
      try {
        const link = await posRazorpayLink({
          amount: payNow,
          customerName: customerName.trim() || "Walk-in Customer",
          customerPhone: customerPhone.trim() || undefined,
          customerEmail: customerEmail.trim() || undefined,
          description: `${orderType === "preorder" ? "Pre-order Advance" : "Store POS"} · VGMF`,
        });
        setPayLinkModal({ linkId: link.linkId, url: link.url, amount: payNow });
      } catch (e) {
        Alert.alert("Payment Link Error", (e as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }

    // 3. Razorpay EDC Machine (live push if configured, else manual slip ref)
    if (paymentMethod === "Razorpay EDC" && edcConfigured && !paymentRef.trim()) {
      setBusy(true);
      try {
        const edc = await posEdcStart({
          amount: payNow,
          customerName: customerName.trim() || "Walk-in Customer",
          customerPhone: customerPhone.trim() || undefined,
          customerEmail: customerEmail.trim() || undefined,
          edcMethod: "card",
        });
        setEdcModal({ razorpayOrderId: edc.razorpayOrderId, activityId: edc.activityId, amount: payNow });
      } catch (e) {
        Alert.alert("EDC Terminal Error", `${(e as Error).message}\n\nYou can also enter the EDC slip reference manually below.`);
      } finally {
        setBusy(false);
      }
      return;
    }

    // 4. Cash at Store / Paytm EDC / Manual EDC slip ref
    await finalizeOrder();
  };

  const handleRazorpayMessage = async (event: WebViewMessageEvent, fallbackOrderId?: string) => {
    const rzpOrderId = fallbackOrderId || rzpModal?.razorpayOrderId || "";
    setRzpModal(null);
    let msg: { type?: string; paymentId?: string; razorpayOrderId?: string; signature?: string; error?: string } = {};
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      msg = { type: "error" };
    }
    if (msg.type !== "success") {
      setToast(msg.type === "dismiss" ? "Razorpay cancelled — sale was not recorded." : msg.error || "Payment failed.");
      return;
    }
    await finalizeOrder({
      razorpayOrderId: msg.razorpayOrderId || rzpOrderId,
      razorpayPaymentId: msg.paymentId,
      razorpaySignature: msg.signature,
      paymentRef: msg.paymentId,
    });
  };

  const verifyPayLinkAndComplete = async () => {
    if (!payLinkModal) return;
    setBusy(true);
    try {
      const check = await posRazorpayLinkCheck(payLinkModal.linkId);
      if (!check.paid) {
        Alert.alert("Payment pending", "Customer has not completed payment on this Razorpay link yet. Please try again in a moment.");
        setBusy(false);
        return;
      }
      await finalizeOrder({ paymentLinkId: payLinkModal.linkId, paymentRef: check.paymentId || payLinkModal.linkId });
    } catch (e) {
      Alert.alert("Verification failed", (e as Error).message);
      setBusy(false);
    }
  };

  const verifyEdcAndComplete = async () => {
    if (!edcModal) return;
    setBusy(true);
    try {
      const check = await posEdcStatus({ razorpayOrderId: edcModal.razorpayOrderId, activityId: edcModal.activityId });
      if (check.failed) {
        Alert.alert("EDC Declined", check.error || "Payment failed on the EDC terminal.");
        setEdcModal(null);
        setBusy(false);
        return;
      }
      if (!check.paid) {
        Alert.alert("Waiting on EDC", "Ask the customer to tap/swipe card or scan UPI QR on the Razorpay EDC machine, then tap Check Status again.");
        setBusy(false);
        return;
      }
      await finalizeOrder({
        razorpayOrderId: edcModal.razorpayOrderId,
        razorpayPaymentId: check.paymentId,
        paymentRef: check.paymentId || edcModal.razorpayOrderId,
      });
    } catch (e) {
      Alert.alert("EDC Check Error", (e as Error).message);
      setBusy(false);
    }
  };

  const shareReceipt = async (order: PortalOrder) => {
    const isPre = Boolean(order.preorderPayment) || order.items.some((i) => i.preorder);
    const lines = [
      `Vaidya Gogate Memorial Foundation — ${isPre ? "Pre-order Advance Receipt" : "Store Receipt"}`,
      `Order #${order.id}`,
      `Date: ${formatShortDate(order.date)}`,
      `Customer: ${order.deliveryAddress?.fullName || "Walk-in Customer"}`,
      "",
      ...order.items.map((i) => `• ${i.title} × ${i.quantity} = ${formatINR(i.price * i.quantity)}`),
      "",
      `Order Total: ${formatINR(order.total)}`,
      `Paid Now: ${formatINR(order.amountPaid ?? order.total)} (${order.paymentMethod || "Store POS"})`,
      order.balanceDue > 0 ? `Remaining Balance Due: ${formatINR(order.balanceDue)}${order.preorderPayment?.shippingDue ? " + courier charge when packed" : ""}` : "",
      "Thank you for visiting Vaidya Gogate Memorial Foundation!",
    ]
      .filter(Boolean)
      .join("\n");
    await Share.share({ message: lines });
  };

  const remindSaleBalance = async (order: PortalOrder) => {
    setRemindingId(order.id);
    try {
      const res = await sendBalanceReminder({ orderId: order.id, channels: ["whatsapp", "email"] });
      setToast(
        res.alreadyPaid
          ? `#${order.id} already paid!`
          : `Fresh 2-day balance link sent for #${order.id} (WA: ${res.whatsapp}, Email: ${res.email})`
      );
      await loadAll();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setRemindingId("");
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySales = sales.filter((s) => String(s.date || "").slice(0, 10) === todayStr);
  const todayCollected = todaySales.reduce((sum, s) => sum + Number(s.amountPaid ?? s.total ?? 0), 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.white }} edges={["top"]}>
      <PortalTopBar
        title="Store POS"
        subtitle={`${session.name} · Normal, Pre-order & Razorpay`}
        accent={P.brand}
        refreshing={refreshing}
        onRefresh={() => void loadAll()}
        rightAction={
          <Pressable
            onPress={() => setScannerOpen(true)}
            style={[styles.iconBtn, { backgroundColor: P.brandSoft, borderColor: "#F5D0D5" }]}
          >
            <Ionicons name="barcode-outline" size={20} color={P.brand} />
          </Pressable>
        }
      />

      {toast ? (
        <Pressable
          onPress={() => setToast("")}
          style={{ backgroundColor: P.greenSoft, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#A7F3D0", flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          <Ionicons name="checkmark-circle" size={16} color={P.green} />
          <Text style={{ flex: 1, fontSize: 12.5, fontWeight: "600", color: P.green }}>{toast}</Text>
          <Ionicons name="close" size={15} color={P.green} />
        </Pressable>
      ) : null}

      <View style={{ flex: 1, backgroundColor: P.bg }}>
        {tab === "counter" ? (
          <View style={{ flex: 1 }}>
            <View style={{ backgroundColor: P.white, padding: 12, borderBottomWidth: 1, borderBottomColor: P.border, gap: 9 }}>
              {/* Normal vs Pre-order quick mode switch */}
              <View style={{ flexDirection: "row", backgroundColor: "#F3F4F6", borderRadius: 11, padding: 3 }}>
                <Pressable
                  onPress={() => { setOrderType("normal"); setPayMode("full"); }}
                  style={{ flex: 1, paddingVertical: 7, borderRadius: 9, alignItems: "center", backgroundColor: orderType === "normal" ? P.white : "transparent" }}
                >
                  <Text style={{ fontSize: 12.5, fontWeight: "800", color: orderType === "normal" ? P.brand : P.muted }}>Normal Sale</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setOrderType("preorder"); setPayMode("partial"); }}
                  style={{ flex: 1, paddingVertical: 7, borderRadius: 9, alignItems: "center", backgroundColor: orderType === "preorder" ? P.white : "transparent" }}
                >
                  <Text style={{ fontSize: 12.5, fontWeight: "800", color: orderType === "preorder" ? P.amber : P.muted }}>Pre-order (Advance)</Text>
                </Pressable>
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F3F4F6", borderRadius: 11, paddingHorizontal: 11 }}>
                  <Ionicons name="search" size={18} color={P.muted} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search publication, SKU, ISBN…"
                    placeholderTextColor="#9CA3AF"
                    style={{ flex: 1, paddingVertical: 8, fontSize: 14, color: P.ink }}
                  />
                </View>
                <Pressable
                  onPress={() => setScannerOpen(true)}
                  style={[styles.iconBtn, { width: 42, height: 40, backgroundColor: P.brandSoft, borderColor: "#F5D0D5" }]}
                >
                  <Ionicons name="camera-outline" size={20} color={P.brand} />
                </Pressable>
              </View>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: itemCount > 0 ? 84 : 24 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadAll()} tintColor={P.brand} />}
            >
              {filteredBooks.length ? (
                filteredBooks.map((book) => {
                  const price = unitPriceOf(book);
                  const inCart = cart.find((c) => c.book.id === book.id);
                  const img = book.image || book.coverImage;
                  const pre = bookIsPreorder(book);
                  return (
                    <View key={book.id} style={styles.orderCard}>
                      <View style={{ flexDirection: "row", gap: 12 }}>
                        {img ? (
                          <Image
                            source={{ uri: img.startsWith("http") ? img : `https://vaidyagogate.org${img}` }}
                            style={{ width: 58, height: 74, borderRadius: 10, backgroundColor: "#F3F4F6" }}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={{ width: 58, height: 74, borderRadius: 10, backgroundColor: P.brandSoft, alignItems: "center", justifyContent: "center" }}>
                            <Ionicons name="book-outline" size={24} color={P.brand} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <View style={styles.rowBetween}>
                            <Text style={[styles.bodyStrong, { flex: 1 }]} numberOfLines={2}>{book.title}</Text>
                            {pre ? <StatusPill label="PRE-ORDER" tone="amber" /> : null}
                          </View>
                          <Text style={styles.bodyMuted} numberOfLines={1}>
                            {book.language ? `${book.language} · ` : ""}{book.sku ? `SKU ${book.sku}` : "VGMF Edition"}
                          </Text>
                          <View style={[styles.rowBetween, { marginTop: 8 }]}>
                            <View>
                              <Text style={styles.orderTotal}>{formatINR(price)}</Text>
                              <Text style={styles.orderDate}>{pre ? "Pre-order booking" : `Stock: ${book.stock ?? "—"}`}</Text>
                            </View>
                            {inCart ? (
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.brandSoft, borderRadius: 10, padding: 4 }}>
                                <Pressable onPress={() => setQty(book.id, -1)} style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: P.white, alignItems: "center", justifyContent: "center" }}>
                                  <Ionicons name="remove" size={16} color={P.brand} />
                                </Pressable>
                                <Text style={{ fontSize: 14, fontWeight: "800", color: P.brand, minWidth: 18, textAlign: "center" }}>{inCart.quantity}</Text>
                                <Pressable onPress={() => setQty(book.id, 1)} style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: P.brand, alignItems: "center", justifyContent: "center" }}>
                                  <Ionicons name="add" size={16} color={P.white} />
                                </Pressable>
                              </View>
                            ) : (
                              <ActionButton compact icon="add" label={pre ? "Pre-book" : "Add"} onPress={() => addToCart(book)} />
                            )}
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })
              ) : (
                <EmptyBox icon="book-outline" title="No publications found" subtitle="Pull down to refresh live catalogue." />
              )}
            </ScrollView>

            {itemCount > 0 ? (
              <Pressable
                onPress={() => setTab("bill")}
                style={{
                  position: "absolute",
                  left: 12,
                  right: 12,
                  bottom: 12,
                  backgroundColor: orderType === "preorder" ? P.amber : P.brand,
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 13,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  elevation: 4,
                }}
              >
                <View>
                  <Text style={{ color: P.white, fontSize: 14, fontWeight: "800" }}>
                    {itemCount} item{itemCount === 1 ? "" : "s"} · {orderType === "preorder" ? `Pay Now ${formatINR(payNow)}` : formatINR(total)}
                  </Text>
                  <Text style={{ color: "#FFFBEB", fontSize: 11.5 }}>
                    {orderType === "preorder" && balanceLater > 0
                      ? `Pre-order · Balance ${formatINR(balanceLater)} due later`
                      : "Tap to collect Razorpay UPI / Cash / EDC"}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={{ color: P.white, fontWeight: "800", fontSize: 13.5 }}>Bill</Text>
                  <Ionicons name="arrow-forward" size={16} color={P.white} />
                </View>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {tab === "bill" ? (
          <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
            <SectionHeader
              title={orderType === "preorder" ? "Pre-order Advance Bill" : "Counter Sale Bill"}
              subtitle={itemCount ? `${itemCount} item(s) · ${orderType === "preorder" ? "Stays in Orders until ready to pack" : "Live POS checkout"}` : "No items added yet"}
              actionLabel={cart.length ? "Clear" : undefined}
              onAction={cart.length ? resetBill : undefined}
            />

            {cart.length ? (
              <>
                {/* Order Type & Fulfillment Mode */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Sale Type &amp; Delivery</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      onPress={() => { setOrderType("normal"); setPayMode("full"); }}
                      style={{ flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, alignItems: "center", borderColor: orderType === "normal" ? P.brand : P.border, backgroundColor: orderType === "normal" ? P.brandSoft : P.white }}
                    >
                      <Text style={{ fontSize: 12.5, fontWeight: "800", color: orderType === "normal" ? P.brand : P.ink }}>Normal Order</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => { setOrderType("preorder"); setPayMode("partial"); }}
                      style={{ flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, alignItems: "center", borderColor: orderType === "preorder" ? P.amber : P.border, backgroundColor: orderType === "preorder" ? P.amberSoft : P.white }}
                    >
                      <Text style={{ fontSize: 12.5, fontWeight: "800", color: orderType === "preorder" ? P.amber : P.ink }}>Pre-order</Text>
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <Pressable
                      onPress={() => setDeliveryMode("store_pickup")}
                      style={{ flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: "center", borderColor: deliveryMode === "store_pickup" ? P.green : P.border, backgroundColor: deliveryMode === "store_pickup" ? P.greenSoft : P.white }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: deliveryMode === "store_pickup" ? P.green : P.muted }}>Store Pickup</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setDeliveryMode("delivery")}
                      style={{ flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: "center", borderColor: deliveryMode === "delivery" ? P.blue : P.border, backgroundColor: deliveryMode === "delivery" ? P.blueSoft : P.white }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: deliveryMode === "delivery" ? P.blue : P.muted }}>Courier Delivery</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Cart Items & Totals */}
                <View style={styles.card}>
                  {cart.map((line) => (
                    <View key={line.book.id} style={styles.lineItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.bodyStrong}>{line.book.title}</Text>
                        <Text style={styles.bodyMuted}>{formatINR(line.unitPrice)} × {line.quantity}</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Pressable onPress={() => setQty(line.book.id, -1)} style={styles.iconBtn}>
                          <Ionicons name="remove" size={16} color={P.ink} />
                        </Pressable>
                        <Text style={styles.bodyStrong}>{line.quantity}</Text>
                        <Pressable onPress={() => setQty(line.book.id, 1)} style={styles.iconBtn}>
                          <Ionicons name="add" size={16} color={P.ink} />
                        </Pressable>
                      </View>
                      <Text style={[styles.bodyStrong, { minWidth: 62, textAlign: "right" }]}>
                        {formatINR(line.unitPrice * line.quantity)}
                      </Text>
                    </View>
                  ))}
                  <View style={{ marginTop: 10, gap: 6 }}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.bodyMuted}>Subtotal</Text>
                      <Text style={styles.bodyStrong}>{formatINR(subtotal)}</Text>
                    </View>
                    <View style={[styles.rowBetween, { alignItems: "center" }]}>
                      <Text style={styles.bodyMuted}>Counter Discount (₹)</Text>
                      <TextInput
                        value={discount}
                        onChangeText={setDiscount}
                        placeholder="0"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        style={[styles.input, { width: 96, paddingVertical: 6, textAlign: "right" }]}
                      />
                    </View>
                    {deliveryMode === "delivery" ? (
                      <View style={{ gap: 6 }}>
                        <Pressable onPress={() => setShippingLater((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
                          <Ionicons name={shippingLater ? "checkbox" : "square-outline"} size={20} color={P.amber} />
                          <Text style={styles.bodyStrong}>Add courier charge later when packed</Text>
                        </Pressable>
                        {!shippingLater ? (
                          <View style={[styles.rowBetween, { alignItems: "center" }]}>
                            <Text style={styles.bodyMuted}>Shipping Charge (₹)</Text>
                            <TextInput
                              value={shippingCharge}
                              onChangeText={setShippingCharge}
                              placeholder="0"
                              placeholderTextColor="#9CA3AF"
                              keyboardType="numeric"
                              style={[styles.input, { width: 96, paddingVertical: 6, textAlign: "right" }]}
                            />
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                    <View style={[styles.rowBetween, { paddingTop: 8, borderTopWidth: 1, borderTopColor: P.border }]}>
                      <Text style={styles.modalTitle}>Order Total</Text>
                      <Text style={[styles.modalTitle, { color: P.ink }]}>{formatINR(total)}</Text>
                    </View>
                  </View>
                </View>

                {/* Full vs Partial / Pre-order Advance Payment */}
                <View style={orderType === "preorder" || payMode === "partial" ? styles.balanceCard : styles.card}>
                  <Text style={styles.cardTitle}>Payment Amount (Full or Partial / Pre-order Advance)</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      onPress={() => setPayMode("full")}
                      style={{ flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: "center", borderColor: payMode === "full" ? P.green : P.border, backgroundColor: payMode === "full" ? P.greenSoft : P.white }}
                    >
                      <Text style={{ fontSize: 12.5, fontWeight: "700", color: payMode === "full" ? P.green : P.ink }}>Full ({formatINR(total)})</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => { setPayMode("partial"); if (!partialAmount) setPartialAmount(String(suggestedAdvance)); }}
                      style={{ flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: "center", borderColor: payMode === "partial" ? P.amber : P.border, backgroundColor: payMode === "partial" ? P.amberSoft : P.white }}
                    >
                      <Text style={{ fontSize: 12.5, fontWeight: "700", color: payMode === "partial" ? P.amber : P.ink }}>Partial / Advance</Text>
                    </Pressable>
                  </View>

                  {payMode === "partial" ? (
                    <View style={{ marginTop: 10, gap: 8 }}>
                      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                        <Pressable onPress={() => setPartialAmount(String(suggestedAdvance))} style={[styles.stageChip, { backgroundColor: P.white }]}>
                          <Text style={styles.stageChipText}>Advance ({formatINR(suggestedAdvance)})</Text>
                        </Pressable>
                        <Pressable onPress={() => setPartialAmount(String(Math.round(total * 0.5)))} style={[styles.stageChip, { backgroundColor: P.white }]}>
                          <Text style={styles.stageChipText}>50% ({formatINR(Math.round(total * 0.5))})</Text>
                        </Pressable>
                      </View>
                      <Text style={styles.inputLabel}>Amount Collecting Now (₹)</Text>
                      <TextInput
                        value={partialAmount}
                        onChangeText={setPartialAmount}
                        placeholder={String(suggestedAdvance)}
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        style={[styles.input, { fontSize: 17, fontWeight: "800" }]}
                      />
                      <View style={styles.rowBetween}>
                        <Text style={styles.bodyMuted}>Paying Now</Text>
                        <Text style={[styles.orderTotal, { color: P.green }]}>{formatINR(payNow)}</Text>
                      </View>
                      <View style={styles.rowBetween}>
                        <Text style={styles.bodyMuted}>Remaining Balance Later</Text>
                        <Text style={[styles.orderTotal, { color: P.amber }]}>
                          {formatINR(balanceLater)}{deliveryMode === "delivery" && shippingLater ? " + courier" : ""}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>

                {/* Customer Details & Delivery Address */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Customer Details</Text>
                  <TextInput
                    value={custQuery}
                    onChangeText={setCustQuery}
                    placeholder="Quick search existing customer by phone/name…"
                    placeholderTextColor="#9CA3AF"
                    style={styles.input}
                  />
                  {filteredCustomers.map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => {
                        setCustomerName(c.name);
                        setCustomerPhone(c.phone);
                        setCustomerEmail(c.email);
                        setCustQuery("");
                      }}
                      style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }}
                    >
                      <Text style={styles.bodyStrong}>{c.name}</Text>
                      <Text style={styles.bodyMuted}>{c.phone} · {c.email}</Text>
                    </Pressable>
                  ))}
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <TextInput value={customerName} onChangeText={setCustomerName} style={styles.input} />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Mobile{orderType === "preorder" ? " *" : ""}</Text>
                      <TextInput value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" placeholder="9876543210" placeholderTextColor="#9CA3AF" style={styles.input} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Email</Text>
                      <TextInput value={customerEmail} onChangeText={setCustomerEmail} keyboardType="email-address" autoCapitalize="none" placeholder="receipt@email.com" placeholderTextColor="#9CA3AF" style={styles.input} />
                    </View>
                  </View>

                  {deliveryMode === "delivery" ? (
                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.inputLabel}>Delivery Address *</Text>
                      <TextInput value={addrLine1} onChangeText={setAddrLine1} placeholder="House / Flat / Street" placeholderTextColor="#9CA3AF" style={styles.input} />
                      <Text style={styles.inputLabel}>Landmark (optional)</Text>
                      <TextInput value={addrLandmark} onChangeText={setAddrLandmark} placeholder="Near temple / circle" placeholderTextColor="#9CA3AF" style={styles.input} />
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.inputLabel}>City *</Text>
                          <TextInput value={addrCity} onChangeText={setAddrCity} placeholder="City" placeholderTextColor="#9CA3AF" style={styles.input} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.inputLabel}>PIN Code *</Text>
                          <TextInput value={addrPincode} onChangeText={setAddrPincode} keyboardType="numeric" maxLength={6} placeholder="411030" placeholderTextColor="#9CA3AF" style={styles.input} />
                        </View>
                      </View>
                      <Text style={styles.inputLabel}>State</Text>
                      <TextInput value={addrState} onChangeText={setAddrState} placeholder="Maharashtra" placeholderTextColor="#9CA3AF" style={styles.input} />
                    </View>
                  ) : null}
                </View>

                {/* Payment Mode */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Payment Mode</Text>
                  <View style={styles.chipGrid}>
                    {PAYMENT_METHODS.map((m) => {
                      const active = paymentMethod === m.id;
                      return (
                        <Pressable
                          key={m.id}
                          onPress={() => setPaymentMethod(m.id)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            paddingHorizontal: 11,
                            paddingVertical: 9,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: active ? P.brand : P.border,
                            backgroundColor: active ? P.brandSoft : P.white,
                          }}
                        >
                          <Ionicons name={m.icon as never} size={16} color={active ? P.brand : P.muted} />
                          <Text style={{ fontSize: 12.5, fontWeight: "700", color: active ? P.brand : P.ink }}>{m.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {paymentMethod === "Razorpay UPI" ? (
                    <Text style={[styles.bodyMuted, { marginTop: 8 }]}>
                      Displays the live Razorpay Dynamic UPI QR for {formatINR(payNow)} right on screen (exact amount locked — customer scans directly with GPay, PhonePe, Paytm or BHIM). Auto-confirms once paid.
                    </Text>
                  ) : paymentMethod === "Razorpay Pay Link" ? (
                    <Text style={[styles.bodyMuted, { marginTop: 8 }]}>
                      Creates a shareable Razorpay payment link (for remote WhatsApp/SMS payment) for {formatINR(payNow)}.
                    </Text>
                  ) : paymentMethod !== "Cash at Store" ? (
                    <>
                      <Text style={styles.inputLabel}>UTR / EDC Slip Reference (optional{paymentMethod === "Razorpay EDC" && edcConfigured ? " — leave blank to push live to EDC" : ""})</Text>
                      <TextInput
                        value={paymentRef}
                        onChangeText={setPaymentRef}
                        placeholder="Enter slip / UTR reference"
                        placeholderTextColor="#9CA3AF"
                        style={styles.input}
                      />
                    </>
                  ) : null}
                </View>

                <ActionButton
                  variant={paymentMethod.startsWith("Razorpay") ? "primary" : "green"}
                  icon={paymentMethod === "Razorpay UPI" ? "qr-code" : paymentMethod === "Razorpay Pay Link" ? "link" : "checkmark-circle"}
                  label={
                    paymentMethod === "Razorpay UPI"
                      ? `Show Razorpay UPI QR (${formatINR(payNow)})`
                      : paymentMethod === "Razorpay Pay Link"
                      ? `Create Remote Pay Link (${formatINR(payNow)})`
                      : `Complete ${orderType === "preorder" ? "Pre-order" : "Sale"} · Collect ${formatINR(payNow)}`
                  }
                  loading={busy}
                  onPress={() => void startCheckout()}
                />
              </>
            ) : (
              <EmptyBox icon="receipt-outline" title="No items in bill" subtitle="Tap Add or Pre-book on publications in Counter." />
            )}
          </ScrollView>
        ) : null}

        {tab === "sales" ? (
          <ScrollView
            contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 28 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadAll()} tintColor={P.brand} />}
          >
            <View style={styles.card}>
              <Text style={styles.bodyMuted}>Today&apos;s Counter Collection (Normal + Pre-order Advances)</Text>
              <Text style={[styles.authTitle, { textAlign: "left", color: P.green, marginTop: 4 }]}>{formatINR(todayCollected)}</Text>
              <Text style={styles.bodyMuted}>{todaySales.length} POS order(s) today · {sales.length} recent POS records</Text>
            </View>

            <SectionHeader title="Recent Store POS Orders" subtitle="Tap any order for receipt or send balance reminder" />
            {sales.length ? (
              sales.map((s) => {
                const isPre = Boolean(s.preorderPayment) || s.items.some((i) => i.preorder);
                return (
                  <Pressable key={s.id} onPress={() => setDetailOrder(s)} style={styles.orderCard}>
                    <View style={styles.rowBetween}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={styles.orderId}>#{s.id}</Text>
                        <StatusPill label={isPre ? "Pre-order" : "Normal"} tone={isPre ? "amber" : "green"} />
                      </View>
                      <StatusPill label={s.paymentStatus} tone={statusTone(s.paymentStatus)} />
                    </View>
                    <Text style={styles.orderCustomer}>{s.deliveryAddress?.fullName || "Walk-in Customer"}</Text>
                    <Text style={styles.orderItems}>{s.items.map((i) => `${i.title} × ${i.quantity}`).join(", ")}</Text>
                    <View style={[styles.rowBetween, { marginTop: 8 }]}>
                      <Text style={styles.orderTotal}>
                        {formatINR(s.total)} {s.paymentMethod ? `· ${s.paymentMethod}` : ""}
                      </Text>
                      <Text style={styles.orderDate}>{formatShortDate(s.date)}</Text>
                    </View>
                    {s.balanceDue > 0 ? (
                      <View style={styles.dueStrip}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.dueStripTitle}>Balance due: {formatINR(s.balanceDue)}</Text>
                          <Text style={styles.dueStripSub}>Paid {formatINR(s.amountPaid ?? 0)} · Send link via WA + Email</Text>
                        </View>
                        <ActionButton
                          compact
                          variant="amber"
                          icon="notifications-outline"
                          label={remindingId === s.id ? "Sending…" : "Remind"}
                          loading={remindingId === s.id}
                          onPress={() => void remindSaleBalance(s)}
                        />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })
            ) : (
              <EmptyBox icon="stats-chart-outline" title="No POS sales yet" subtitle="Completed store counter bills appear here." />
            )}
          </ScrollView>
        ) : null}

        {tab === "account" ? (
          <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }}>
            <View style={styles.card}>
              <Text style={styles.modalTitle}>{session.name}</Text>
              <Text style={styles.bodyMuted}>{session.email}</Text>
              <View style={{ alignSelf: "flex-start", marginTop: 6 }}>
                <StatusPill label="STORE POS · RAZORPAY LIVE" tone="brand" />
              </View>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Supported Counter Flows</Text>
              <Text style={styles.bodyMuted}>
                • Normal counter sales &amp; Pre-order partial advance bookings{"\n"}
                • Live Razorpay UPI, Payment Link QR, Razorpay EDC, Paytm EDC &amp; Cash{"\n"}
                • Syncs instantly to vaidyagogate.org Orders &amp; Balance Reminders
              </Text>
            </View>
            <ActionButton variant="outline" icon="log-out-outline" label="Sign Out" onPress={onSignOut} />
          </ScrollView>
        ) : null}
      </View>

      <PortalTabBar
        accent={P.brand}
        active={tab}
        onSelect={setTab}
        tabs={[
          { id: "counter", label: "Counter", icon: "storefront" },
          { id: "bill", label: "Bill", icon: "receipt", badge: itemCount },
          { id: "sales", label: "Sales", icon: "stats-chart" },
          { id: "account", label: "Account", icon: "person-circle" },
        ]}
      />

      <BarcodeScannerModal
        visible={scannerOpen}
        title="Scan Book Barcode / ISBN"
        hint="Scan to immediately add publication to the counter bill"
        onClose={() => setScannerOpen(false)}
        onScanned={onBarcodeScan}
      />

      {/* Live Razorpay Dynamic UPI Amount QR Modal (Desktop UA so Razorpay renders direct UPI QR) */}
      <Modal
        visible={Boolean(rzpModal)}
        animationType="slide"
        onRequestClose={() => void handleRazorpayMessage({ nativeEvent: { data: JSON.stringify({ type: "dismiss" }) } } as WebViewMessageEvent)}
      >
        {rzpModal ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: P.white }} edges={["top", "bottom"]}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => void handleRazorpayMessage({ nativeEvent: { data: JSON.stringify({ type: "dismiss" }) } } as WebViewMessageEvent)} style={styles.iconBtn}>
                <Ionicons name="close" size={21} color={P.ink} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Razorpay UPI QR · {formatINR(payNow)}</Text>
                <Text style={styles.topSub}>Customer scans QR with GPay, PhonePe, Paytm or BHIM</Text>
              </View>
              <StatusPill label="EXACT AMT" tone="green" />
            </View>
            <WebView
              originWhitelist={["*"]}
              source={{ html: rzpModal.html, baseUrl: "https://vaidyagogate.org" }}
              userAgent={DESKTOP_UA}
              injectedJavaScriptBeforeContentLoaded={RAZORPAY_DESKTOP_SPOOF_JS}
              injectedJavaScriptBeforeContentLoadedForMainFrameOnly={false}
              scalesPageToFit
              onMessage={(ev) => void handleRazorpayMessage(ev)}
              javaScriptEnabled
              domStorageEnabled
              setSupportMultipleWindows={false}
            />
          </SafeAreaView>
        ) : null}
      </Modal>

      {/* Razorpay Payment Link + QR Modal */}
      <Modal visible={Boolean(payLinkModal)} animationType="slide" onRequestClose={() => setPayLinkModal(null)}>
        {payLinkModal ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top", "bottom"]}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setPayLinkModal(null)} style={styles.iconBtn}>
                <Ionicons name="close" size={21} color={P.ink} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Customer UPI / Pay Link QR</Text>
                <Text style={styles.topSub}>Amount: {formatINR(payLinkModal.amount)}</Text>
              </View>
            </View>
            <ScrollView contentContainerStyle={{ padding: 18, gap: 14, alignItems: "center" }}>
              <View style={[styles.card, { width: "100%", alignItems: "center", paddingVertical: 20 }]}>
                <StatusPill label="SCAN TO PAY VIA UPI / CARD" tone="green" />
                <Text style={[styles.authTitle, { marginTop: 8 }]}>{formatINR(payLinkModal.amount)}</Text>
                <Image
                  source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(payLinkModal.url)}` }}
                  style={{ width: 220, height: 220, marginVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: P.border }}
                />
                <Text style={[styles.bodyStrong, { color: P.brand, textAlign: "center" }]}>{payLinkModal.url}</Text>
                <Text style={[styles.bodyMuted, { textAlign: "center", marginTop: 6 }]}>
                  Ask the customer to scan this QR or open the shared link. Sale records only after Razorpay confirms payment.
                </Text>
              </View>
              <View style={{ width: "100%", gap: 10 }}>
                <ActionButton
                  variant="green"
                  icon="checkmark-done"
                  label="Verify Payment & Complete Sale"
                  loading={busy}
                  onPress={() => void verifyPayLinkAndComplete()}
                />
                <ActionButton
                  variant="outline"
                  icon="share-social-outline"
                  label="Share Payment Link (WhatsApp / SMS)"
                  onPress={() => void Share.share({ message: `Please pay ${formatINR(payLinkModal.amount)} for your Vaidya Gogate Memorial Foundation order: ${payLinkModal.url}` })}
                />
              </View>
            </ScrollView>
          </SafeAreaView>
        ) : null}
      </Modal>

      {/* Razorpay EDC Polling Modal */}
      <Modal visible={Boolean(edcModal)} animationType="slide" onRequestClose={() => setEdcModal(null)}>
        {edcModal ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top", "bottom"]}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setEdcModal(null)} style={styles.iconBtn}>
                <Ionicons name="close" size={21} color={P.ink} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Razorpay EDC Terminal</Text>
                <Text style={styles.topSub}>Amount sent: {formatINR(edcModal.amount)}</Text>
              </View>
            </View>
            <View style={{ padding: 18, gap: 14 }}>
              <View style={[styles.card, { alignItems: "center", paddingVertical: 24 }]}>
                <View style={[styles.kpiIconWrap, { width: 54, height: 54, borderRadius: 27, backgroundColor: P.blueSoft }]}>
                  <Ionicons name="card-outline" size={28} color={P.blue} />
                </View>
                <Text style={styles.authTitle}>{formatINR(edcModal.amount)}</Text>
                <Text style={[styles.bodyMuted, { textAlign: "center", marginTop: 6 }]}>
                  Payment request pushed to the Razorpay EDC machine. Complete card tap or UPI QR on the terminal, then tap Verify.
                </Text>
              </View>
              <ActionButton variant="green" icon="checkmark-circle" label="Check EDC Payment & Complete Sale" loading={busy} onPress={() => void verifyEdcAndComplete()} />
              <ActionButton variant="outline" label="Cancel" onPress={() => setEdcModal(null)} />
            </View>
          </SafeAreaView>
        ) : null}
      </Modal>

      {/* Receipt Modal */}
      <Modal visible={Boolean(receipt)} animationType="slide" onRequestClose={() => setReceipt(null)}>
        {receipt ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top", "bottom"]}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setReceipt(null)} style={styles.iconBtn}>
                <Ionicons name="close" size={21} color={P.ink} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>POS Receipt #{receipt.id}</Text>
                <Text style={styles.topSub}>{formatShortDate(receipt.date)}</Text>
              </View>
              <StatusPill label={receipt.paymentStatus} tone={statusTone(receipt.paymentStatus)} />
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              <View style={[styles.card, { alignItems: "center", paddingVertical: 20 }]}>
                <View style={[styles.kpiIconWrap, { width: 52, height: 52, borderRadius: 26, backgroundColor: P.greenSoft }]}>
                  <Ionicons name="checkmark-circle" size={30} color={P.green} />
                </View>
                <Text style={styles.authTitle}>{formatINR(receipt.amountPaid ?? receipt.total)}</Text>
                <Text style={styles.bodyMuted}>
                  {receipt.balanceDue > 0 ? `Advance Paid · Balance ${formatINR(receipt.balanceDue)} due later` : "Paid in Full"} · {receipt.paymentMethod || "Counter"}
                </Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Vaidya Gogate Memorial Foundation</Text>
                <Text style={styles.bodyMuted}>Customer: {receipt.deliveryAddress?.fullName || "Walk-in Customer"}</Text>
                {receipt.deliveryAddress?.phone ? <Text style={styles.bodyMuted}>Phone: {receipt.deliveryAddress.phone}</Text> : null}
                <View style={{ marginTop: 10 }}>
                  {receipt.items.map((i, idx) => (
                    <View key={idx} style={styles.lineItem}>
                      <Text style={[styles.bodyStrong, { flex: 1 }]}>{i.title} × {i.quantity}</Text>
                      <Text style={styles.bodyStrong}>{formatINR(i.price * i.quantity)}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <ActionButton icon="share-social-outline" label="Share / Print Digital Receipt" onPress={() => void shareReceipt(receipt)} />
              <ActionButton variant="outline" label="New Counter Sale" onPress={() => { setReceipt(null); setTab("counter"); }} />
            </ScrollView>
          </SafeAreaView>
        ) : null}
      </Modal>

      <OrderDetailModal
        order={detailOrder}
        onClose={() => setDetailOrder(null)}
        onUpdated={(next) => {
          setDetailOrder(next);
          setSales((prev) => prev.map((o) => (o.id === next.id ? next : o)));
        }}
        accent={P.brand}
      />
    </SafeAreaView>
  );
}
