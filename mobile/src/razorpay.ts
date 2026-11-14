import { NativeModules } from "react-native";

type NativeOptions = { key: string; orderId: string; amount: number; name: string; email: string; phone: string; description: string };

/** Opens the native Razorpay SDK (UPI apps, cards, net banking). Returns a WebView-style message, or null when the SDK is not in this build so callers fall back to the web checkout. */
export async function nativeCheckout(input: NativeOptions): Promise<{ nativeEvent: { data: string } } | null> {
  if (!NativeModules.RNRazorpayCheckout) return null;
  const RazorpayCheckout = (await import("react-native-razorpay")).default;
  const wrap = (value: object) => ({ nativeEvent: { data: JSON.stringify(value) } });
  try {
    const result = (await RazorpayCheckout.open({
      key: input.key,
      order_id: input.orderId,
      amount: String(input.amount),
      currency: "INR",
      name: "Vaidya Gogate Memorial Foundation",
      description: input.description,
      prefill: { name: input.name, email: input.email, contact: input.phone },
      theme: { color: "#8F2D2D" },
    } as never)) as { razorpay_payment_id?: string; razorpay_order_id?: string; razorpay_signature?: string };
    return wrap({ type: "success", paymentId: result.razorpay_payment_id, razorpayOrderId: result.razorpay_order_id, signature: result.razorpay_signature });
  } catch (error) {
    const err = error as { code?: number; description?: string; error?: { description?: string } };
    if (err?.code === 0 || err?.code === 2) return wrap({ type: "dismiss" });
    let detail = err?.error?.description || "";
    if (!detail && typeof err?.description === "string") {
      try {
        detail = (JSON.parse(err.description) as { error?: { description?: string } }).error?.description || err.description;
      } catch {
        detail = err.description;
      }
    }
    return wrap({ type: "error", error: detail || "The payment did not go through." });
  }
}

/** A tiny page that opens Razorpay Checkout inside a WebView and posts the result back. */
export function razorpayPage(input: { key: string; orderId: string; amount: number; name: string; email: string; phone: string; description: string }) {
  const options = JSON.stringify({
    key: input.key,
    order_id: input.orderId,
    amount: input.amount,
    currency: "INR",
    name: "Vaidya Gogate Memorial Foundation",
    description: input.description,
    prefill: { name: input.name, email: input.email, contact: input.phone },
    theme: { color: "#8F2D2D" },
  });
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#FFFDF8;font-family:sans-serif;color:#5b4636;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<p>Opening secure payment…</p>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
function send(m){window.ReactNativeWebView.postMessage(JSON.stringify(m));}
try{
var o=${options};
o.handler=function(r){send({type:"success",paymentId:r.razorpay_payment_id,razorpayOrderId:r.razorpay_order_id,signature:r.razorpay_signature});};
o.modal={ondismiss:function(){send({type:"dismiss"});}};
var rp=new Razorpay(o);
rp.on("payment.failed",function(r){send({type:"error",error:(r&&r.error&&r.error.description)||"Payment failed."});});
rp.open();
}catch(e){send({type:"error",error:"Could not open Razorpay."});}
</script></body></html>`;
}
