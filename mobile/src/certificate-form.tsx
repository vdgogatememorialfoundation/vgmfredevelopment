import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { str, verifyCertificate } from "./api";
import { Banner, Button, Card, Field, PageHeader, Screen } from "./ui";

export function CertificateForm() {
  const params = useLocalSearchParams<{ q?: string }>();
  const [number, setNumber] = useState(String(params.q ?? ""));
  const [result, setResult] = useState("");
  const [tone, setTone] = useState<"note" | "error" | "success">("note");
  const [busy, setBusy] = useState(false);
  return (
    <Screen>
      <PageHeader kicker="Verify" title="Certificate verification" subtitle="Look up a Foundation workshop, fellowship or seminar certificate number." />
      <Card>
        <Field label="Certificate number" value={number} onChange={setNumber} placeholder="e.g. VGMF-2025-PN-034" />
        <Button
          icon="ribbon-outline"
          label={busy ? "Checking…" : "Verify & authenticate"}
          disabled={busy}
          onPress={async () => {
            if (!number.trim()) {
              setTone("error");
              setResult("Enter a certificate number.");
              return;
            }
            setBusy(true);
            try {
              const data = await verifyCertificate(number.trim());
              if (data.verified) {
                const certificate = data.certificate ?? {};
                setTone("success");
                setResult(`Verified${data.sourceLabel ? ` (${data.sourceLabel})` : ""}. ${str(certificate.holderName || certificate.name)}`);
              } else {
                setTone("error");
                setResult(str(data.error, "This certificate could not be verified."));
              }
            } catch (err) {
              setTone("error");
              setResult((err as Error).message || "Could not reach certificate verification.");
            } finally {
              setBusy(false);
            }
          }}
        />
      </Card>
      {result ? <Banner text={result} tone={tone} /> : null}
    </Screen>
  );
}
