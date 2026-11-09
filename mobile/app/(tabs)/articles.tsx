import { str } from "../src/api";
import { CatalogList } from "../src/catalog";
import { useFeed } from "../src/feed";

export default function ArticlesScreen() {
  const { feed } = useFeed();
  return (
    <CatalogList
      title="Articles"
      empty="No articles are in the published app feed yet. Pull to refresh after Admin publishes."
      items={feed?.articles ?? []}
      href={(id) => `/article/${id}`}
      nameKey="title"
      imageKey="coverImage"
      detail={(item) => [str(item.author), str(item.date).slice(0, 10)].filter(Boolean).join(" · ")}
    />
  );
}
