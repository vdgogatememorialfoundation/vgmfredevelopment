import { Text, View } from "react-native";
import { str, type Row } from "../src/api";
import { useFeed } from "../src/feed";
import { Body, Card, Empty, Loading, Muted, Screen, Title } from "../src/ui";

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

function Heading({ children }: { children: string }) {
  return (
    <Text style={{ fontWeight: "800", fontSize: 18, marginTop: 8, marginBottom: 8 }}>{children}</Text>
  );
}

export default function AboutScreen() {
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
  const hasBody =
    Boolean(intro) ||
    sections.length > 0 ||
    Boolean(str(foundation.intro)) ||
    Boolean(str(legacy.biography)) ||
    Boolean(str(anagha.biography));

  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Title>{str(about.title, "About Vaidya Gogate Memorial Foundation")}</Title>
      {intro ? (
        <Card>
          <Paragraphs text={intro} />
        </Card>
      ) : null}

      {sections.map((section, index) => (
        <Card key={str(section.id, String(index))}>
          <Text style={{ fontWeight: "700", fontSize: 16 }}>{str(section.title)}</Text>
          <Muted>{str(section.body)}</Muted>
        </Card>
      ))}

      {str(foundation.title) || str(foundation.intro) ? (
        <View>
          <Heading>{str(foundation.title, "About the Foundation")}</Heading>
          {str(foundation.intro) ? (
            <Card>
              <Paragraphs text={str(foundation.intro)} />
            </Card>
          ) : null}
          {asRows(foundation.sections).map((section, index) => (
            <Card key={str(section.id, `f-${index}`)}>
              <Text style={{ fontWeight: "700", fontSize: 16 }}>{str(section.title)}</Text>
              <Muted>{str(section.body)}</Muted>
            </Card>
          ))}
        </View>
      ) : null}

      {str(legacy.title) || str(legacy.biography) || str(legacy.biographyMr) ? (
        <View>
          <Heading>{str(legacy.title, "The Legacy of Vaidya R. B. Gogate")}</Heading>
          {str(legacy.intro) ? (
            <Card>
              <Paragraphs text={str(legacy.intro)} />
            </Card>
          ) : null}
          {str(legacy.biography) ? (
            <Card>
              <Text style={{ fontWeight: "700", fontSize: 16 }}>Biography</Text>
              <Paragraphs text={str(legacy.biography)} />
            </Card>
          ) : null}
          {str(legacy.philosophy) ? (
            <Card>
              <Text style={{ fontWeight: "700", fontSize: 16 }}>Philosophy</Text>
              <Paragraphs text={str(legacy.philosophy)} />
            </Card>
          ) : null}
          {str(legacy.biographyMr) ? (
            <Card>
              <Text style={{ fontWeight: "700", fontSize: 16 }}>मराठी</Text>
              <Paragraphs text={str(legacy.biographyMr)} />
            </Card>
          ) : null}
        </View>
      ) : null}

      {str(anagha.title) || str(anagha.biography) ? (
        <View>
          <Heading>{str(anagha.title, "Dr. Anagha Gogate")}</Heading>
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

      {str(awards.title) || asRows(awards.items).length ? (
        <View>
          <Heading>{str(awards.title, "Awards & Accolades")}</Heading>
          {str(awards.intro) ? (
            <Card>
              <Paragraphs text={str(awards.intro)} />
            </Card>
          ) : null}
          {asRows(awards.items).map((item, index) => (
            <Card key={str(item.id, `aw-${index}`)}>
              <Text style={{ fontWeight: "700", fontSize: 16 }}>{str(item.title)}</Text>
              <Muted>{str(item.body)}</Muted>
            </Card>
          ))}
        </View>
      ) : null}

      {str(scholarship.title) || str(scholarship.intro) || asStrings(scholarship.books).length || asStrings(scholarship.research).length ? (
        <View>
          <Heading>{str(scholarship.title, "Books & Research")}</Heading>
          {str(scholarship.intro) ? (
            <Card>
              <Paragraphs text={str(scholarship.intro)} />
            </Card>
          ) : null}
          <Card>
            <Text style={{ fontWeight: "700", fontSize: 16 }}>{str(scholarship.booksTitle, "Books")}</Text>
            {asStrings(scholarship.books).map((book) => (
              <Muted key={book}>{book}</Muted>
            ))}
          </Card>
          <Card>
            <Text style={{ fontWeight: "700", fontSize: 16 }}>{str(scholarship.researchTitle, "Research")}</Text>
            {asStrings(scholarship.research).map((item) => (
              <Muted key={item}>{item}</Muted>
            ))}
          </Card>
        </View>
      ) : null}

      {str(history.title) || asRows(history.timeline).length ? (
        <View>
          <Heading>{str(history.title, "Our History")}</Heading>
          {str(history.intro) ? (
            <Card>
              <Paragraphs text={str(history.intro)} />
            </Card>
          ) : null}
          {asRows(history.timeline).map((item, index) => (
            <Card key={str(item.id, `h-${index}`)}>
              <Muted>{str(item.year)}</Muted>
              <Text style={{ fontWeight: "700", fontSize: 16 }}>{str(item.title)}</Text>
              <Muted>{str(item.description)}</Muted>
            </Card>
          ))}
        </View>
      ) : null}

      {str(trustees.title) || str(trustees.intro) ? (
        <View>
          <Heading>{str(trustees.title, "Trustees & Team")}</Heading>
          <Card>
            <Paragraphs
              text={str(
                trustees.intro,
                "The grandchildren of Vd. R. B. Gogate are creating this platform on behalf of the Gogate family."
              )}
            />
          </Card>
        </View>
      ) : null}

      {!hasBody ? (
        <Empty label="About content appears here after Admin publishes the live site." />
      ) : null}
    </Screen>
  );
}
