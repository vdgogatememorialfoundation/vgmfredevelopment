import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { findRow, money, placeOrder, str } from "../src/api";
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
  const shipping = subtotal >= STORE.freeShippingThreshold ? 0 : STORE.shippingFee;
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
    if (!line1.trim() || !city.trim() || !state.trim() || !isValidPostal(country.code, pincode)) {
      setTone("error");
      setNote(isIndia(country.code) ? "Enter the full delivery address and a 6-digit pincode." : "Enter the full delivery address and a valid postal code.");
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const order = await placeOrder({
        name: name.trim(),
        phone: mobile.replace(/\s/g, ""),
        line1: line1.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        country: country.name,
        countryCode: country.code,
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
          <Field label="Address" value={line1} onChange={setLine1} autoCapitalize="words" />
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
          <Button label={busy ? "Placing order…" : `Place order · ${money(total)}`} disabled={busy} onPress={() => void submit()} />
          <Button kind="ghost" label="Back to cart" onPress={() => router.replace("/cart")} />
        </>
      )}
    </Screen>
  );
}
