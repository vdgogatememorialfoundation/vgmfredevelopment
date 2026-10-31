import { useEffect, useState } from "react";
import { router } from "expo-router";
import { createTicket, listTickets, str, type Row } from "./api";
import { useAuth } from "./auth";
import { Banner, Button, Card, Field, Heading, Muted, PageHeader, Screen } from "./ui";

export function TicketForm({ heading = "Support tickets" }: { heading?: string }) {
  const { session } = useAuth();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const [tone, setTone] = useState<"note" | "error" | "success">("note");
  const [busy, setBusy] = useState(false);
  const [tickets, setTickets] = useState<Row[]>([]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    void listTickets()
      .then((rows) => {
        if (!cancelled) setTickets(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setTone("error");
          setNote((err as Error).message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (!session) {
    return (
      <Screen>
        <PageHeader
          kicker="Support"
          title="Raise a ticket from your dashboard"
          subtitle="Support tickets stay with your Foundation account. Sign in, then open Go to my tickets."
        />
        <Card>
          <Muted>Tickets are not opened from Contact. Use your signed-in account so replies stay with you.</Muted>
          <Button icon="log-in-outline" label="Sign in to raise a ticket" onPress={() => router.push("/login")} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader kicker="Account" title={heading} subtitle="Raise and track Foundation support tickets from this signed-in account." />
      <Banner text={note} tone={tone} />
      {tickets.map((item) => (
        <Card key={str(item.id)}>
          <Heading>{str(item.subject)}</Heading>
          <Muted>
            {str(item.status)} · {str(item.id)}
          </Muted>
        </Card>
      ))}
      {!tickets.length ? <Muted>No tickets for this account yet.</Muted> : null}
      <Card>
        <Muted>{session.email}</Muted>
        <Field label="Subject" value={subject} onChange={setSubject} autoCapitalize="sentences" />
        <Field label="Message" value={body} onChange={setBody} multiline autoCapitalize="sentences" />
        <Button
          icon="send-outline"
          label={busy ? "Sending…" : "Send ticket"}
          disabled={busy}
          onPress={async () => {
            if (!subject.trim() || !body.trim()) {
              setTone("error");
              setNote("Add a subject and a message.");
              return;
            }
            setBusy(true);
            try {
              const ticket = await createTicket({
                name: session.name,
                email: session.email,
                subject,
                body,
              });
              setSubject("");
              setBody("");
              setTone("success");
              setNote(`Ticket ${String(ticket.id ?? "")} opened. We will email updates.`);
              setTickets(await listTickets());
            } catch (err) {
              setTone("error");
              setNote((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </Card>
    </Screen>
  );
}
