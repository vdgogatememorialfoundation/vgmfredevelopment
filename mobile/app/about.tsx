import { Text, View } from "react-native";
import { useFeed } from "../src/feed";
import { resolvedAbout, SITE } from "../src/site-content";
import { useTheme } from "../src/theme";
import { Body, Card, Heading, Kicker, Loading, Muted, PageHeader, Portrait, Screen, SiteFooter } from "../src/ui";

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n\s*\n/)
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => (
          <Body key={part.slice(0, 40)}>{part}</Body>
        ))}
    </>
  );
}

function Person({ uri, title, role, body, fallback }: { uri?: string; title: string; role: string; body: string; fallback?: number }) {
  const theme = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
        <Portrait uri={uri} label={title} size={80} fallback={fallback} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Heading>{title}</Heading>
          <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 3 }}>{role}</Text>
          <Paragraphs text={body} />
        </View>
      </View>
    </Card>
  );
}

export default function AboutScreen() {
  const { feed, loading, refresh } = useFeed();
  const theme = useTheme();
  const about = resolvedAbout(feed?.about);
  const foundation = ((feed?.about?.foundation ?? {}) as { title?: string; intro?: string; body?: string });
  const sections = (Array.isArray(feed?.about?.sections) ? feed?.about?.sections : []) as { id?: string; title?: string; body?: string }[];
  if (loading && !feed) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Kicker>Preserving Ayurveda</Kicker>
      <Text style={{ fontSize: 22, color: theme.colors.primary, fontFamily: theme.fontFamily, marginBottom: 8 }}>{SITE.tagline}</Text>
      <PageHeader kicker="About the Foundation" title={about.title} subtitle={about.intro} />
      {foundation.intro ? (
        <Card>
          <Heading>{foundation.title || "About the Foundation"}</Heading>
          <Paragraphs text={foundation.intro} />
          {foundation.body ? <Paragraphs text={foundation.body} /> : null}
        </Card>
      ) : null}
      {sections.map((item) => (
        <Card key={String(item.id ?? item.title)}>
          <Heading>{String(item.title ?? "")}</Heading>
          <Paragraphs text={String(item.body ?? "")} />
        </Card>
      ))}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        <Stat value="1933" label="Vd. R. B. Gogate born" />
        <Stat value="2015" label="Work carried forward" />
      </View>
      <Person uri={about.rb.portrait} title={about.rb.title} role={about.rb.role} body={about.rb.biography} fallback={require("../assets/rb-square.jpg")} />
      {about.rb.biographyMr ? (
        <Card>
          <Heading>मराठी</Heading>
          <Paragraphs text={about.rb.biographyMr} />
        </Card>
      ) : null}
      <Person uri={about.anagha.portrait} title={about.anagha.title} role={about.anagha.role} body={about.anagha.biography} fallback={require("../assets/anagha-square.jpg")} />
      <Heading>Awards & accolades</Heading>
      {about.awards.map((item) => (
        <Card key={item.title}>
          <Heading>{item.title}</Heading>
          <Muted>{item.body}</Muted>
        </Card>
      ))}
      <Heading>Books & research</Heading>
      <Card>
        <Heading>Books</Heading>
        {about.books.map((book) => (
          <Muted key={book}>{book}</Muted>
        ))}
      </Card>
      <Card>
        <Heading>Research</Heading>
        {about.research.map((item) => (
          <Muted key={item}>{item}</Muted>
        ))}
      </Card>
      <Heading>Our history</Heading>
      {about.history.map((item) => (
        <Card key={`${item.year}-${item.title}`}>
          <Muted>{item.year}</Muted>
          <Heading>{item.title}</Heading>
          <Muted>{item.body}</Muted>
        </Card>
      ))}
      <Heading>Trustees & team</Heading>
      <Card>
        <Paragraphs text={about.trustees} />
      </Card>
      <SiteFooter />
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.paper, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "600", color: theme.colors.primary, fontFamily: theme.fontFamily }}>{value}</Text>
      <Text style={{ color: theme.colors.muted, fontSize: 11, marginTop: 4 }}>{label}</Text>
    </View>
  );
}
