import ShopCatalogue from "@/components/store/ShopCatalogue";
import { readMobileFeed } from "@/lib/server/mobile-feed";

export const dynamic = "force-dynamic";

export default function ShopPage() {
  const books = (readMobileFeed().books ?? []).filter((book) => book.active !== false);
  return <ShopCatalogue initialBooks={books} />;
}
