"use client";

import { useState } from "react";
import type { User } from "@/types";
import { Button, Field, Panel, SelectInput, TextArea, TextInput } from "@/components/admin/AdminUI";
import { sendEmail, sendPeopleEmail } from "@/lib/admin-store";
import { senderName, staffReplyTo } from "@/lib/account-mail";

type Mode = "selected" | "all" | "other";

/** Email one customer, ticked customers, everyone in the list, or any other address. */
export function EmailComposer({ accounts, selected }: { accounts: User[]; selected: User[] }) {
  const [mode, setMode] = useState<Mode>("selected");
  const [other, setOther] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");

  const send = () => {
    const title = subject.trim();
    const text = body.trim();
    if (!title || !text) return setNote("Add a subject and message.");
    const from = senderName();
    if (mode === "other") {
      const list = [...new Set(other.split(/[\s,;]+/).map((item) => item.trim().toLowerCase()).filter(Boolean))];
      const bad = list.filter((item) => !/^\S+@\S+\.\S+$/.test(item));
      if (bad.length) return setNote(`Check these addresses: ${bad.join(", ")}`);
      if (!list.length) return setNote("Add at least one email address.");
      const replyTo = staffReplyTo();
      for (const to of list) {
        sendEmail({ to, subject: title, template: "custom", body: text.split("{name}").join("there"), replyTo, fromName: from });
      }
      setNote(`Queued ${list.length} email${list.length === 1 ? "" : "s"} from "${from}".`);
    } else {
      const list = mode === "all" ? accounts : selected;
      if (!list.length) {
        return setNote(mode === "selected" ? "Tick customers in the list first, or choose All customers in the list." : "No customers to email.");
      }
      if (list.length > 50 && !window.confirm(`Send this email to ${list.length} customers?`)) return;
      const count = sendPeopleEmail(list, title, text);
      setNote(`Queued ${count} email${count === 1 ? "" : "s"} from "${from}".`);
    }
    setSubject("");
    setBody("");
  };

  return (
    <Panel
      title="Email customers"
      description={`Sent as "${senderName()}". Write {name} to put each customer's name in the message.`}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Send to">
          <SelectInput value={mode} onChange={(event) => setMode(event.target.value as Mode)}>
            <option value="selected">Ticked customers ({selected.length})</option>
            <option value="all">All customers in the list ({accounts.length})</option>
            <option value="other">Other email addresses</option>
          </SelectInput>
        </Field>
        {mode === "other" ? (
          <Field label="Email addresses (comma or new line)">
            <TextInput value={other} onChange={(event) => setOther(event.target.value)} placeholder="name@example.com, other@example.com" />
          </Field>
        ) : null}
        <div className="sm:col-span-2">
          <Field label="Subject">
            <TextInput value={subject} onChange={(event) => setSubject(event.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Message">
            <TextArea rows={6} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Dear {name}, ..." />
          </Field>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={send}>Send email</Button>
        {note ? <p className="text-sm text-text-muted">{note}</p> : null}
      </div>
    </Panel>
  );
}
