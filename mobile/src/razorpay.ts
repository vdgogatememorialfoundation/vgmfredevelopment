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
<body style="background:#FFFFFF;font-family:sans-serif;color:#111827;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
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

/**
 * Desktop spoof script injected into BOTH the main page and Razorpay's iframe
 * (via injectedJavaScriptBeforeContentLoadedForMainFrameOnly={false}) so Razorpay Standard Checkout
 * detects a desktop browser and renders the live scannable Dynamic UPI QR code with exact locked amount.
 */
export const RAZORPAY_DESKTOP_SPOOF_JS = `
(function(){
  try {
    Object.defineProperty(navigator, 'platform', { get: function(){ return 'Win32'; }, configurable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: function(){ return 0; }, configurable: true });
    Object.defineProperty(navigator, 'userAgentData', { get: function(){ return undefined; }, configurable: true });
    if (window.screen && window.screen.width < 1024) {
      Object.defineProperty(window.screen, 'width', { get: function(){ return 1280; }, configurable: true });
      Object.defineProperty(window.screen, 'availWidth', { get: function(){ return 1280; }, configurable: true });
    }
  } catch (e) {}
})();
true;
`;

/**
 * Store POS Dynamic Razorpay UPI Amount QR page.
 * Keeps show_default_blocks: true and never hides all UPI flows so Razorpay NEVER throws
 * "No appropriate payment method found" — opens directly on UPI QR (with UPI ID / Card fallback available).
 */
export function razorpayUpiQrPage(input: { key: string; orderId: string; amount: number; name: string; email: string; phone: string; description: string }) {
  const options = JSON.stringify({
    key: input.key,
    order_id: input.orderId,
    amount: input.amount,
    currency: "INR",
    name: "Vaidya Gogate Memorial Foundation",
    description: input.description,
    prefill: {
      name: input.name || "Walk-in Customer",
      email: input.email || "care@vaidyagogate.org",
      contact: input.phone || "9999999999",
      method: "upi",
    },
    config: {
      display: {
        blocks: {
          upi: {
            name: "Pay via UPI QR",
            instruments: [{ method: "upi" }],
          },
        },
        sequence: ["block.upi"],
        preferences: { show_default_blocks: true },
      },
    },
    theme: { color: "#8F2D2D" },
  });
  return `<!doctype html><html><head><meta name="viewport" content="width=1024,initial-scale=0.38,maximum-scale=2.0"></head>
<body style="background:#FFFFFF;font-family:-apple-system,Roboto,sans-serif;color:#111827;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0">
<p style="font-size:20px;font-weight:700;color:#111827">Opening Razorpay UPI Amount QR…</p>
<p style="font-size:15px;color:#6B7280;margin-top:6px">Customer can scan directly with GPay, PhonePe, Paytm or BHIM</p>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
function send(m){window.ReactNativeWebView.postMessage(JSON.stringify(m));}
try{
var o=${options};
o.handler=function(r){send({type:"success",paymentId:r.razorpay_payment_id,razorpayOrderId:r.razorpay_order_id,signature:r.razorpay_signature});};
o.modal={ondismiss:function(){send({type:"dismiss"});}};
var rp=new Razorpay(o);
rp.on("payment.failed",function(r){send({type:"error",error:(r&&r.error&&r.error.description)||"UPI payment failed."});});
rp.open();
}catch(e){send({type:"error",error:"Could not load Razorpay UPI QR."});}
</script></body></html>`;
}
