import { Text, View } from "react-native";
import { mediaUrl, str, type Row } from "../src/api";
import { useFeed } from "../src/feed";
import { Body, Card, Empty, Loading, Muted, PageHeader, Portrait, Screen } from "../src/ui";
import { useTheme } from "../src/theme";

function asRow(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
}

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function splitParagraphs(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function Paragraphs({ text }: { text: string }) {
  const parts = splitParagraphs(text);
  if (!parts.length && text) return <Body>{text}</Body>;
  return (
    <>
      {parts.map((part) => (
        <Body key={part.slice(0, 48)}>{part}</Body>
      ))}
    </>
  );
}

function SectionTitle({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <Text style={{ fontWeight: "800", fontSize: 18, marginTop: 12, marginBottom: 8, color: theme.colors.text, fontFamily: theme.fontFamily }}>{children}</Text>
  );
}

function usableUri(value: string) {
  const src = value.trim();
  if (!src || /^data:/i.test(src) || /^blob:/i.test(src)) return "";
  return src;
}

function PersonRow({ uri, label, title, body }: { uri?: string; label: string; title: string; body?: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
      <Portrait uri={uri} label={label} size={80} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontWeight: "700", fontSize: 16, color: theme.colors.text, fontFamily: theme.fontFamily }}>{title}</Text>
        {body ? <Paragraphs text={body} /> : null}
      </View>
    </View>
  );
}

export default function AboutScreen() {
  const theme = useTheme();
  const { feed, loading, refresh } = useFeed();
  const about = asRow(feed?.about);
  if (loading && !feed) return <Loading />;
  const sections = asRows(about.sections);
  const foundation = asRow(about.foundation);
  const history = asRow(about.history);
  const trustees = asRow(about.trustees);
  const legacy = asRow(about.legacy);
  const anagha = asRow(about.anagha);
  const awards = asRow(about.awards);
  const scholarship = asRow(about.scholarship);
  const intro = str(about.intro);
  const rbPhoto = mediaUrl(usableUri(str(legacy.portrait)) || usableUri(str(about.heroImage)) || "/about/rb-square.jpg");
  const anaghaPhoto = mediaUrl(usableUri(str(anagha.portrait)) || "/about/anagha-square.jpg");
  const hasBody =
    Boolean(intro) ||
    sections.length > 0 ||
    Boolean(str(foundation.intro)) ||
    Boolean(str(legacy.biography) || str(legacy.biographyMr)) ||
    Boolean(str(anagha.biography) || str(anagha.intro)) ||
    Boolean(str(awards.intro) || asRows(awards.items).length) ||
    Boolean(str(scholarship.intro) || asStrings(scholarship.books).length);

  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <PageHeader kicker="About Us" title={str(about.title, "Vaidya Gogate Memorial Foundation")} subtitle="Portraits stay as small squares on the left; biography starts on the right." />
      <Card featured>
        <PersonRow
          uri={rbPhoto}
          label="Vaidya R. B. Gogate"
          title={str(legacy.title, "The Legacy of Vaidya R. B. Gogate")}
          body={str(legacy.biography).split(/\n\s*\n/)[0]}
        />
      </Card>
      <Card featured>
        <PersonRow
          uri={anaghaPhoto}
          label={str(anagha.title, "Dr. Anagha Gogate")}
          title={str(anagha.title, "Dr. Anagha Gogate")}
          body={str(anagha.biography).split(/\n\s*\n/)[0]}
        />
      </Card>
      {intro ? (
        <Card>
          <Paragraphs text={intro} />
        </Card>
      ) : null}

      {sections.map((section, index) => (
        <Card key={str(section.id, String(index))}>
          <Text style={{ fontWeight: "700", fontSize: 16, color: theme.colors.text }}>{str(section.title)}</Text>
          <Muted>{str(section.body)}</Muted>
        </Card>
      ))}

      {str(foundation.title) || str(foundation.intro) ? (
        <View>
          <SectionTitle>{str(foundation.title, "About the Foundation")}</SectionTitle>
          {str(foundation.intro) ? (
            <Card>
              <Paragraphs text={str(foundation.intro)} />
            </Card>
          ) : null}
          {asRows(foundation.sections).map((section, index) => (
            <Card key={str(section.id, `f-${index}`)}>
              <Text style={{ fontWeight: "700", fontSize: 16, color: theme.colors.text }}>{str(section.title)}</Text>
              <Muted>{str(section.body)}</Muted>
            </Card>
          ))}
        </View>
      ) : null}

      {str(legacy.title) || str(legacy.biography) || str(legacy.biographyMr) ? (
        <View>
          <SectionTitle>{str(legacy.title, "The Legacy of Vaidya R. B. Gogate")}</SectionTitle>
          {str(legacy.intro) ? (
            <Card>
              <Paragraphs text={str(legacy.intro)} />
            </Card>
          ) : null}
          {str(legacy.biography) ? (
            <Card>
              <Text style={{ fontWeight: "700", fontSize: 16, color: theme.colors.text }}>Biography</Text>
              <Paragraphs text={str(legacy.biography)} />
            </Card>
          ) : null}
          {str(legacy.philosophy) ? (
            <Card>
              <Text style={{ fontWeight: "700", fontSize: 16, color: theme.colors.text }}>Philosophy</Text>
              <Paragraphs text={str(legacy.philosophy)} />
            </Card>
          ) : null}
          {str(legacy.biographyMr) ? (
            <Card>
              <Text style={{ fontWeight: "700", fontSize: 16, color: theme.colors.text }}>मराठी</Text>
              <Paragraphs text={str(legacy.biographyMr)} />
            </Card>
          ) : null}
        </View>
      ) : null}

      {str(anagha.title) || str(anagha.biography) || str(anagha.intro) ? (
        <View>
          <SectionTitle>{str(anagha.title, "Dr. Anagha Gogate")}</SectionTitle>
          {str(anagha.intro) ? (
            <Card>
              <Paragraphs text={str(anagha.intro)} />
            </Card>
          ) : null}
          {str(anagha.biography) ? (
            <Card>
              <Paragraphs text={str(anagha.biography)} />
            </Card>
          ) : null}
        </View>
      ) : null}

      {str(awards.title) || str(awards.intro) || asRows(awards.items).length ? (
        <View>
          <SectionTitle>{str(awards.title, "Awards & Accolades")}</SectionTitle>
          {str(awards.intro) ? (
            <Card>
              <Paragraphs text={str(awards.intro)} />
            </Card>
          ) : null}
          {asRows(awards.items).map((item, index) => (
            <Card key={str(item.id, `aw-${index}`)}>
              <Text style={{ fontWeight: "700", fontSize: 16, color: theme.colors.text }}>{str(item.title)}</Text>
              <Muted>{str(item.body)}</Muted>
            </Card>
          ))}
        </View>
      ) : null}

      {str(scholarship.title) || str(scholarship.intro) || asStrings(scholarship.books).length || asStrings(scholarship.research).length ? (
        <View>
          <SectionTitle>{str(scholarship.title, "Books & Research")}</SectionTitle>
          {str(scholarship.intro) ? (
            <Card>
              <Paragraphs text={str(scholarship.intro)} />
            </Card>
          ) : null}
          <Card>
            <Text style={{ fontWeight: "700", fontSize: 16, color: theme.colors.text }}>{str(scholarship.booksTitle, "Books")}</Text>
            {asStrings(scholarship.books).map((book) => (
              <Muted key={book}>{book}</Muted>
            ))}
          </Card>
          <Card>
            <Text style={{ fontWeight: "700", fontSize: 16, color: theme.colors.text }}>{str(scholarship.researchTitle, "Research")}</Text>
            {asStrings(scholarship.research).map((item) => (
              <Muted key={item}>{item}</Muted>
            ))}
          </Card>
        </View>
      ) : null}

      {str(history.title) || asRows(history.timeline).length ? (
        <View>
          <SectionTitle>{str(history.title, "Our History")}</SectionTitle>
          {str(history.intro) ? (
            <Card>
              <Paragraphs text={str(history.intro)} />
            </Card>
          ) : null}
          {asRows(history.timeline).map((item, index) => (
            <Card key={str(item.id, `h-${index}`)}>
              <Muted>{str(item.year)}</Muted>
              <Text style={{ fontWeight: "700", fontSize: 16, color: theme.colors.text }}>{str(item.title)}</Text>
              <Muted>{str(item.description)}</Muted>
            </Card>
          ))}
        </View>
      ) : null}

      {str(trustees.title) || str(trustees.intro) ? (
        <View>
          <SectionTitle>{str(trustees.title, "Trustees & Team")}</SectionTitle>
          <Card>
            <Paragraphs
              text={str(trustees.intro, "The grandchildren of Vd. R. B. Gogate are creating this platform on behalf of the Gogate family.")}
            />
          </Card>
        </View>
      ) : null}

      {!hasBody ? <Empty icon="people-outline" label="About content appears here after Admin publishes the live site." /> : null}
    </Screen>
  );
}
