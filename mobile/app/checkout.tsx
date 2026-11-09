import { razorpayPage } from "../src/razorpay";
import { useEffect, useMemo, useState } from "react";
import { Modal, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { router } from "expo-router";
import { createCheckout, findRow, money, str, verifyCheckout } from "../src/api";
import { useAuth } from "../src/auth";
import { useCart } from "../src/cart";
import { CountryField } from "../src/country-field";
import { useFeed } from "../src/feed";
import { countryByCode, enabledCountries, isIndia, isValidPhone, isValidPostal, statesFor, withDial } from "../src/geo";
import { STORE } from "../src/site-content";
import { Banner, Button, Card, Chip, Field, Heading, Muted, PageHeader, Screen } from "../src/ui";

export default function CheckoutScreen() {
  const cart = useCart();
  const { session } = useAuth();
  const { feed } = useFeed();
  const countries = enabledCountries(feed?.platformCountries);
  const [name, setName] = useState(session?.name || "");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [countryCode, setCountryCode] = useState(countries[0]?.code || "IN");
  const country = countries.find((item) => item.code === countryCode) ?? countryByCode(countryCode);
  const states = statesFor(country.code);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [tone, setTone] = useState<"note" | "error" | "success">("note");
  const [orderId, setOrderId] = useState("");
  const [landmark, setLandmark] = useState("");
  const [pickup, setPickup] = useState(false);
  const [payment, setPayment] = useState<{ html: string; orderId: string } | null>(null);

  useEffect(() => {
    if (!countries.length) return;
    if (countries.some((item) => item.code === countryCode)) return;
    setCountryCode(countries[0].code);
  }, [countries, countryCode]);

  const priced = useMemo(
    () =>
      cart.items.map((item) => {
        const book = findRow(feed?.books, item.id);
        return {
          id: item.id,
          title: str(book?.title, item.title),
          quantity: item.quantity,
          price: Number(book?.price ?? item.price) || 0,
        };
      }),
    [cart.items, feed?.books]
  );
  const subtotal = priced.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const preorder = priced.some((item) => preorderable(findRow(feed?.books, item.id)));
  const shipping = preorder ? 0 : subtotal >= STORE.freeShippingThreshold ? 0 : STORE.shippingFee;
  const total = subtotal + shipping;

  const submit = async () => {
    if (!priced.length) {
      setTone("error");
      setNote("Your cart is empty.");
      return;
    }
    const mobile = withDial(phone, country.dial);
    if (!name.trim() || !isValidPhone(mobile)) {
      setTone("error");
      setNote("Enter your name and a valid international mobile number.");
      return;
    }
    if (!pickup && (!line1.trim() || !city.trim() || !state.trim() || !isValidPostal(country.code, pincode))) {
      setTone("error");
      setNote(isIndia(country.code) ? "Enter the full delivery address and a 6-digit pincode." : "Enter the full delivery address and a valid postal code.");
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const started = await createCheckout({
        name: name.trim(),
        phone: mobile.replace(/\s/g, ""),
        line1: line1.trim(),
        landmark: landmark.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        country: country.name,
        countryCode: country.code,
        pickup,
        items: priced.map((item) => ({ id: item.id, quantity: item.quantity })),
      });
      const id = str(started.order?.id);
      if (!started.keyId || !started.razorpayOrderId || !id) throw new Error("Online payment is not available right now. Please try again later.");
      setPayment({
        orderId: id,
        html: razorpayPage({
          key: started.keyId,
          orderId: started.razorpayOrderId,
          amount: Math.round(Number(started.amount ?? total) * 100),
          name: name.trim(),
          email: session?.email ?? "",
          phone: mobile.replace(/\s/g, ""),
          description: `Order ${id}`,
        }),
      });
    } catch (error) {
      setTone("error");
      setNote((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onPayment = async (event: WebViewMessageEvent) => {
    const current = payment;
    setPayment(null);
    if (!current) return;
    let message: { type?: string; paymentId?: string; razorpayOrderId?: string; signature?: string; error?: string } = {};
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      message = { type: "error" };
    }
    if (message.type !== "success") {
      setTone("error");
      setNote(message.type === "dismiss" ? "Payment was cancelled. Your cart is still here." : message.error || "The payment did not go through.");
      return;
    }
    setBusy(true);
    try {
      await verifyCheckout({ orderId: current.orderId, paymentId: message.paymentId, razorpayOrderId: message.razorpayOrderId, signature: message.signature });
      cart.clear();
      setOrderId(current.orderId);
      setTone("success");
      setNote(`Payment received. Order ${current.orderId} is confirmed.`);
    } catch (error) {
      setTone("error");
      setNote((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!priced.length && !orderId) {
    return (
      <Screen>
        <PageHeader kicker="Shop" title="Checkout" subtitle="Add a publication from the shop first." />
        <Button label="Browse the shop" onPress={() => router.replace("/shop")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader kicker="Shop" title="Checkout" subtitle="Confirm delivery or store pickup, then pay." />
      <Modal visible={Boolean(payment)} animationType="slide" onRequestClose={() => onPayment({ nativeEvent: { data: JSON.stringify({ type: "dismiss" }) } } as WebViewMessageEvent)}>
        {payment ? (
          <WebView
            originWhitelist={["*"]}
            source={{ html: payment.html, baseUrl: "https://api.razorpay.com" }}
            onMessage={(event) => void onPayment(event)}
            javaScriptEnabled
            setSupportMultipleWindows={false}
          />
        ) : null}
      </Modal>
      <Banner text={note} tone={tone} />
      {orderId ? (
        <Card featured>
          <Heading>Order confirmed</Heading>
          <Muted>You can follow packing, shipping and delivery from the order page.</Muted>
          <Button label="Track this order" onPress={() => router.replace(`/order/${orderId}`)} />
          <Button kind="ghost" label="Continue shopping" onPress={() => router.replace("/shop")} />
        </Card>
      ) : (
        <>
          <Card>
            {priced.map((item) => (
              <Muted key={item.id}>
                {item.title} × {item.quantity} · {money(item.price * item.quantity)}
              </Muted>
            ))}
            {preorder ? (
              <Muted>{pickup ? "Store pickup · no charge" : "Shipping · added when you pay the balance"}</Muted>
            ) : (
              <Muted>Shipping {shipping ? money(shipping) : "Free"}</Muted>
            )}
            <Heading>Total {money(total)}</Heading>
          </Card>
          <Field label="Full name" value={name} onChange={setName} autoCapitalize="words" />
          <CountryField
            value={country.code}
            countries={countries}
            onChange={(next) => {
              setCountryCode(next.code);
              const nextStates = statesFor(next.code);
              if (nextStates.length && !nextStates.includes(state)) setState(nextStates[0] || "");
            }}
          />
          <Field label="Mobile number" value={phone} onChange={setPhone} keyboard="phone-pad" placeholder={`${country.dial} 98765 43210`} />
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            <Chip label="Home delivery" selected={!pickup} onPress={() => setPickup(false)} />
            <Chip label="Pick up from store" selected={pickup} onPress={() => setPickup(true)} />
          </View>
          {pickup ? <Muted>We will message you when the order is ready. Show your pickup OTP at the counter.</Muted> : null}
          {!pickup ? (
          <>
          <Field label="Address" value={line1} onChange={setLine1} autoCapitalize="words" />
          <Field label="Landmark (optional)" value={landmark} onChange={setLandmark} autoCapitalize="words" />
          <Field label="City" value={city} onChange={setCity} autoCapitalize="words" />
          {states.length ? (
            <View style={{ marginBottom: 12 }}>
              <Field label="State / region" value={state} onChange={setState} autoCapitalize="words" placeholder="Select or type a state" />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {states.map((item) => (
                  <Chip key={item} label={item} selected={state === item} onPress={() => setState(item)} />
                ))}
              </View>
            </View>
          ) : (
            <Field label="State / region" value={state} onChange={setState} autoCapitalize="words" />
          )}
          <Field
            label={isIndia(country.code) ? "Pincode" : "Postal code"}
            value={pincode}
            onChange={setPincode}
            keyboard={isIndia(country.code) ? "numeric" : "default"}
            placeholder={isIndia(country.code) ? "6-digit PIN" : "Postal code"}
          />
          </>
          ) : null}
          {preorder ? (
            <Muted>Pre-order: you pay for the items now. When your order is ready, the courier charge is added and you pay the balance from the order page.</Muted>
          ) : null}
          <Muted>Pay securely with UPI, card or net banking through Razorpay. Damaged items can be replaced after delivery if you share photos.</Muted>
          <Button label={busy ? "Please wait…" : `Pay ${money(total)}`} disabled={busy} onPress={() => void submit()} />
          <Button kind="ghost" label="Back to cart" onPress={() => router.replace("/cart")} />
        </>
      )}
    </Screen>
  );
}

function preorderable(book?: Record<string, unknown> | null) {
  if (!book) return false;
  const plan = book.preorder as { enabled?: boolean } | boolean | undefined;
  const enabled = typeof plan === "object" ? Boolean(plan?.enabled) : Boolean(plan);
  return enabled && (str(book.stockStatus) === "out_of_stock" || Number(book.stock ?? 0) <= 0);
}
