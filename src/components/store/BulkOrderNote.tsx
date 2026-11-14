import Link from "next/link";
import { BULK_ORDER_LIMIT } from "@/lib/store";

export default function BulkOrderNote({ quantity }: { quantity: number }) {
  if (quantity < BULK_ORDER_LIMIT) return null;
  return (
    <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
      Need more than {BULK_ORDER_LIMIT} copies? For bulk orders the Foundation will contact you.{" "}
      <Link href="/contact" className="font-semibold underline">Request a bulk order</Link>
    </p>
  );
}
