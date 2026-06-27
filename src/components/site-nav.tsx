"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, Bell, CloudRain, Code2, FileText, Map } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { StormSentryWordmark } from "@/components/brand/logo"

const links = [
  { href: "/", label: "Storm Map", icon: Map },
  { href: "/reports", label: "ZIP Reports", icon: FileText },
  { href: "/forecast", label: "Forecast", icon: CloudRain },
  { href: "/contacts", label: "Contacts", icon: Bell },
  { href: "/developer", label: "Developer", icon: Code2 },
]

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: LucideIcon
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
        active
          ? "bg-[#0B2037] text-white"
          : "text-[#5A6B7E] hover:bg-[#E4EBF3] hover:text-[#0B2037]"
      }`}
    >
      <Icon className="size-3.5" />
      {label}
    </Link>
  )
}

export function SiteNav() {
  const pathname = usePathname()
  return (
    <nav className="sticky top-0 z-50 border-b border-[#D7E0EA] bg-white/85 text-[#0B2037] backdrop-blur-md supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-4 py-2.5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <StormSentryWordmark />
        </Link>
        <div className="ml-4 hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink key={l.href} {...l} active={pathname === l.href} />
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/api/health"
            className="flex items-center gap-1 text-xs text-[#8B98A8] transition hover:text-[#1FA6E5]"
          >
            <Activity className="size-3.5" />
            health
          </Link>
        </div>
      </div>
      {/* Mobile: scrollable link row so the full nav stays reachable. */}
      <div className="flex gap-1 overflow-x-auto border-t border-[#D7E0EA] px-4 py-2 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
        {links.map((l) => (
          <NavLink key={l.href} {...l} active={pathname === l.href} />
        ))}
      </div>
    </nav>
  )
}
