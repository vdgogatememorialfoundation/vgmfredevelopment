import { useState } from "react";
import { str, verifyCertificate } from "./api";
import { Banner, Button, Field, Muted, Screen, Title } from "./ui";

export function CertificateForm() {
  const [number, setNumber] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Screen>
      <Title>Certificate verification</Title>
      <Muted>Look up a Foundation certificate number. This uses the public website verification API.</Muted>
      <Field label="Certificate number" value={number} onChange={setNumber} />
      <Button
        label={busy ? "Checking…" : "Verify"}
        disabled={busy}
        onPress={async () => {
          if (!number.trim()) {
            setResult("Enter a certificate number.");
            return;
          }
          setBusy(true);
          try {
            const data = await verifyCertificate(number.trim());
            if (data.verified) {
              const certificate = data.certificate ?? {};
              setResult(
                `Verified${data.sourceLabel ? ` (${data.sourceLabel})` : ""}. ${str(certificate.holderName || certificate.name)}`
              );
            } else {
              setResult(str(data.error, "This certificate could not be verified."));
            }
          } catch (err) {
            setResult((err as Error).message || "Could not reach certificate verification.");
          } finally {
            setBusy(false);
          }
        }}
      />
      {result ? <Banner text={result} /> : null}
    </Screen>
  );
}
