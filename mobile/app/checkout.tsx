import { useMemo, useState } from "react";
import { router } from "expo-router";
import { findRow, money, placeOrder, str } from "../src/api";
import { useAuth } from "../src/auth";
import { useCart } from "../src/cart";
import { useFeed } from "../src/feed";
import { STORE } from "../src/site-content";
import { Banner, Button, Card, Field, Heading, Muted, PageHeader, Screen } from "../src/ui";

export default function CheckoutScreen() {
  const cart = useCart();
  const { session } = useAuth();
  const { feed } = useFeed();
  const [name, setName] = useState(session?.name || "");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [tone, setTone] = useState<"note" | "error" | "success">("note");
  const [orderId, setOrderId] = useState("");

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
  const shipping = subtotal >= STORE.freeShippingThreshold ? 0 : STORE.shippingFee;
  const total = subtotal + shipping;

  const submit = async () => {
    if (!priced.length) {
      setTone("error");
      setNote("Your cart is empty.");
      return;
    }
    if (!name.trim() || !/^\+?[0-9]{10,15}$/.test(phone.replace(/\s/g, ""))) {
      setTone("error");
      setNote("Enter your name and a valid mobile number.");
      return;
    }
    if (!line1.trim() || !city.trim() || !state.trim() || !/^\d{6}$/.test(pincode.trim())) {
      setTone("error");
      setNote("Enter the full delivery address and a 6-digit pincode.");
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const order = await placeOrder({
        name: name.trim(),
        phone: phone.replace(/\s/g, ""),
        line1: line1.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        items: priced.map((item) => ({ id: item.id, quantity: item.quantity })),
      });
      cart.clear();
      setOrderId(str(order.id));
      setTone("success");
      setNote(`Order ${str(order.id)} is placed. Total ${money(order.total ?? total)}.`);
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
      <PageHeader kicker="Shop" title="Checkout" subtitle="Confirm the delivery address and place the order." />
      <Banner text={note} tone={tone} />
      {orderId ? (
        <Card featured>
          <Heading>Order placed</Heading>
          <Muted>The Foundation desk will confirm this order. You can follow it from My Orders.</Muted>
          <Button label="View my orders" onPress={() => router.replace("/account/orders")} />
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
            <Muted>Shipping {shipping ? money(shipping) : "Free"}</Muted>
            <Heading>Total {money(total)}</Heading>
          </Card>
          <Field label="Full name" value={name} onChange={setName} autoCapitalize="words" />
          <Field label="Mobile number" value={phone} onChange={setPhone} keyboard="phone-pad" />
          <Field label="Address" value={line1} onChange={setLine1} autoCapitalize="words" />
          <Field label="City" value={city} onChange={setCity} autoCapitalize="words" />
          <Field label="State" value={state} onChange={setState} autoCapitalize="words" />
          <Field label="Pincode" value={pincode} onChange={setPincode} keyboard="numeric" />
          <Button label={busy ? "Placing order…" : `Place order · ${money(total)}`} disabled={busy} onPress={() => void submit()} />
          <Button kind="ghost" label="Back to cart" onPress={() => router.replace("/cart")} />
        </>
      )}
    </Screen>
  );
}
