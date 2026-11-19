import { useState } from "react";
import { money, str, trackApplication, type TrackedApplication } from "../src/api";
import { Banner, Button, Card, Field, Heading, Muted, PageHeader, Screen } from "../src/ui";

const PORTALS: Record<string, string> = { seminar: "Seminar", autism: "Autism", fellowship: "Fellowship" };

/** Seminar, Autism and Fellowship application tracking, the same lookup as the website. */
export default function ApplicationStatusScreen() {
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [found, setFound] = useState<TrackedApplication | null>(null);

  const search = async () => {
    setBusy(true);
    setNote("");
    setFound(null);
    try {
      const ticket = await trackApplication(id);
      if (ticket) setFound(ticket);
      else setNote("No application matches that ID. Check the ID in your confirmation email.");
    } catch (error) {
      setNote((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <PageHeader kicker="Track application" title="Application status" subtitle="Track Seminar, Autism and Fellowship applications using your Application ID." />
      <Field label="Application ID" value={id} onChange={setId} autoCapitalize="none" />
      <Button label={busy ? "Looking up…" : "Track"} disabled={busy || !id.trim()} onPress={() => void search()} />
      <Banner text={note} tone="error" />
      {found ? (
        <Card featured>
          <Muted>{PORTALS[str(found.portal)] ?? str(found.portal)}</Muted>
          <Heading>{str(found.eventName, "Application")}</Heading>
          <Muted>Application {str(found.applicationNo, str(found.id))}</Muted>
          <Muted>Status · {str(found.status)}</Muted>
          {str(found.paymentStatus) ? <Muted>Payment · {str(found.paymentStatus)}{Number(found.amount) > 0 ? ` · ${money(Number(found.amount))}` : ""}</Muted> : null}
        </Card>
      ) : null}
    </Screen>
  );
}
