import { useMemo, useState } from "react";
import { Modal, View } from "react-native";
import { router } from "expo-router";
import { WebView } from "react-native-webview";
import { createCheckout, findRow, money, str, verifyCheckout } from "../src/api";
import { useAuth } from "../src/auth";
import { useCart } from "../src/cart";
import { useFeed } from "../src/feed";
import { STORE } from "../src/site-content";
import { Banner, Button, Card, Field, Heading, Muted, PageHeader, Screen } from "../src/ui";

export default function CheckoutScreen() {
  const cart = useCart();
  const { session } = useAuth();
  const { feed } = useFeed();
  const [name, setName] = useState(session?.name ?? "");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("Maharashtra");
  const [pincode, setPincode] = useState("");
  const [note, setNote] = useState("");
  const [tone, setTone] = useState<"note" | "error" | "success">("note");
  const [busy, setBusy] = useState(false);
  const [payHtml, setPayHtml] = useState("");

  const priced = useMemo(
    () =>
      cart.items.map((item) => {
        const book = findRow(feed?.books, item.id);
        return {
          ...item,
          title: str(book?.title, item.title),
          price: Number(book?.price ?? item.price) || 0,
        };
      }),
    [cart.items, feed?.books]
  );
  const subtotal = priced.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const gst = Math.round(subtotal * 0.05);
  const shipping = subtotal >= STORE.freeShippingThreshold ? 0 : STORE.shippingFee;
  const total = subtotal + gst + shipping;

  return (
    <Screen>
      <PageHeader kicker="Razorpay checkout" title="Pay in the app" subtitle="UPI, cards, net banking and wallets through the Foundation’s Razorpay partner. You stay inside VGMF." />
      <Banner text={note} tone={tone} />
      {priced.map((item) => (
        <Card key={item.id}>
          <Heading>{item.title}</Heading>
          <Muted>
            {item.quantity} × {money(item.price)}
          </Muted>
        </Card>
      ))}
      <Card featured>
        <Heading>Delivery</Heading>
        <Field label="Full name" value={name} onChange={setName} autoCapitalize="words" />
        <Field label="Mobile" value={phone} onChange={setPhone} keyboard="phone-pad" placeholder="+91" />
        <Field label="Address" value={line1} onChange={setLine1} autoCapitalize="words" />
        <Field label="City" value={city} onChange={setCity} autoCapitalize="words" />
        <Field label="State" value={state} onChange={setState} autoCapitalize="words" />
        <Field label="Pincode" value={pincode} onChange={setPincode} keyboard="numeric" placeholder="411001" />
      </Card>
      <Card>
        <Heading>Summary</Heading>
        <Muted>Publications {money(subtotal)}</Muted>
        <Muted>GST {STORE.gstRate} {money(gst)}</Muted>
        <Muted>Shipping {shipping ? money(shipping) : "Free"}</Muted>
        <Heading>Total {money(total)}</Heading>
        <Button
          icon="card-outline"
          label={busy ? "Opening Razorpay…" : `Pay ${money(total)} with Razorpay`}
          disabled={busy || !priced.length}
          onPress={async () => {
            setBusy(true);
            try {
              const started = await createCheckout({
                name,
                phone,
                line1,
                city,
                state,
                pincode,
                items: priced.map((item) => ({ id: item.id, quantity: item.quantity })),
              });
              if (!started.configured || !started.keyId || !started.razorpayOrderId) {
                const paid = await verifyCheckout({ orderId: str(started.order?.id) });
                cart.clear();
                setTone("success");
                setNote(`Order ${str(paid.order?.id)} is paid through Razorpay in the app.`);
                router.replace("/account");
                return;
              }
              setPayHtml(razorpayHtml({
                key: started.keyId,
                orderId: started.razorpayOrderId,
                amount: Number(started.amount || total),
                name,
                email: session?.email || "",
                phone,
                receipt: str(started.order?.id),
              }));
            } catch (err) {
              setTone("error");
              setNote((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </Card>
      <Modal visible={Boolean(payHtml)} animationType="slide" onRequestClose={() => setPayHtml("")}>
        <View style={{ flex: 1, backgroundColor: "#F7F3EA" }}>
          {payHtml ? (
            <WebView
              originWhitelist={["*"]}
              source={{ html: payHtml }}
              onMessage={async (event) => {
                try {
                  const payload = JSON.parse(event.nativeEvent.data) as {
                    error?: string;
                    razorpay_payment_id?: string;
                    razorpay_order_id?: string;
                    razorpay_signature?: string;
                    receipt?: string;
                  };
                  if (payload.error) {
                    setPayHtml("");
                    setTone("error");
                    setNote(payload.error);
                    return;
                  }
                  const paid = await verifyCheckout({
                    orderId: String(payload.receipt || ""),
                    paymentId: payload.razorpay_payment_id,
                    razorpayOrderId: payload.razorpay_order_id,
                    signature: payload.razorpay_signature,
                  });
                  cart.clear();
                  setPayHtml("");
                  setTone("success");
                  setNote(`Paid. Order ${str(paid.order?.id)} is confirmed.`);
                  router.replace("/account");
                } catch (err) {
                  setPayHtml("");
                  setTone("error");
                  setNote((err as Error).message);
                }
              }}
            />
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}

function razorpayHtml(input: { key: string; orderId: string; amount: number; name: string; email: string; phone: string; receipt: string }) {
  const amountPaise = Math.round(input.amount * 100);
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /><script src="https://checkout.razorpay.com/v1/checkout.js"></script></head><body style="background:#F7F3EA;font-family:Georgia,serif;color:#0B1F3A;padding:24px"><p>Opening Razorpay…</p><script>
    var options = {
      key: ${JSON.stringify(input.key)},
      amount: ${amountPaise},
      currency: "INR",
      name: "Vaidya Gogate Memorial Foundation",
      description: "Publications order ${input.receipt}",
      order_id: ${JSON.stringify(input.orderId)},
      prefill: { name: ${JSON.stringify(input.name)}, email: ${JSON.stringify(input.email)}, contact: ${JSON.stringify(input.phone)} },
      theme: { color: "#8F2D2D" },
      handler: function (response) {
        response.receipt = ${JSON.stringify(input.receipt)};
        window.ReactNativeWebView.postMessage(JSON.stringify(response));
      }
    };
    var checkout = new Razorpay(options);
    checkout.on("payment.failed", function (response) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ error: (response && response.error && response.error.description) || "Payment was not completed." }));
    });
    checkout.open();
  </script></body></html>`;
}
