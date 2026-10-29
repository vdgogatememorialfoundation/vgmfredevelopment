"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { adminNavigation } from "./_config/navigation"
import { useAuth } from "@/components/auth/AuthContext"
import ClientOnly from "@/components/common/ClientOnly"
import { canOpen, getRole } from "@/lib/roles"
import { getAccounts } from "@/lib/admin-store"
import { loginBlockReason } from "@/lib/auth"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  if (pathname === "/admin/login") return <>{children}</>
  return (
    <ClientOnly>
      <AdminShell pathname={pathname}>{children}</AdminShell>
    </ClientOnly>
  )
}

function AdminShell({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  if (!user || (user.role !== "admin" && user.role !== "staff" && user.role !== "doctor")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFFFFF] p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-burgundy">VGMF</p>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">Sign in to continue</h1>
          <p className="mt-2 text-sm text-gray-600">
            This page is for Foundation administrators. Staff and doctors sign in on their own portals.
          </p>
          <div className="mt-6">
            <Link href="/admin/login" className="btn-primary">Admin sign in</Link>
          </div>
        </div>
      </div>
    )
  }

  const liveAccount = getAccounts().find((account) => account.email.toLowerCase() === user.email.toLowerCase())
  const blocked = user.role === "admin" ? null : liveAccount ? loginBlockReason(liveAccount) : "This account has been deleted."
  if (blocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFFFFF] p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">Access removed</h1>
          <p className="mt-2 text-sm text-gray-600">{blocked}</p>
          <button
            type="button"
            className="btn-primary mt-6"
            onClick={() => {
              signOut()
              router.push(user.role === "doctor" ? "/doctor/login" : "/staff/login")
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  const isStaff = user.role === "staff"
  const isDoctor = user.role === "doctor"
  const role = isStaff ? getRole(user.staffRoleId) : null
  const groups = adminNavigation
    .map((group) => ({ ...group, items: group.items.filter((item) => canOpen(user, item.href)) }))
    .filter((group) => group.items.length > 0)
  const allowed = canOpen(user, pathname)

  const nav = (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <div key={group.label} className="mb-6">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            {group.label}
          </div>
          <div className="space-y-1">
            {group.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href + "/"))
              return (
                <Link
                  key={item.label + item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={[
                    "block rounded-lg px-3 py-2 text-sm transition",
                    active
                      ? "bg-burgundy/10 font-semibold text-burgundy"
                      : "text-gray-700 hover:bg-slate-50 hover:text-burgundy",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:block">
          <div className="sticky top-0 flex h-screen flex-col">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="text-xs font-semibold uppercase tracking-widest text-burgundy">VGMF</div>
              <div className="mt-1 text-lg font-semibold">{isDoctor ? "Doctor workspace" : isStaff ? "Staff workspace" : "Admin Console"}</div>
              <div className="mt-1 text-xs text-gray-500">
                {isStaff ? `${role?.name} · ${role?.category}` : isDoctor ? "Clinic pages" : "Vaidya Gogate Memorial Foundation"}
              </div>
            </div>
            {nav}
            <div className="border-t border-slate-200 p-4">
              <Link href="/" className="block rounded-lg border border-slate-200 px-3 py-2 text-center text-sm hover:bg-gray-50">
                ← Back to website
              </Link>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex h-16 items-center justify-between gap-3 px-5 lg:px-8">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm lg:hidden"
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  Menu
                </button>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-gray-400">VGMF</div>
                  <div className="font-semibold">{isDoctor ? "Doctor workspace" : isStaff ? "Staff workspace" : "Administration"}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="hidden text-gray-600 sm:inline">
                  {user.firstName} {user.lastName} · {isDoctor ? "Doctor" : isStaff ? role?.name : "Administrator"}
                </span>
                <Link href="/" className="text-burgundy hover:underline">View website</Link>
                <button
                  type="button"
                  className="text-gray-500 hover:text-burgundy"
                  onClick={() => {
                    signOut()
                    router.push(isDoctor ? "/doctor/login" : isStaff ? "/staff/login" : "/admin/login")
                  }}
                >
                  Sign out
                </button>
              </div>
            </div>
            {menuOpen && <div className="max-h-[70vh] overflow-y-auto border-t border-slate-200 bg-white lg:hidden">{nav}</div>}
          </header>

          <div className="p-5 lg:p-8">
            {allowed ? (
              children
            ) : (
              <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center">
                <h1 className="text-xl font-semibold text-gray-900">This module is not in your role</h1>
                <p className="mt-2 text-sm text-gray-600">
                  {role?.name} can open: {groups.flatMap((group) => group.items).map((item) => item.label).join(", ") || "nothing yet"}.
                  Ask an administrator to change your role under Accounts → Roles & Permissions.
                </p>
                <Link href={isDoctor ? "/doctor" : "/staff"} className="btn-outline mt-5">Open my workspace</Link>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
