"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { adminNavigation } from "./_config/navigation"
import { useAuth } from "@/components/auth/AuthContext"
import ClientOnly from "@/components/common/ClientOnly"
import { canOpen, getRole, moduleForPath } from "@/lib/roles"
import { getAccounts } from "@/lib/admin-store"
import { loginBlockReason } from "@/lib/auth"
import { LoginStamp } from "@/components/layout/LoginStamp"
import { isStaffModuleEnabled } from "@/lib/site-visibility"
import { hydratePartnerFeed } from "@/lib/partner-hydrate"
import { LivePublishBridge } from "@/components/admin/LivePublishBridge"
import { syncAdminIntegrations } from "@/lib/integrations"
import { pushPortalAccounts } from "@/lib/portal-accounts-sync"
import { PortalShell, type PortalNavGroup } from "@/components/admin/PortalShell"

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

  const userEmail = user?.email
  const userRole = user?.role
  // Keyed on identity, not the user object: syncs fire "vgmf-cms", which hands back a fresh user object.
  useEffect(() => {
    if (userEmail) void hydratePartnerFeed()
    if (userRole === "admin" || userRole === "coadmin") {
      void syncAdminIntegrations()
      pushPortalAccounts()
    }
  }, [userEmail, userRole])

  if (!user || (user.role !== "admin" && user.role !== "coadmin" && user.role !== "staff" && user.role !== "doctor")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFFFFF] p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-burgundy">Foundation</p>
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
  const isCoadmin = user.role === "coadmin"
  const isDoctor = user.role === "doctor"
  const role = isStaff ? getRole(user.staffRoleId) : null
  const groups = adminNavigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!canOpen(user, item.href)) return false
        if (user.role === "admin" || user.role === "coadmin") return true
        const owner = moduleForPath(item.href)
        return owner ? isStaffModuleEnabled(owner) : true
      }),
    }))
    .filter((group) => group.items.length > 0)
  const owner = moduleForPath(pathname)
  const allowed =
    canOpen(user, pathname) &&
    (user.role === "admin" || user.role === "coadmin" || !owner || isStaffModuleEnabled(owner))

  const navGroups: PortalNavGroup[] = groups.map((group) => ({
    label: group.label,
    items: group.items.map((item) => ({
      label: item.label,
      href: item.href,
      active: pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href + "/")),
    })),
  }))

  return (
    <>
      <LivePublishBridge />
      <PortalShell
        title={isDoctor ? "Doctor workspace" : isStaff ? "Staff workspace" : isCoadmin ? "Co-admin workspace" : "Admin Console"}
        subtitle={isStaff ? `${role?.name} · ${role?.category}` : isDoctor ? "Clinic pages" : isCoadmin ? "Higher-authority access via /staff" : "Vaidya Gogate Memorial Foundation"}
        groups={navGroups}
        actions={
          <>
            <span className="hidden text-gray-600 md:inline">
              {user.firstName} {user.lastName} · {isDoctor ? "Doctor" : isStaff ? role?.name : isCoadmin ? "Co-admin" : "Administrator"}
            </span>
            <Link href="/" className="hidden text-burgundy hover:underline sm:inline">View website</Link>
            <LoginStamp
              compact
              onLogout={() => {
                signOut()
                router.push(isDoctor ? "/doctor/login" : isStaff || isCoadmin ? "/staff/login" : "/admin/login")
              }}
            />
          </>
        }
      >
            {allowed ? (
              children
            ) : (
              <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center">
                <h1 className="text-xl font-semibold text-gray-900">This module is not in your role</h1>
                <p className="mt-2 text-sm text-gray-600">
                  {role?.name} can open: {groups.flatMap((group) => group.items).map((item) => item.label).join(", ") || "nothing yet"}.
                  Ask an administrator to change your role under Accounts → Roles & Permissions.
                </p>
                <Link href={isDoctor ? "/doctor" : isCoadmin || isStaff ? "/staff" : "/admin"} className="btn-outline mt-5">Open my workspace</Link>
              </div>
            )}
      </PortalShell>
    </>
  )
}
