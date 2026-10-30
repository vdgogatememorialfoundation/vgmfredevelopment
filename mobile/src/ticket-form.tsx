import { useEffect, useState } from "react";
import { Text } from "react-native";
import { createTicket, listTickets, str, type Row } from "./api";
import { useAuth } from "./auth";
import { Banner, Button, Card, Field, Heading, Muted, Screen, Title } from "./ui";

export function TicketForm({ heading = "Support", embedded = false }: { heading?: string; embedded?: boolean }) {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const [tone, setTone] = useState<"note" | "error" | "success">("note");
  const [busy, setBusy] = useState(false);
  const [tickets, setTickets] = useState<Row[]>([]);
  const requestName = name || session?.name || "";
  const requestEmail = session?.email || email;
  const inbox = session ? tickets : [];

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

  const form = (
    <>
      <Title>{heading}</Title>
      <Muted>We reply by email. Sign in to see tickets already opened from this app.</Muted>
      <Banner text={note} tone={tone} />
      {inbox.map((item) => (
        <Card key={str(item.id)}>
          <Heading>{str(item.subject)}</Heading>
          <Muted>
            {str(item.status)} · {str(item.id)}
          </Muted>
        </Card>
      ))}
      <Field label="Your name" value={requestName} onChange={setName} autoCapitalize="words" />
      {session ? <Muted>{session.email}</Muted> : <Field label="Email" value={requestEmail} onChange={setEmail} keyboard="email-address" />}
      <Field label="Phone (optional)" value={phone} onChange={setPhone} keyboard="phone-pad" />
      <Field label="Subject" value={subject} onChange={setSubject} autoCapitalize="sentences" />
      <Field label="Message" value={body} onChange={setBody} multiline autoCapitalize="sentences" />
      <Button
        label={busy ? "Sending…" : "Send ticket"}
        disabled={busy}
        onPress={async () => {
          if (!requestName.trim() || (!session && !requestEmail.trim()) || !subject.trim() || !body.trim()) {
            setTone("error");
            setNote("Enter your name, email, subject and message.");
            return;
          }
          setBusy(true);
          try {
            const ticket = await createTicket({
              name: requestName,
              email: requestEmail,
              phone,
              subject,
              body,
            });
            setSubject("");
            setBody("");
            setTone("success");
            setNote(`Ticket ${String(ticket.id ?? "")} opened. We will email updates.`);
            if (session) setTickets(await listTickets());
          } catch (err) {
            setTone("error");
            setNote((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
  if (embedded) return form;
  return <Screen>{form}</Screen>;
}
