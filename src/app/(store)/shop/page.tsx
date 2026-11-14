import ShopCatalogue from "@/components/store/ShopCatalogue";
import { readMobileFeed } from "@/lib/server/mobile-feed";
import { isPublishedNow } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default function ShopPage() {
  const books = (readMobileFeed().books ?? []).filter((book) => book.active !== false && isPublishedNow(book));
  return <ShopCatalogue initialBooks={books} />;
}
