import { useCallback, useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { formatDate, listTickets, replyTicket, str, type Row } from "../../src/api";
import { useAuth } from "../../src/auth";
import { Banner, Body, Button, Card, Empty, Field, Heading, Loading, Muted, PageHeader, Screen, StatusChip } from "../../src/ui";

type Reply = { at?: string; from?: string; text?: string };

export default function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticketId = String(id ?? "");
  const { session } = useAuth();
  const [ticket, setTicket] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [tone, setTone] = useState<"note" | "error" | "success">("note");

  const load = useCallback(async () => {
    try {
      const rows = await listTickets();
      setTicket(rows.find((row) => str(row.id) === ticketId) ?? null);
    } catch (error) {
      setTone("error");
      setNote((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    if (!session) {
      router.replace("/login");
      return;
    }
    void load();
  }, [session, load]);

  const send = async () => {
    const text = reply.trim();
    if (!text) {
      setTone("error");
      setNote("Write a reply first.");
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const next = await replyTicket(ticketId, text);
      setTicket(next);
      setReply("");
      setTone("success");
      setNote("Reply sent. The support desk will answer here.");
    } catch (error) {
      setTone("error");
      setNote((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading label="Opening the ticket…" />;
  if (!ticket) {
    return (
      <Screen>
        <Empty icon="help-buoy-outline" label="This ticket was not found on your account." actionLabel="My tickets" onAction={() => router.replace("/account/tickets")} />
      </Screen>
    );
  }

  const replies = (Array.isArray(ticket.responses) ? ticket.responses : []) as Reply[];
  const closed = ["Resolved", "Closed"].includes(str(ticket.status));

  return (
    <Screen>
      <PageHeader kicker={`Ticket ${str(ticket.id)}`} title={str(ticket.subject, "Support ticket")} subtitle={`Raised ${formatDate(ticket.createdAt)}`} />
      <StatusChip label={str(ticket.status, "Open")} />
      <Card>
        <Muted>{str(ticket.name, "You")} · {formatDate(ticket.createdAt)}</Muted>
        <Body>{str(ticket.body)}</Body>
      </Card>
      {replies.map((item, index) => (
        <Card key={`${item.at ?? ""}-${index}`} featured={item.from !== ticket.name}>
          <Heading>{str(item.from, "Support desk")}</Heading>
          <Muted>{formatDate(item.at)}</Muted>
          <Body>{str(item.text)}</Body>
        </Card>
      ))}
      {!replies.length ? <Muted>No replies yet. The support desk will answer here.</Muted> : null}
      <Banner text={note} tone={tone} />
      {closed ? (
        <Muted>This ticket is marked {str(ticket.status).toLowerCase()}. You can still send a reply to the desk.</Muted>
      ) : null}
      <Field label="Your reply" value={reply} onChange={setReply} multiline autoCapitalize="sentences" placeholder="Type your message" />
      <Button icon="send-outline" label={busy ? "Sending…" : "Send reply"} disabled={busy} onPress={() => void send()} />
      <Button kind="ghost" icon="refresh-outline" label="Refresh conversation" onPress={() => void load()} />
    </Screen>
  );
}
