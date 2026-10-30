import { useState } from "react";
import { str, verifyCertificate } from "./api";
import { Banner, Button, Field, Muted, Screen, Title } from "./ui";

export function CertificateForm() {
  const [number, setNumber] = useState("");
  const [result, setResult] = useState("");
  const [tone, setTone] = useState<"note" | "error" | "success">("note");
  const [busy, setBusy] = useState(false);
  return (
    <Screen>
      <Title>Certificate verification</Title>
      <Muted>Look up a Foundation certificate number.</Muted>
      <Field label="Certificate number" value={number} onChange={setNumber} />
      <Button
        label={busy ? "Checking…" : "Verify"}
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
      {result ? <Banner text={result} tone={tone} /> : null}
    </Screen>
  );
}
