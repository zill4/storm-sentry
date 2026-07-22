import { Bell, Bookmark, Settings } from "lucide-react"

import { SignOutButton } from "@/components/auth/sign-out-button"
import { AccountOrders } from "@/components/design/account-orders"
import { requireUser } from "@/lib/auth/session"
import { claimProspects } from "@/lib/referrals/store"

export const dynamic = "force-dynamic"

const GATED_FEATURES = [
  {
    icon: Bookmark,
    title: "Saved ZIPs",
    description: "Pin the ZIP codes you watch for instant reports and history.",
  },
  {
    icon: Bell,
    title: "Alert subscriptions",
    description: "Get notified the moment severe weather threatens a saved area.",
  },
  {
    icon: Settings,
    title: "Notification settings",
    description: "Choose channels, thresholds, and quiet hours for your alerts.",
  },
]

export default async function AccountPage() {
  const { user } = await requireUser()
  // Lazy soft-account linkage: if this user's email matches a CRM prospect we
  // alerted (see lib/referrals), claim it so their site account and CRM
  // identity are connected. Idempotent — claimed rows are skipped.
  await claimProspects(user.id, user.email)
  const initial = (user.name?.trim()?.[0] ?? user.email[0] ?? "?").toUpperCase()
  const memberSince = new Date(user.createdAt).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  })

  return (
    <main className="min-h-screen bg-[#EEF3F9] text-[#0B2037]">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1FA6E5]">
            Account
          </span>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
            {user.name?.trim() ? user.name : "Your account"}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-[#5A6B7E]">
            Your Storm Sentry account. Personalized features live here — the
            public map, ZIP reports, and forecast stay open to everyone.
          </p>
        </header>

        <section className="flex flex-col gap-4 rounded-2xl border border-[#D7E0EA] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#0B2037] text-lg font-bold text-white">
              {initial}
            </span>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-[#0B2037]">
                {user.name?.trim() ? user.name : user.email}
              </div>
              <div className="truncate text-sm text-[#5A6B7E]">{user.email}</div>
              <div className="mt-0.5 text-[11px] uppercase tracking-[0.08em] text-[#8B98A8]">
                Member since {memberSince}
              </div>
            </div>
          </div>
          <SignOutButton variant="full" />
        </section>

        <AccountOrders userId={user.id} />

        <div className="grid gap-4 sm:grid-cols-3">
          {GATED_FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                className="flex flex-col gap-2 rounded-2xl border border-[#D7E0EA] bg-white p-5 shadow-sm"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-[#EEF3F9] text-[#1FA6E5]">
                  <Icon className="size-4.5" />
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-[#0B2037]">
                    {f.title}
                  </h2>
                  <span className="rounded-full bg-[#F47A20]/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#B85614]">
                    Soon
                  </span>
                </div>
                <p className="text-xs leading-5 text-[#5A6B7E]">{f.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
