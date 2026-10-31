import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { askChat } from "../src/api";
import { useAuth } from "../src/auth";
import { useTheme } from "../src/theme";
import { Banner, Button, Field, Kicker, Muted, PageHeader, Screen } from "../src/ui";

type Line = { id: string; from: "you" | "vgmf"; text: string };

export default function ChatScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lines, setLines] = useState<Line[]>([
    {
      id: "welcome",
      from: "vgmf",
      text: `Namaste${session?.name ? `, ${session.name}` : ""}. Ask about events, publications, certificates, clinics, sign-in or the Foundation.`,
    },
  ]);

  return (
    <Screen>
      <PageHeader kicker="Foundation desk" title="Chat" subtitle="Answers from the same Foundation knowledge used on the website. Raise a Support ticket if you need a person." />
      <Banner text={error} tone="error" />
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
          <Kicker>{line.from === "you" ? "You" : "VGMF"}</Kicker>
          <Text style={{ color: line.from === "you" ? theme.colors.onPrimary : theme.colors.text, lineHeight: 21 }}>{line.text}</Text>
        </View>
      ))}
      <Field label="Your question" value={message} onChange={setMessage} multiline placeholder="Ask about events, shop, certificates…" />
      <Button
        icon="send-outline"
        label={busy ? "Sending…" : "Send"}
        disabled={busy || !message.trim()}
        onPress={async () => {
          const text = message.trim();
          setBusy(true);
          setError("");
          setMessage("");
          setLines((current) => [...current, { id: `you-${Date.now()}`, from: "you", text }]);
          try {
            const reply = await askChat(text);
            setLines((current) => [...current, { id: `vgmf-${Date.now()}`, from: "vgmf", text: reply }]);
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
    </Screen>
  );
}
