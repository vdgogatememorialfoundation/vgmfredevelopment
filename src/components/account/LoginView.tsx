"use client";

import { Suspense } from "react";
import SiteLogo from "@/components/common/SiteLogo";
import Link from "next/link";
import SignupFlow from "@/components/account/SignupFlow";
import SignInFlow from "@/components/account/SignInFlow";
import { useI18n } from "@/components/i18n/LanguageProvider";
import { siteConfig } from "@/lib/constants";
import { authClosedMessage, getAuthAccess } from "@/lib/auth-access";

export default function LoginView({
  signInMode,
  next,
}: {
  signInMode: boolean;
  next?: string;
}) {
  const { t } = useI18n();
  const nextQuery = next ? `&next=${encodeURIComponent(next)}` : "";
  const access = getAuthAccess();
  const closed = !access.loginEnabled && !access.signupEnabled;
  const showSignIn = signInMode || !access.signupEnabled;
  const effectiveSignIn = access.loginEnabled && (!access.signupEnabled || showSignIn);

  return (
    <main className="border-t border-border bg-background">
      <div className="mx-auto grid max-w-7xl lg:grid-cols-2">
        <section className="hidden flex-col justify-center border-r border-border bg-paper px-10 py-16 text-text-primary lg:flex xl:px-20">
          <div className="max-w-lg">
            <SiteLogo size={64} className="mb-8" />
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-gold">{siteConfig.name}</p>
            <h1 className="font-serif text-4xl font-bold leading-tight xl:text-5xl">{t("login.oneAccount")}</h1>
            <p className="mt-6 text-base leading-7 text-text-muted">{t("login.blurb")}</p>
            <div className="mt-10 space-y-5">
              <Step
                number={1}
                title={signInMode ? t("login.stepSignIn") : t("login.stepCreate")}
                text={signInMode ? t("login.stepSignInText") : t("login.stepCreateText")}
              />
              <Step number={2} title={t("login.stepVerify")} text={t("login.stepVerifyText")} />
              <Step
                number={3}
                title={t("login.stepAccess")}
                text={signInMode ? t("login.stepAccessSignIn") : t("login.stepAccessCreate")}
              />
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-12 sm:px-8">
          <div className="w-full max-w-xl">
            <Link href="/" className="mb-8 inline-flex text-sm font-medium text-text-muted transition hover:text-burgundy">
              ← {t("common.back")}
            </Link>
            {closed ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {authClosedMessage(access)}
              </p>
            ) : (
              <>
            <div className="mb-8 grid grid-cols-2 gap-2 rounded-xl border border-border bg-white p-1.5">
              <Link
                href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
                className={`rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition ${
                  !effectiveSignIn ? "bg-burgundy text-white" : "text-text-muted hover:text-burgundy"
                } ${!access.signupEnabled ? "pointer-events-none opacity-40" : ""}`}
              >
                {t("login.create")}
              </Link>
              <Link
                href={`/login?mode=signin${nextQuery}`}
                className={`rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition ${
                  effectiveSignIn ? "bg-burgundy text-white" : "text-text-muted hover:text-burgundy"
                } ${!access.loginEnabled ? "pointer-events-none opacity-40" : ""}`}
              >
                {t("login.signIn")}
              </Link>
            </div>
            {effectiveSignIn ? (
              <SignInFlow />
            ) : (
              <Suspense fallback={<p className="text-sm text-text-muted">{t("common.loading")}</p>}>
                <SignupFlow />
              </Suspense>
            )}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Step({ number, title, text }: { number: number; title: string; text: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-white text-burgundy">
        {number}
      </div>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-text-muted">{text}</p>
      </div>
    </div>
  );
}
