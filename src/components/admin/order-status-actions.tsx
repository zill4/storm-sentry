"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/design/types"

// Admin status transitions with an optional customer-visible note. Refreshes
// the server-rendered detail page after a successful change.

export function OrderStatusActions({
  orderId,
  currentStatus,
}: {
  orderId: string
  currentStatus: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState<OrderStatus>(currentStatus as OrderStatus)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function apply() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: note.trim() || undefined }),
      })
      const body = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(body.error ?? "Update failed.")
        return
      }
      setNote("")
      router.refresh()
    } catch {
      setError("Couldn't reach the server.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5">
        {ORDER_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              status === s
                ? "border-[#0B2037] bg-[#0B2037] text-white"
                : "border-[#D7E0EA] bg-white text-[#5A6B7E] hover:bg-[#E4EBF3]"
            }`}
          >
            {ORDER_STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note (shown on the customer's timeline)…"
        className="rounded-lg border border-[#D7E0EA] bg-white px-3 py-2 text-sm text-[#0B2037] outline-none transition placeholder:text-[#8B98A8] focus:border-[#1FA6E5]"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={apply}
          disabled={busy || (status === currentStatus && !note.trim())}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0B2037] px-4 text-sm font-semibold text-white transition hover:bg-[#0B2037]/90 disabled:opacity-50"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          Apply status
        </button>
        {error && <span className="text-xs text-[#B22A1E]">{error}</span>}
      </div>
    </div>
  )
}
