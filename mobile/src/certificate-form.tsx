import { useState } from "react";
import { str, verifyCertificate } from "./api";
import { Banner, Button, Field, Screen, Title } from "./ui";

export function CertificateForm() {
  const [number, setNumber] = useState("");
  const [result, setResult] = useState("");
  return (
    <Screen>
      <Title>Certificate verification</Title>
      <Field label="Certificate number" value={number} onChange={setNumber} />
      <Button
        label="Verify"
        onPress={async () => {
          const data = await verifyCertificate(number);
          if (data.verified) {
            const certificate = data.certificate ?? {};
            setResult(`Verified${data.sourceLabel ? ` (${data.sourceLabel})` : ""}. ${str(certificate.holderName || certificate.name)}`);
          } else {
            setResult(str(data.error, "This certificate could not be verified."));
          }
        }}
      />
      {result ? <Banner text={result} /> : null}
    </Screen>
  );
}
