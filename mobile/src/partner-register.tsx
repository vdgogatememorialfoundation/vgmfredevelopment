import { useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { fetchRegistrationForm, submitRegistration, type RegistrationField } from "./api";
import { useAuth } from "./auth";
import { useTheme } from "./theme";
import { Banner, Button, Card, Chip, Field, Heading, Muted } from "./ui";

function optionList(field: RegistrationField) {
  return (field.options ?? [])
    .map((option) => (typeof option === "string" ? { value: option, label: option } : { value: String(option.value || option.label || ""), label: String(option.label || option.value || "") }))
    .filter((option) => option.value);
}

/** The website's seminar/autism registration form, filled and sent from inside the app. */
export function PartnerRegister({ portal, seminarId, phase, portalUrl }: { portal: string; seminarId: number; phase: "pre" | "main"; portalUrl?: string }) {
  const theme = useTheme();
  const { session } = useAuth();
  const [fields, setFields] = useState<RegistrationField[] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchRegistrationForm(portal, seminarId, phase)
      .then((next) => {
        if (cancelled) return;
        setFields(next);
        const who = (session ?? {}) as Record<string, unknown>;
        const name = String(who.name ?? "").trim().split(/\s+/);
        setValues((current) => ({
          ...current,
          fname: current.fname || String(who.firstName ?? name[0] ?? ""),
          lname: current.lname || String(who.lastName ?? name.slice(1).join(" ")),
          email: current.email || String(who.email ?? ""),
          phone: current.phone || String(who.phone ?? ""),
        }));
      })
      .catch((error) => {
        if (!cancelled) {
          setNote((error as Error).message);
          setFields([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [phase, portal, seminarId, session]);

  if (!session) {
    return (
      <Card featured>
        <Heading>Register for this event</Heading>
        <Muted>Sign in to register. Your application and its status then appear under My registrations.</Muted>
        <Button icon="log-in-outline" label="Sign in to register" onPress={() => router.push("/login")} />
      </Card>
    );
  }
  if (!fields) return <Muted>Loading the registration form…</Muted>;
  if (done) {
    return (
      <Card featured>
        <Heading>Registration received</Heading>
        <Muted>{done}</Muted>
        <Button icon="git-commit-outline" label="Track my application" onPress={() => router.push("/account/registrations")} />
      </Card>
    );
  }

  const needsFile = fields.some((field) => (field.type || "").toLowerCase() === "file" || field.key === "certificate");
  const fileRequired = fields.some((field) => ((field.type || "").toLowerCase() === "file" || field.key === "certificate") && field.required);
  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const missing = fields.filter((field) => field.required && (field.type || "").toLowerCase() !== "file" && field.key !== "certificate" && !String(values[field.key ?? ""] ?? "").trim());

  const submit = async () => {
    if (missing.length) {
      setNote(`Please fill ${missing.map((field) => field.label || field.key).join(", ")}.`);
      return;
    }
    setBusy(true);
    setNote("");
    try {
      setDone(await submitRegistration({ portal, seminarId, phase, values }));
    } catch (error) {
      setNote((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card featured>
      <Heading>{phase === "pre" ? "Pre-registration" : "Register"}</Heading>
      <Muted>Fill in your details. You can follow your application under My registrations.</Muted>
      <View style={{ height: 12 }} />
      {fields.map((field) => {
        const key = field.key ?? "";
        const type = (field.type || "text").toLowerCase();
        const label = `${field.label || key}${field.required ? " *" : ""}`;
        if (type === "file" || key === "certificate") return null;
        if (type === "checkbox") {
          const on = values[key] === "1" || values[key] === "true";
          return (
            <Pressable key={key} onPress={() => set(key, on ? "" : "1")} style={{ flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 12 }} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: theme.colors.primary, backgroundColor: on ? theme.colors.primary : theme.colors.paper, alignItems: "center", justifyContent: "center" }}>
                {on ? <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>✓</Text> : null}
              </View>
              <Text style={{ flex: 1, color: theme.colors.text, fontSize: 14 }}>{label}</Text>
            </Pressable>
          );
        }
        if (type === "select" || type === "radio") {
          return (
            <View key={key} style={{ marginBottom: 12 }}>
              <Text style={{ color: theme.colors.muted, marginBottom: 6, fontSize: 12, fontWeight: "700" }}>{label}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {optionList(field).map((option) => (
                  <Chip key={option.value} label={option.label} selected={values[key] === option.value} onPress={() => set(key, option.value)} />
                ))}
              </View>
            </View>
          );
        }
        return (
          <Field
            key={key}
            label={label}
            value={values[key] ?? ""}
            onChange={(value) => set(key, value)}
            multiline={type === "textarea"}
            keyboard={type === "email" ? "email-address" : type === "tel" ? "phone-pad" : type === "number" ? "numeric" : "default"}
            autoCapitalize={type === "email" ? "none" : "words"}
            placeholder={type === "date" ? "YYYY-MM-DD" : undefined}
          />
        );
      })}
      {needsFile ? (
        <Muted>{fileRequired ? "This form needs a certificate upload, which is done on the event portal." : "A certificate upload is optional and can be added on the event portal."}</Muted>
      ) : null}
      <Banner text={note} tone="error" />
      {fileRequired && portalUrl ? (
        <Button icon="cloud-upload-outline" label="Register on the event portal" onPress={() => void Linking.openURL(portalUrl)} />
      ) : (
        <Button icon="checkmark-circle-outline" label={busy ? "Sending…" : "Submit registration"} disabled={busy} onPress={() => void submit()} />
      )}
    </Card>
  );
}
