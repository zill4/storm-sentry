import Link from "next/link"
import { ArrowRight, PenLine } from "lucide-react"

import { QrRetarget } from "@/components/design/qr-retarget"
import { getOrderForRequest } from "@/lib/design/orders"
import { listDesigns, listRequestsForUser } from "@/lib/design/store"
import { ORDER_STATUS_LABELS, designStyle, type OrderStatus } from "@/lib/design/types"
import { getQrLinkForRequest } from "@/lib/qr/store"

// Server component: the "Smart Tarp orders" section of the account page.
// One card per design request — submitted ones show the order status timeline
// and the QR retarget control; in-flight ones deep-link back into the studio.

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending_review: "bg-[#F47A20]/12 text-[#B85614]",
  approved: "bg-[#1FA6E5]/12 text-[#0E6C99]",
  printing: "bg-[#1FA6E5]/12 text-[#0E6C99]",
  shipped: "bg-[#2FA37A]/12 text-[#1E6E52]",
  completed: "bg-[#2FA37A]/12 text-[#1E6E52]",
  canceled: "bg-[#8B98A8]/15 text-[#5A6B7E]",
}

export async function AccountOrders({ userId }: { userId: string }) {
  const requests = await listRequestsForUser(userId)
  if (requests.length === 0) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-[#D7E0EA] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[#0B2037]">Smart Tarp designs</h2>
        <p className="text-xs leading-5 text-[#5A6B7E]">
          Design a branded Smart Tarp with a scannable, re-pointable QR code — a few questions
          and your logo is all it takes.
        </p>
        <Link
          href="/design"
          className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full bg-[#0B2037] px-4 text-sm font-semibold text-white transition hover:bg-[#0B2037]/90"
        >
          <PenLine className="size-3.5" />
          Start a design
        </Link>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1FA6E5]">
          Smart Tarp orders
        </h2>
        <Link
          href="/design"
          className="inline-flex items-center gap-1 text-xs text-[#5A6B7E] transition hover:text-[#1FA6E5]"
        >
          New design
          <ArrowRight className="size-3" />
        </Link>
      </div>

      {await Promise.all(
        requests.map(async (request) => {
          const [order, designs, qr] = await Promise.all([
            getOrderForRequest(request.id),
            listDesigns(request.id),
            getQrLinkForRequest(request.id),
          ])
          const selected =
            designs.find((d) => d.selectedAt) ?? designs.findLast((d) => d.status === "succeeded")
          const style = designStyle(request.designStyle)

          return (
            <div
              key={request.id}
              className="flex flex-col gap-4 rounded-2xl border border-[#D7E0EA] bg-white p-5 shadow-sm sm:flex-row"
            >
              <div className="flex w-full shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#E4EBF3]/60 sm:w-56">
                {selected?.storageKey ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/design/images/${selected.id}`}
                    alt={`${request.businessName ?? "Tarp"} design`}
                    className="aspect-[2/1] w-full object-contain"
                  />
                ) : (
                  <div className="flex aspect-[2/1] w-full items-center justify-center text-xs text-[#8B98A8]">
                    No design yet
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-base font-semibold text-[#0B2037]">
                    {request.businessName ?? "Untitled tarp"}
                  </span>
                  {order ? (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${STATUS_STYLES[order.status as OrderStatus] ?? STATUS_STYLES.pending_review}`}
                    >
                      {ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status}
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#8B98A8]/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5A6B7E]">
                      In progress
                    </span>
                  )}
                  {style && (
                    <span className="text-[11px] uppercase tracking-[0.08em] text-[#8B98A8]">
                      {style.name}
                    </span>
                  )}
                </div>

                {order ? (
                  <ol className="flex flex-col gap-1">
                    {order.events
                      .slice(-4)
                      .reverse()
                      .map((e, i) => (
                        <li key={`${e.at}-${i}`} className="flex items-baseline gap-2 text-xs">
                          <span className="font-mono tabular-nums text-[#8B98A8]">
                            {new Date(e.at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="text-[#5A6B7E]">{e.note}</span>
                        </li>
                      ))}
                  </ol>
                ) : (
                  <p className="text-xs leading-5 text-[#5A6B7E]">
                    {request.status === "reviewing"
                      ? "Your concepts are ready to review."
                      : request.status === "generating"
                        ? "Designs are generating — check back in a minute."
                        : "Pick up where you left off."}{" "}
                    <Link
                      href={request.status === "draft" ? "/design" : "/design/review"}
                      className="font-medium text-[#1FA6E5] hover:underline"
                    >
                      {request.status === "reviewing" ? "Review designs" : "Continue"}
                    </Link>
                  </p>
                )}

                {qr && order && <QrRetarget slug={qr.slug} initialTarget={qr.targetUrl} />}
              </div>
            </div>
          )
        }),
      )}
    </section>
  )
}
