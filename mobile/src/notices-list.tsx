import { Linking } from "react-native";
import { getApiBase, str } from "./api";
import { useFeed } from "./feed";
import { Button, Card, Heading, Muted, SectionHeader } from "./ui";

export function NoticesBoard({ title }: { title?: string }) {
  const { notices, feed } = useFeed();
  const items = notices.length ? notices : feed?.notices ?? [];
  if (!items.length) return null;
  return (
    <>
      <SectionHeader title={title || "Notice board"} />
      {items.map((item) => (
        <Card key={str(item.id)}>
          <Heading>{str(item.title)}</Heading>
          <Muted>
            {str(item.date)} {str(item.category) ? `· ${str(item.category)}` : ""} {str(item.priority) === "high" ? "· Priority" : ""}
          </Muted>
          {str(item.description) ? <Muted>{str(item.description)}</Muted> : null}
          {str(item.attachment) ? (
            <Button
              kind="ghost"
              icon="document-outline"
              label={str(item.fileName, "Open attachment")}
              onPress={() => void Linking.openURL(`${getApiBase()}/api/notices/${str(item.id)}/file`)}
            />
          ) : null}
        </Card>
      ))}
    </>
  );
}
