import { useEffect, useState } from "react";
import { Image, Linking, Pressable, Text, View } from "react-native";
import { askChat, liveChatAction, listLiveChats, mediaUrl, str, type Row } from "../src/api";
import { useAuth } from "../src/auth";
import { useTheme } from "../src/theme";
import { Banner, Button, Field, Kicker, Muted, PageHeader, Screen } from "../src/ui";

type Line = {
  id: string;
  from: "you" | "staff" | "vgmf";
  name: string;
  text: string;
  kind?: string;
  mediaUrl?: string;
};

function asLines(thread?: Row | null): Line[] {
  const messages = Array.isArray(thread?.messages) ? (thread?.messages as Row[]) : [];
  return messages.map((message) => ({
    id: str(message.id),
    from: str(message.from) === "staff" ? "staff" : "you",
    name: str(message.name, str(message.from) === "staff" ? "Foundation Support" : "You"),
    text: str(message.text),
    kind: str(message.kind, "text"),
    mediaUrl: str(message.mediaUrl) || undefined,
  }));
}

export default function ChatScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [thread, setThread] = useState<Row | null>(null);
  const [lines, setLines] = useState<Line[]>([]);

  const applyThread = (next?: Row | null) => {
    if (!next) return;
    setThread(next);
    setLines(asLines(next));
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const threads = await listLiveChats();
        if (cancelled) return;
        const mine =
          threads.find((item) => str(item.status) !== "closed") ||
          threads[0] ||
          null;
        if (mine) applyThread(mine);
      } catch {
        /* keep the local welcome until the desk is reachable */
      }
    };
    void load();
    const timer = setInterval(() => void load(), 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [session?.email]);

  const sendLive = async (text: string) => {
    const reply = await liveChatAction("post", {
      threadId: str(thread?.id) || undefined,
      name: session?.name || "Member",
      email: session?.email || "",
      text,
      page: "app",
    });
    applyThread(reply.thread ?? null);
  };

  return (
    <Screen>
      <PageHeader
        kicker="Foundation desk"
        title="Live chat"
        subtitle="Write to Foundation Support. When an executive takes the chat, their name and greeting appear here. Every chat is recorded."
      />
      <Banner text={error} tone="error" />
      {str(thread?.assignedName) ? (
        <Muted>
          {str(thread?.status) === "closed" ? "Closed" : "With"} · {str(thread?.assignedName)}
          {str(thread?.department) ? ` · ${str(thread?.department)}` : ""}
        </Muted>
      ) : (
        <Muted>Waiting for the next available support executive.</Muted>
      )}
      {!lines.length ? (
        <View
          style={{
            alignSelf: "flex-start",
            maxWidth: "88%",
            backgroundColor: theme.colors.paper,
            borderColor: theme.colors.border,
            borderWidth: 1,
            borderRadius: 16,
            padding: 12,
            marginBottom: 10,
          }}
        >
          <Kicker>Foundation Support</Kicker>
          <Text style={{ color: theme.colors.text, lineHeight: 21 }}>
            Namaste{session?.name ? `, ${session.name}` : ""}. Send a message and a support executive will take this chat. Their name and greeting will appear here.
          </Text>
        </View>
      ) : null}
      {lines.map((line) => (
        <View
          key={line.id}
          style={{
            alignSelf: line.from === "you" ? "flex-end" : "flex-start",
            maxWidth: "88%",
            backgroundColor: line.from === "you" ? theme.colors.primary : theme.colors.paper,
            borderColor: theme.colors.border,
            borderWidth: 1,
            borderRadius: 16,
            padding: 12,
            marginBottom: 10,
          }}
        >
          <Kicker>{line.from === "you" ? "You" : line.name}</Kicker>
          {line.text ? (
            <Text style={{ color: line.from === "you" ? theme.colors.onPrimary : theme.colors.text, lineHeight: 21 }}>{line.text}</Text>
          ) : null}
          {line.kind === "image" && line.mediaUrl ? (
            <Image source={{ uri: mediaUrl(line.mediaUrl) }} style={{ width: 220, height: 160, borderRadius: 12, marginTop: 8 }} resizeMode="cover" />
          ) : null}
          {(line.kind === "video" || line.kind === "voice") && line.mediaUrl ? (
            <Pressable onPress={() => void Linking.openURL(mediaUrl(line.mediaUrl))} style={{ marginTop: 8 }}>
              <Text style={{ color: line.from === "you" ? theme.colors.onPrimary : theme.colors.primary, fontWeight: "700" }}>
                {line.kind === "voice" ? "Play voice message" : "Play video"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      <Field label="Message to Support" value={message} onChange={setMessage} multiline placeholder="Write to Foundation Support…" />
      <Button
        icon="send-outline"
        label={busy ? "Sending…" : "Send to Support"}
        disabled={busy || !message.trim()}
        onPress={async () => {
          const text = message.trim();
          setBusy(true);
          setError("");
          setMessage("");
          setLines((current) => [...current, { id: `you-${Date.now()}`, from: "you", name: "You", text }]);
          try {
            await sendLive(text);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        {["Next event", "Shop publications", "Verify a certificate", "Sign in help"].map((prompt) => (
          <Pressable
            key={prompt}
            onPress={() => setMessage(prompt)}
            style={{ backgroundColor: theme.colors.paper, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}
          >
            <Muted>{prompt}</Muted>
          </Pressable>
        ))}
      </View>
      <Button
        kind="ghost"
        icon="help-circle-outline"
        label="Ask the knowledge desk"
        disabled={busy || !message.trim()}
        onPress={async () => {
          const text = message.trim();
          setBusy(true);
          setError("");
          setMessage("");
          setLines((current) => [...current, { id: `you-${Date.now()}`, from: "you", name: "You", text }]);
          try {
            const reply = await askChat(text);
            setLines((current) => [...current, { id: `vgmf-${Date.now()}`, from: "vgmf", name: "VGMF", text: reply }]);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}
