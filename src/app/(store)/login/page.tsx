import type { Metadata } from "next";
import LoginView from "@/components/account/LoginView";

export const metadata: Metadata = {
  title: "Login / Create Account",
  description:
    "Create a Vaidya Gogate Memorial Foundation account or log in to manage shop orders and your profile.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; next?: string }>;
}) {
  const { mode, next } = await searchParams;
  return <LoginView signInMode={mode === "signin"} next={next} />;
}
