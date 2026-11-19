import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { mediaUrl, str, type Row } from "../../src/api";
import { useFeed } from "../../src/feed";
import { Body, Card, Empty, Heading, Loading, Muted, PageHeader, Portrait, Screen } from "../../src/ui";

const TITLES: Record<string, string> = {
  foundation: "About the Foundation",
  history: "Our History",
  trustees: "Trustees & Team",
  legacy: "The Legacy of Vaidya R. B. Gogate",
  anagha: "Dr. Anagha Gogate",
  awards: "Awards & Accolades",
  scholarship: "Books & Research",
};

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n\s*\n/)
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part, index) => (
          <Body key={`${index}-${part.slice(0, 24)}`}>{part}</Body>
        ))}
    </>
  );
}

function Entries({ heading, rows }: { heading?: string; rows: unknown }) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return null;
  return (
    <>
      {heading ? <Heading>{heading}</Heading> : null}
      {list.map((raw, index) => {
        if (typeof raw === "string") return <Card key={`${raw}-${index}`}><Body>{raw}</Body></Card>;
        const row = (raw ?? {}) as Row;
        const photo = mediaUrl(str(row.photo, str(row.image, str(row.portrait))));
        const title = str(row.name, str(row.title));
        const meta = [str(row.year), str(row.role), str(row.designation), str(row.relation)].filter(Boolean).join(" · ");
        const text = str(row.body, str(row.description, str(row.bio)));
        return (
          <Card key={str(row.id, String(index))}>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
              {photo ? <Portrait uri={photo} label={title} size={64} /> : null}
              <View style={{ flex: 1, minWidth: 0 }}>
                {meta ? <Muted>{meta}</Muted> : null}
                {title ? <Heading>{title}</Heading> : null}
                {text ? <Paragraphs text={text} /> : null}
              </View>
            </View>
          </Card>
        );
      })}
    </>
  );
}

/** One About page (Legacy, Dr. Anagha Gogate, History, Foundation, Trustees, Awards, Books & research) from the live feed. */
export default function AboutPageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const key = String(id ?? "");
  const { feed, loading, refresh } = useFeed();
  if (loading && !feed) return <Loading />;
  const page = ((feed?.about as Row | undefined)?.[key] ?? null) as Row | null;
  if (!page) {
    return (
      <Screen refreshing={loading} onRefresh={refresh}>
        <Empty icon="document-text-outline" label="This page is not published yet." actionLabel="Refresh" onAction={() => void refresh()} />
      </Screen>
    );
  }
  const portrait = mediaUrl(str(page.portrait));
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <PageHeader kicker="About" title={str(page.title, TITLES[key] ?? "About")} />
      {portrait ? (
        <View style={{ alignItems: "center", marginBottom: 14 }}>
          <Portrait uri={portrait} label={str(page.title)} size={140} />
        </View>
      ) : null}
      {str(page.intro) ? <Card><Paragraphs text={str(page.intro)} /></Card> : null}
      {str(page.biography) ? <Card><Heading>Biography</Heading><Paragraphs text={str(page.biography)} /></Card> : null}
      {str(page.biographyMr) ? <Card><Heading>मराठी</Heading><Paragraphs text={str(page.biographyMr)} /></Card> : null}
      {str(page.philosophy) ? <Card><Heading>Philosophy</Heading><Paragraphs text={str(page.philosophy)} /></Card> : null}
      <Entries rows={page.sections} />
      <Entries heading="Activities" rows={page.activities} />
      <Entries heading={key === "history" ? undefined : "Timeline"} rows={page.timeline} />
      <Entries heading={str(page.treeTitle, "Family tree")} rows={page.tree} />
      <Entries heading={str(page.trusteesHeading, "Trustees")} rows={page.trustees} />
      <Entries heading={str(page.teamHeading, "Team")} rows={page.team} />
      <Entries rows={page.items} />
      <Entries heading={str(page.booksTitle, "Books")} rows={page.books} />
      <Entries heading={str(page.researchTitle, "Research")} rows={page.research} />
    </Screen>
  );
}
