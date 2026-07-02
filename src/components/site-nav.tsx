"use client"

import { useSyncExternalStore } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, CloudRain, FileText, Map } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { StormSentryWordmark } from "@/components/brand/logo"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { useSession } from "@/lib/auth/client"

const links = [
  { href: "/", label: "Storm Map", icon: Map },
  { href: "/reports", label: "ZIP Reports", icon: FileText },
  { href: "/forecast", label: "Forecast", icon: CloudRain },
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

const noopSubscribe = () => () => {}

function AuthNav() {
  const { data: session, isPending } = useSession()
  // useSession can resolve before hydration finishes; render the placeholder
  // for SSR + first client paint so the hydrated HTML always matches.
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )

  if (!hydrated || isPending) {
    return <span className="inline-block h-8 w-16" aria-hidden />
  }

  if (session?.user) {
    const u = session.user
    const initial = (u.name?.trim()?.[0] ?? u.email[0] ?? "?").toUpperCase()
    return (
      <div className="flex items-center gap-1">
        <Link
          href="/account"
          className="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm text-[#0B2037] transition hover:bg-[#E4EBF3]"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-[#0B2037] text-xs font-bold text-white">
            {initial}
          </span>
          <span className="hidden max-w-[140px] truncate sm:inline">
            {u.name?.trim() ? u.name : u.email}
          </span>
        </Link>
        <SignOutButton />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href="/sign-in"
        className="hidden rounded-full px-3 py-1.5 text-sm text-[#5A6B7E] transition hover:bg-[#E4EBF3] hover:text-[#0B2037] sm:inline-flex"
      >
        Sign in
      </Link>
      <Link
        href="/sign-up"
        className="rounded-full bg-[#0B2037] px-3.5 py-1.5 text-sm font-medium whitespace-nowrap text-white transition hover:bg-[#0B2037]/90"
      >
        <span className="sm:hidden">Sign up</span>
        <span className="hidden sm:inline">Create account</span>
      </Link>
    </div>
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
            className="hidden items-center gap-1 text-xs text-[#8B98A8] transition hover:text-[#1FA6E5] sm:flex"
          >
            <Activity className="size-3.5" />
            health
          </Link>
          <AuthNav />
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
