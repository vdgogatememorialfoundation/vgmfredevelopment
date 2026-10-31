import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  forgotPassword,
  loginAccount,
  registerAccount,
  resetPassword,
  verifyLogin,
  verifyRegister,
  type Session,
} from "../src/api";
import { useAuth } from "../src/auth";
import { GoldBanner } from "../src/chrome";
import { SITE } from "../src/site-content";
import { useTheme } from "../src/theme";
import { Banner, BrandMark, Button, Card, Chip, Field, Kicker, Muted, Screen } from "../src/ui";

const SALUTATIONS = ["Mr.", "Mrs.", "Ms.", "Dr.", "Vaidya", "Prof.", "Shri", "Smt."];

type Tab = "signup" | "signin";
type SignInMethod = "password" | "otp";
type SignUpStep = "details" | "email" | "success";
type SignInStep = "identifier" | "otp" | "forgot" | "forgot-code" | "forgot-password" | "complete";

export default function LoginScreen() {
  const theme = useTheme();
  const { setSession } = useAuth();
  const [tab, setTab] = useState<Tab>("signup");
  const [note, setNote] = useState("");
  const [tone, setTone] = useState<"note" | "error" | "success">("note");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  const [salutation, setSalutation] = useState("Dr.");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [samePhone, setSamePhone] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [signUpStep, setSignUpStep] = useState<SignUpStep>("details");
  const [accountId, setAccountId] = useState("");
  const [created, setCreated] = useState<Session | null>(null);

  const [method, setMethod] = useState<SignInMethod>("otp");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [signInStep, setSignInStep] = useState<SignInStep>("identifier");
  const [otp, setOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");

  useEffect(() => {
    if (!wait) return;
    const timer = setInterval(() => setWait((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [wait]);

  const flash = (next: string, nextTone: typeof tone = "note") => {
    setNote(next);
    setTone(nextTone);
  };

  const details = () => ({
    salutation,
    firstName: firstName.trim(),
    middleName: middleName.trim(),
    lastName: lastName.trim(),
    email: email.trim(),
    phone: phone.trim(),
    whatsapp: (whatsapp || phone).trim(),
    alternatePhone: (samePhone ? phone : alternatePhone || phone).trim(),
  });

  return (
    <Screen>
      <GoldBanner text="Official Vaidya Gogate Memorial Foundation app" />
      <View style={{ alignItems: "center", marginTop: 4, marginBottom: 18 }}>
        <BrandMark name={SITE.shortName} size={72} />
        <Text style={{ marginTop: 14, color: theme.colors.primary, fontFamily: theme.fontFamily, fontSize: 20 }}>{SITE.nativeName}</Text>
        <Kicker>{SITE.shortName} Foundation</Kicker>
        <Text style={{ textAlign: "center", fontSize: 24, lineHeight: 30, fontWeight: "700", color: theme.colors.primary, fontFamily: theme.fontFamily, marginTop: 6 }}>
          One Foundation account
        </Text>
        <Muted>The same Create Account and Sign In used on the website — name, email, phone, OTP and a 12-digit Account ID.</Muted>
      </View>

      <View style={{ flexDirection: "row", backgroundColor: theme.colors.paper, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, padding: 5, marginBottom: 16 }}>
        {([
          ["signup", "Create Account"],
          ["signin", "Sign In"],
        ] as const).map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => {
              setTab(id);
              flash("");
            }}
            style={{
              flex: 1,
              borderRadius: 10,
              paddingVertical: 11,
              backgroundColor: tab === id ? theme.colors.primary : "transparent",
            }}
          >
            <Text style={{ textAlign: "center", fontWeight: "700", fontSize: 13, color: tab === id ? theme.colors.onPrimary : theme.colors.muted }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Banner text={note} tone={tone} />

      {tab === "signup" ? (
        signUpStep === "success" ? (
          <Card featured>
            <Kicker>Account created</Kicker>
            <Text style={{ fontSize: 22, fontWeight: "700", color: theme.colors.primary, fontFamily: theme.fontFamily }}>Welcome, {firstName}</Text>
            <Muted>Your Vaidya Gogate Memorial Foundation account has been created. Use this 12-digit Account ID on the website and in the app.</Muted>
            <View style={{ marginTop: 16, padding: 18, borderRadius: 16, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center" }}>
              <Kicker>Your Account ID</Kicker>
              <Text style={{ fontSize: 26, fontWeight: "800", letterSpacing: 2, color: theme.colors.primary }}>{accountId}</Text>
            </View>
            <Button icon="home-outline" label="Enter the Foundation" onPress={() => created && setSession(created)} />
          </Card>
        ) : signUpStep === "email" ? (
          <Card>
            <Kicker>Verify your email</Kicker>
            <Muted>We sent a verification code to {email}. You can resend after 1 minute.</Muted>
            <Field label="6-digit code" value={otp} onChange={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))} keyboard="numeric" placeholder="000000" />
            <Button
              icon="checkmark-outline"
              label={busy ? "Verifying…" : "Verify and create account"}
              disabled={busy || otp.length !== 6}
              onPress={async () => {
                setBusy(true);
                try {
                  const next = await verifyRegister({ ...details(), code: otp });
                  setAccountId(next.accountId || "");
                  setCreated(next);
                  setSignUpStep("success");
                  flash(next.message || `Your Account ID is ${next.accountId}.`, "success");
                } catch (err) {
                  flash((err as Error).message, "error");
                } finally {
                  setBusy(false);
                }
              }}
            />
            <Pressable
              disabled={wait > 0 || busy}
              onPress={async () => {
                setBusy(true);
                try {
                  const sent = await registerAccount(details());
                  setWait(60);
                  flash(sent.message || "A new code was sent.", "success");
                } catch (err) {
                  flash((err as Error).message, "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Muted>{wait > 0 ? `Resend code in ${wait}s` : "Resend code"}</Muted>
            </Pressable>
            <Button kind="ghost" label="Back to details" onPress={() => setSignUpStep("details")} />
          </Card>
        ) : (
          <Card>
            <Kicker>Create Account</Kicker>
            <Text style={{ fontSize: 20, fontWeight: "700", color: theme.colors.text, fontFamily: theme.fontFamily, marginBottom: 6 }}>Welcome to Vaidya Gogate Memorial Foundation</Text>
            <Muted>Create your account to register for events, manage tickets, shop orders and your profile. We verify the email with a one-time code. Each email and phone number can be used for only one account.</Muted>
            <View style={{ height: 12 }} />
            <Text style={{ color: theme.colors.muted, marginBottom: 6, fontSize: 12, fontWeight: "700" }}>Salutation</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {SALUTATIONS.map((item) => (
                <Chip key={item} label={item} selected={salutation === item} onPress={() => setSalutation(item)} />
              ))}
            </View>
            <Field label="First name" value={firstName} onChange={setFirstName} autoCapitalize="words" placeholder="Enter first name" />
            <Field label="Middle name" value={middleName} onChange={setMiddleName} autoCapitalize="words" placeholder="Optional" />
            <Field label="Last name" value={lastName} onChange={setLastName} autoCapitalize="words" placeholder="Enter last name" />
            <Field label="Email address" value={email} onChange={setEmail} keyboard="email-address" placeholder="name@example.com" />
            <Field
              label="Phone number"
              value={phone}
              onChange={(value) => {
                setPhone(value);
                setWhatsapp(value);
                if (samePhone) setAlternatePhone(value);
              }}
              keyboard="phone-pad"
              placeholder="+91 98765 43210"
            />
            <Field
              label="Alternate phone number"
              value={samePhone ? phone : alternatePhone}
              onChange={(value) => {
                setSamePhone(false);
                setAlternatePhone(value);
              }}
              keyboard="phone-pad"
              placeholder="+91 98765 43210"
            />
            <Pressable onPress={() => setSamePhone((value) => !value)} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: samePhone ? theme.colors.primary : theme.colors.paper }} />
              <Muted>Same as the phone number above</Muted>
            </Pressable>
            <Field label="WhatsApp number" value={whatsapp} onChange={setWhatsapp} keyboard="phone-pad" placeholder="+91 98765 43210" />
            <Pressable onPress={() => setAgreed((value) => !value)} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
              <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: agreed ? theme.colors.primary : theme.colors.paper, marginTop: 4 }} />
              <Muted>I agree to the Foundation’s terms and privacy policy.</Muted>
            </Pressable>
            <Button
              icon="mail-outline"
              label={busy ? "Checking…" : "Continue & Verify"}
              disabled={busy || !agreed || !firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim()}
              onPress={async () => {
                setBusy(true);
                try {
                  const sent = await registerAccount(details());
                  setSignUpStep("email");
                  setWait(60);
                  flash(sent.message || `A code was sent to ${email}.`, "success");
                } catch (err) {
                  flash((err as Error).message, "error");
                } finally {
                  setBusy(false);
                }
              }}
            />
            <Pressable onPress={() => setTab("signin")}>
              <Muted>Already have an account? Login</Muted>
            </Pressable>
          </Card>
        )
      ) : signInStep === "complete" ? (
        <Card featured>
          <Kicker>Signed in</Kicker>
          <Text style={{ fontSize: 22, fontWeight: "700", color: theme.colors.primary, fontFamily: theme.fontFamily }}>Welcome back</Text>
          <Muted>You can use this same account on the Foundation website.</Muted>
        </Card>
      ) : signInStep === "forgot" || signInStep === "forgot-code" || signInStep === "forgot-password" ? (
        <Card>
          <Kicker>Reset password</Kicker>
          {signInStep === "forgot" ? (
            <>
              <Text style={{ fontSize: 20, fontWeight: "700", color: theme.colors.text, fontFamily: theme.fontFamily }}>Forgot your password?</Text>
              <Muted>Enter the email, phone or Account ID. We send a reset code for this Foundation account. Seminar, Autism and Fellowship passwords are not used here.</Muted>
              <Field label="Email, phone or Account ID" value={identifier} onChange={setIdentifier} placeholder="name@example.com / +91 / 12-digit Account ID" />
              <Button
                label={busy ? "Sending…" : "Send reset code"}
                disabled={busy || !identifier.trim()}
                onPress={async () => {
                  setBusy(true);
                  try {
                    const sent = await forgotPassword(identifier);
                    setPendingEmail(String(sent.email || identifier));
                    setSignInStep("forgot-code");
                    setWait(60);
                    flash(sent.message || "A reset code was sent.", "success");
                  } catch (err) {
                    flash((err as Error).message, "error");
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </>
          ) : null}
          {signInStep === "forgot-code" ? (
            <>
              <Muted>A 6-digit code was sent to the registered email.</Muted>
              <Field label="6-digit code" value={otp} onChange={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))} keyboard="numeric" />
              <Button label="Continue" disabled={otp.length !== 6} onPress={() => setSignInStep("forgot-password")} />
            </>
          ) : null}
          {signInStep === "forgot-password" ? (
            <>
              <Muted>This password is only for the Foundation website and app.</Muted>
              <Field label="New password (8+ characters)" value={resetPasswordValue} onChange={setResetPasswordValue} secret />
              <Field label="Confirm new password" value={resetConfirm} onChange={setResetConfirm} secret />
              <Button
                label={busy ? "Saving…" : "Save password"}
                disabled={busy || resetPasswordValue.length < 8 || resetPasswordValue !== resetConfirm}
                onPress={async () => {
                  setBusy(true);
                  try {
                    const saved = await resetPassword(pendingEmail || identifier, otp, resetPasswordValue);
                    setSignInStep("identifier");
                    setMethod("password");
                    flash(saved.message || "Password updated. Sign in with your new Foundation password.", "success");
                  } catch (err) {
                    flash((err as Error).message, "error");
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </>
          ) : null}
          <Button kind="ghost" label="Back to sign in" onPress={() => setSignInStep("identifier")} />
        </Card>
      ) : signInStep === "otp" ? (
        <Card>
          <Kicker>Email verification</Kicker>
          <Muted>{method === "otp" ? "Enter the 6-digit code emailed to your registered address." : "Password accepted. Enter the 6-digit code emailed to your registered address."}</Muted>
          <Field label="6-digit code" value={otp} onChange={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))} keyboard="numeric" placeholder="000000" />
          <Button
            icon="checkmark-outline"
            label={busy ? "Signing in…" : "Verify and sign in"}
            disabled={busy || otp.length !== 6}
            onPress={async () => {
              setBusy(true);
              try {
                const next = await verifyLogin(pendingEmail || identifier, otp);
                await setSession(next);
                setSignInStep("complete");
              } catch (err) {
                flash((err as Error).message, "error");
              } finally {
                setBusy(false);
              }
            }}
          />
          <Pressable
            disabled={wait > 0 || busy}
            onPress={async () => {
              setBusy(true);
              try {
                const sent = await loginAccount({ identifier: pendingEmail || identifier, password, method });
                setWait(60);
                flash(sent.message || "A new code was sent.", "success");
              } catch (err) {
                flash((err as Error).message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Muted>{wait > 0 ? `Resend code in ${wait}s` : "Resend code"}</Muted>
          </Pressable>
          <Button kind="ghost" label="Back" onPress={() => setSignInStep("identifier")} />
        </Card>
      ) : (
        <Card>
          <Kicker>Sign In</Kicker>
          <Text style={{ fontSize: 20, fontWeight: "700", color: theme.colors.text, fontFamily: theme.fontFamily, marginBottom: 6 }}>Welcome back</Text>
          <Muted>
            {method === "otp"
              ? "Use the same email, phone or 12-digit Account ID as the website. We email a one-time code."
              : "Foundation website password only. Seminar, Autism and Fellowship passwords are not used here — choose Email OTP or Forgot password."}
          </Muted>
          <View style={{ flexDirection: "row", gap: 8, marginVertical: 12 }}>
            <Chip label="Email / password" selected={method === "password"} onPress={() => setMethod("password")} />
            <Chip label="Email OTP" selected={method === "otp"} onPress={() => setMethod("otp")} />
          </View>
          <Field label="Email, phone or Account ID" value={identifier} onChange={setIdentifier} placeholder="name@example.com / +91 98765 43210 / 12-digit Account ID" />
          {method === "password" ? <Field label="Password" value={password} onChange={setPassword} secret placeholder="Your password" /> : null}
          <Button
            icon="log-in-outline"
            label={busy ? "Checking…" : method === "otp" ? "Send email code" : "Continue to verification"}
            disabled={busy || !identifier.trim() || (method === "password" && !password)}
            onPress={async () => {
              setBusy(true);
              try {
                const sent = await loginAccount({ identifier, password, method });
                if ("session" in sent && sent.session) {
                  await setSession(sent.session);
                  return;
                }
                setPendingEmail(String(sent.email || identifier));
                setOtp("");
                setSignInStep("otp");
                setWait(60);
                flash(sent.message || `A code was sent to ${sent.email}.`, "success");
              } catch (err) {
                flash((err as Error).message, "error");
              } finally {
                setBusy(false);
              }
            }}
          />
          {method === "password" ? (
            <Pressable onPress={() => setSignInStep("forgot")}>
              <Text style={{ color: theme.colors.primary, fontWeight: "700", textAlign: "center", marginTop: 10 }}>Forgot password?</Text>
            </Pressable>
          ) : null}
        </Card>
      )}
    </Screen>
  );
}
