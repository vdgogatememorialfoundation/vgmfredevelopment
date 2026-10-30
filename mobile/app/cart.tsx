import { useState } from "react";
import { Text, View } from "react-native";
import { getSession, money, placeOrder, str } from "../src/api";
import { useCart } from "../src/cart";
import { Banner, Button, Card, Empty, Field, Muted, Screen, Title } from "../src/ui";

export default function CartScreen() {
  const cart = useCart();
  const session = getSession();
  const [name, setName] = useState(session?.name ?? "");
  const [email, setEmail] = useState(session?.email ?? "");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Screen>
      <Title>Bag</Title>
      <Banner text={note} />
      {cart.items.map((item) => (
        <Card key={item.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "700" }}>{item.title}</Text>
              <Muted>
                {item.quantity} × {money(item.price)}
              </Muted>
            </View>
            <Button kind="ghost" label="Remove" onPress={() => cart.remove(item.id)} />
          </View>
        </Card>
      ))}
      {!cart.items.length ? <Empty label="Your bag is empty." /> : <Muted>Total {money(cart.total)}</Muted>}
      {cart.items.length ? (
        <>
          <Muted>Card checkout stays on the website so payment keys never ship in the app. Placing the order records it on the Foundation mobile API.</Muted>
          <Field label="Name" value={name} onChange={setName} />
          <Field label="Email" value={email} onChange={setEmail} keyboard="email-address" />
          <Field label="Phone (optional)" value={phone} onChange={setPhone} keyboard="phone-pad" />
          <Button
            label={busy ? "Placing order…" : "Place order"}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                const order = await placeOrder({
                  name,
                  email,
                  phone,
                  items: cart.items.map((item) => ({ id: item.id, title: item.title, quantity: item.quantity, price: item.price })),
                });
                cart.clear();
                setNote(`Order ${str(order.id)} recorded for ${money(order.total)}. Pay on the website if online payment is required.`);
              } catch (err) {
                setNote((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      ) : null}
    </Screen>
  );
}
