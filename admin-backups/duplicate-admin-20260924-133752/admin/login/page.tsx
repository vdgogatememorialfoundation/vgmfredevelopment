"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function login() {
    if (!email || !password) {
      alert("Please enter email and password.");
      return;
    }

    sessionStorage.setItem("vgmf-admin-login", "true");
    router.push("/admin");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F7F5] p-5">

      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">

        <div className="text-center">

          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#651C1C]">
            VGMF
          </p>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Admin Console
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Vaidya Gogate Memorial Foundation
          </p>

        </div>

        <div className="mt-8 space-y-4">

          <div>
            <label className="text-xs font-bold text-slate-600">
              Email
            </label>

            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#651C1C]"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600">
              Password
            </label>

            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#651C1C]"
              placeholder="Password"
            />
          </div>

          <button
            onClick={login}
            className="w-full rounded-xl bg-[#651C1C] px-5 py-3 font-bold text-white hover:bg-[#4F1414]"
          >
            Sign In
          </button>

        </div>

        <Link
          href="/"
          className="mt-6 block text-center text-xs font-semibold text-slate-400"
        >
          ← Back to website
        </Link>

      </div>

    </div>
  );
}
