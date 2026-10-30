import { Linking, Text } from "react-native";
import { getApiBase, str } from "./api";
import { useFeed } from "./feed";
import { Button, Card, Empty, Loading, Muted, Screen, Title } from "./ui";

export function NoticesList() {
  const { notices, feed, loading, refresh } = useFeed();
  const items = notices.length ? notices : feed?.notices ?? [];
  if (loading && !feed) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Title>Notice board</Title>
      {items.map((item) => (
        <Card key={str(item.id)}>
          <Text style={{ fontWeight: "700", fontSize: 16 }}>{str(item.title)}</Text>
          <Muted>
            {str(item.date)} {str(item.category) ? `· ${str(item.category)}` : ""}
          </Muted>
          <Muted>{str(item.description)}</Muted>
          {str(item.attachment) || str(item.id) ? (
            <Button
              kind="ghost"
              label={str(item.fileName, "Open attachment")}
              onPress={() => void Linking.openURL(`${getApiBase()}/api/notices/${str(item.id)}/file`)}
            />
          ) : null}
        </Card>
      ))}
      {!items.length ? <Empty label="Notices appear here after they are published." /> : null}
    </Screen>
  );
}
