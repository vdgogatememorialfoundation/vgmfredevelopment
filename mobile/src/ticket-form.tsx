import { useEffect, useState } from "react";
import { Text } from "react-native";
import { createTicket, listTickets, str, type Row } from "./api";
import { useAuth } from "./auth";
import { Banner, Button, Card, Field, Muted, Screen, Title } from "./ui";

export function TicketForm({ heading = "Support ticket", embedded = false }: { heading?: string; embedded?: boolean }) {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
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
        if (!cancelled) setNote((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const form = (
    <>
      <Title>{heading}</Title>
      <Muted>
        Mobile tickets are stored on the mobile API for this email. Website account tickets stay in that browser and are not
        listed here. Signed-in staff and support flavors still only see this inbox — there is no server-side admin role on
        mobile OTP sessions.
      </Muted>
      <Banner text={note} />
      {inbox.map((item) => (
        <Card key={str(item.id)}>
          <Text style={{ fontWeight: "700" }}>{str(item.subject)}</Text>
          <Muted>
            {str(item.id)} · {str(item.status)}
          </Muted>
        </Card>
      ))}
      <Field label="Your name" value={requestName} onChange={setName} />
      {session ? <Muted>{session.email}</Muted> : <Field label="Email" value={requestEmail} onChange={setEmail} keyboard="email-address" />}
      <Field label="Phone (optional)" value={phone} onChange={setPhone} keyboard="phone-pad" />
      <Field label="Subject" value={subject} onChange={setSubject} />
      <Field label="Message" value={body} onChange={setBody} multiline />
      <Button
        label={busy ? "Sending…" : "Send ticket"}
        disabled={busy}
        onPress={async () => {
          if (!requestName.trim() || (!session && !requestEmail.trim()) || !subject.trim() || !body.trim()) {
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
            setNote(`Ticket ${String(ticket.id ?? "")} opened on the mobile API. We will email updates.`);
            if (session) setTickets(await listTickets());
          } catch (err) {
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
