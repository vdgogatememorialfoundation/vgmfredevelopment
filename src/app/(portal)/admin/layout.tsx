"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { adminNavigation } from "./_config/navigation"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-gray-900">
      <div className="flex min-h-screen">

        <aside className="hidden w-72 shrink-0 border-r bg-white lg:block">
          <div className="sticky top-0 flex h-screen flex-col">

            <div className="border-b px-6 py-5">
              <div className="text-xs font-semibold uppercase tracking-widest text-[#651C1C]">
                VGMF
              </div>

              <div className="mt-1 text-lg font-semibold">
                Admin Console
              </div>

              <div className="mt-1 text-xs text-gray-500">
                Vaidya Gogate Memorial Foundation
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4">
              {adminNavigation.map((group) => (
                <div key={group.label} className="mb-6">

                  <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    {group.label}
                  </div>

                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const active =
                        pathname === item.href ||
                        (item.href !== "/admin" &&
                          pathname.startsWith(item.href + "/"))

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={[
                            "block rounded-lg px-3 py-2 text-sm transition",
                            active
                              ? "bg-[#651C1C] font-medium text-white"
                              : "text-gray-700 hover:bg-[#F5F0E8] hover:text-[#651C1C]",
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

            <div className="border-t p-4">
              <Link
                href="/"
                className="block rounded-lg border px-3 py-2 text-center text-sm hover:bg-gray-50"
              >
                ← Back to website
              </Link>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
            <div className="flex h-16 items-center justify-between px-5 lg:px-8">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  VGMF
                </div>
                <div className="font-semibold">
                  Administration
                </div>
              </div>

              <Link
                href="/"
                className="text-sm text-[#651C1C] hover:underline"
              >
                View Website
              </Link>
            </div>
          </header>

          <div className="p-5 lg:p-8">
            {children}
          </div>
        </main>

      </div>
    </div>
  )
}
