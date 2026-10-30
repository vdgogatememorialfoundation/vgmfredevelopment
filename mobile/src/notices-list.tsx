import { Linking, Text } from "react-native";
import { getApiBase, str } from "./api";
import { useFeed } from "./feed";
import { Button, Card, Muted, Title } from "./ui";

export function NoticesBoard({ title }: { title?: string }) {
  const { notices, feed } = useFeed();
  const items = notices.length ? notices : feed?.notices ?? [];
  if (!items.length) return null;
  return (
    <>
      <Title>{title || "Notice board"}</Title>
      {items.map((item) => (
        <Card key={str(item.id)}>
          <Text style={{ fontWeight: "700", fontSize: 16 }}>{str(item.title)}</Text>
          <Muted>
            {str(item.date)} {str(item.category) ? `· ${str(item.category)}` : ""} {str(item.priority) === "high" ? "· Priority" : ""}
          </Muted>
          {str(item.description) ? <Muted>{str(item.description)}</Muted> : null}
          {str(item.attachment) ? (
            <Button
              kind="ghost"
              label={str(item.fileName, "Open attachment")}
              onPress={() => void Linking.openURL(`${getApiBase()}/api/notices/${str(item.id)}/file`)}
            />
          ) : null}
        </Card>
      ))}
    </>
  );
}
