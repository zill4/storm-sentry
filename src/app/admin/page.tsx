import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { desc } from "drizzle-orm"

import { isAdminUser } from "@/lib/auth/roles"
import { getServerSession } from "@/lib/auth/session"
import { getDb, isDbConfigured } from "@/lib/db/client"
import { designRequests } from "@/lib/db/schema"
import { listAllOrders } from "@/lib/design/orders"
import { ORDER_STATUS_LABELS, designStyle, type OrderStatus } from "@/lib/design/types"

export const dynamic = "force-dynamic"

export const metadata: Metadata = { title: "Orders admin — Storm Sentry" }

const STATUS_TONE: Record<OrderStatus, string> = {
  pending_review: "bg-[#F47A20]/12 text-[#B85614]",
  approved: "bg-[#1FA6E5]/12 text-[#0E6C99]",
  printing: "bg-[#1FA6E5]/12 text-[#0E6C99]",
  shipped: "bg-[#2FA37A]/12 text-[#1E6E52]",
  completed: "bg-[#2FA37A]/12 text-[#1E6E52]",
  canceled: "bg-[#8B98A8]/15 text-[#5A6B7E]",
}

export default async function AdminPage() {
  const session = await getServerSession()
  if (!session || !isAdminUser(session.user)) notFound()
  if (!isDbConfigured()) notFound()

  const [orders, requests] = await Promise.all([
    listAllOrders(),
    getDb().select().from(designRequests).orderBy(desc(designRequests.updatedAt)).limit(100),
  ])
  const requestById = new Map(requests.map((r) => [r.id, r]))
  const openRequests = requests.filter((r) => r.status !== "submitted")

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <p className="text-[11px] uppercase tracking-[0.14em] text-[#1FA6E5]">Admin</p>
      <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-[#0B2037]">
        Smart Tarp orders
      </h1>

      <section className="mt-6 overflow-hidden rounded-2xl border border-[#D7E0EA] bg-white shadow-sm">
        <div className="border-b border-[#D7E0EA] px-5 py-3 text-sm font-semibold text-[#0B2037]">
          Print queue{" "}
          <span className="font-mono text-xs tabular-nums text-[#5A6B7E]">({orders.length})</span>
        </div>
        {orders.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#5A6B7E]">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#D7E0EA] text-left text-[11px] uppercase tracking-[0.08em] text-[#5A6B7E]">
                  <th className="px-5 py-2.5 font-medium">Business</th>
                  <th className="px-4 py-2.5 font-medium">Contact</th>
                  <th className="px-4 py-2.5 font-medium">Style</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const r = requestById.get(o.requestId)
                  const style = designStyle(r?.designStyle)
                  return (
                    <tr key={o.id} className="border-b border-[#D7E0EA]/60 last:border-0">
                      <td className="px-5 py-3 font-medium text-[#0B2037]">
                        {r?.businessName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[#5A6B7E]">
                        {r?.fullName ?? "—"}
                        <span className="block text-xs text-[#8B98A8]">{r?.email ?? ""}</span>
                      </td>
                      <td className="px-4 py-3 text-[#5A6B7E]">{style?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${STATUS_TONE[o.status as OrderStatus] ?? ""}`}
                        >
                          {ORDER_STATUS_LABELS[o.status as OrderStatus] ?? o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs tabular-nums text-[#5A6B7E]">
                        {o.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="font-medium text-[#1FA6E5] hover:underline"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-[#D7E0EA] bg-white shadow-sm">
        <div className="border-b border-[#D7E0EA] px-5 py-3 text-sm font-semibold text-[#0B2037]">
          Requests in flight{" "}
          <span className="font-mono text-xs tabular-nums text-[#5A6B7E]">
            ({openRequests.length})
          </span>
        </div>
        {openRequests.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#5A6B7E]">Nothing in flight.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#D7E0EA] text-left text-[11px] uppercase tracking-[0.08em] text-[#5A6B7E]">
                  <th className="px-5 py-2.5 font-medium">Business</th>
                  <th className="px-4 py-2.5 font-medium">Contact</th>
                  <th className="px-4 py-2.5 font-medium">Source</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {openRequests.map((r) => (
                  <tr key={r.id} className="border-b border-[#D7E0EA]/60 last:border-0">
                    <td className="px-5 py-3 font-medium text-[#0B2037]">
                      {r.businessName ?? "(unfinished draft)"}
                    </td>
                    <td className="px-4 py-3 text-[#5A6B7E]">
                      {r.fullName ?? "—"}
                      <span className="block text-xs text-[#8B98A8]">{r.email ?? ""}</span>
                    </td>
                    <td className="px-4 py-3">
                      {r.source === "google_form" ? (
                        <span className="rounded-full bg-[#F47A20]/12 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#B85614]">
                          Google Form
                        </span>
                      ) : (
                        <span className="text-xs text-[#5A6B7E]">Chat</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#5A6B7E]">{r.status}</td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-[#5A6B7E]">
                      {r.updatedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
