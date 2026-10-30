import { useState } from "react";
import { createTicket, getSession } from "./api";
import { Banner, Button, Field, Screen, Title } from "./ui";

export function TicketForm({ heading = "Support ticket", embedded = false }: { heading?: string; embedded?: boolean }) {
  const session = getSession();
  const [name, setName] = useState(session?.name ?? "");
  const [email, setEmail] = useState(session?.email ?? "");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const form = (
    <>
      <Title>{heading}</Title>
      <Banner text={note} />
      <Field label="Your name" value={name} onChange={setName} />
      <Field label="Email" value={email} onChange={setEmail} keyboard="email-address" />
      <Field label="Phone (optional)" value={phone} onChange={setPhone} keyboard="phone-pad" />
      <Field label="Subject" value={subject} onChange={setSubject} />
      <Field label="Message" value={body} onChange={setBody} multiline />
      <Button
        label="Send ticket"
        onPress={async () => {
          try {
            if (!name.trim() || !email.trim() || !subject.trim() || !body.trim()) {
              setNote("Enter your name, email, subject and message.");
              return;
            }
            const ticket = await createTicket({ name, email: email || session?.email || "", phone, subject, body });
            setSubject("");
            setBody("");
            setNote(`Ticket ${String(ticket.id ?? "")} opened. We will email updates.`);
          } catch (err) {
            setNote((err as Error).message);
          }
        }}
      />
    </>
  );
  if (embedded) return form;
  return <Screen>{form}</Screen>;
}
