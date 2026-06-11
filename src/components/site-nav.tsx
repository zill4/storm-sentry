"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, Bell, CloudRain, Code2, FileText, Map, Zap } from "lucide-react"

import { Badge } from "@/components/ui/badge"

const links = [
  { href: "/", label: "Storm Map", icon: Map },
  { href: "/reports", label: "ZIP Reports", icon: FileText },
  { href: "/forecast", label: "Forecast", icon: CloudRain },
  { href: "/contacts", label: "Contacts", icon: Bell },
  { href: "/developer", label: "Developer", icon: Code2 },
]

export function SiteNav() {
  const pathname = usePathname()
  return (
    <nav className="sticky top-0 z-50 border-b border-[#DDD8CC] bg-[#F7F5F0]/95 text-[#201E1A]">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-4 py-2 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-7 items-center justify-center rounded-md bg-[#201E1A] text-[#F7F5F0]">
            <Zap className="size-4" />
          </span>
          Storm Sentry
          <Badge
            variant="outline"
            className="ml-1 border-[#DDD8CC] bg-transparent text-xs font-normal text-[#9B958A]"
          >
            POC
          </Badge>
        </Link>
        <div className="ml-4 flex items-center gap-1">
          {links.map((l) => {
            const active = pathname === l.href
            const Icon = l.icon
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
                  active
                    ? "bg-[#201E1A] text-[#F7F5F0]"
                    : "text-[#6F6A5F] hover:bg-[#E7E3DA] hover:text-[#201E1A]"
                }`}
              >
                <Icon className="size-3.5" />
                {l.label}
              </Link>
            )
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/api/health"
            className="flex items-center gap-1 text-xs text-[#9B958A] hover:text-[#201E1A]"
          >
            <Activity className="size-3.5" />
            health
          </Link>
        </div>
      </div>
    </nav>
  )
}
