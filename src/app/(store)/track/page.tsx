import Link from "next/link";

export default function TrackLinkPage() {
  return (
    <div className="container py-10">
      <h1 className="font-serif text-3xl text-ink">Track a shipment</h1>
      <p className="mt-3 max-w-xl text-sm text-text-muted">
        Open the tracking link shared by the Foundation desk. That link follows this order without a sign-in.
      </p>
      <p className="mt-4 text-sm">
        <Link href="/track-shipment" className="font-semibold text-burgundy">Look up with an order number</Link>
      </p>
    </div>
  );
}
