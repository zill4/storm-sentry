import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Download, FileImage, QrCode } from "lucide-react"

import { OrderStatusActions } from "@/components/admin/order-status-actions"
import { QrRetarget } from "@/components/design/qr-retarget"
import { isAdminUser } from "@/lib/auth/roles"
import { getServerSession } from "@/lib/auth/session"
import { isDbConfigured } from "@/lib/db/client"
import { getOrder } from "@/lib/design/orders"
import { getRequest, listDesigns, listUploads } from "@/lib/design/store"
import { designStyle } from "@/lib/design/types"
import { getQrLinkForRequest, qrUrl } from "@/lib/qr/store"

export const dynamic = "force-dynamic"

export const metadata: Metadata = { title: "Order — Storm Sentry admin" }

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession()
  if (!session || !isAdminUser(session.user)) notFound()
  if (!isDbConfigured()) notFound()

  const { id } = await params
  const order = await getOrder(id)
  if (!order) notFound()
  const request = await getRequest(order.requestId)
  if (!request) notFound()
  const [designs, uploads, qr] = await Promise.all([
    listDesigns(request.id),
    listUploads(request.id),
    getQrLinkForRequest(request.id),
  ])
  const selected = designs.find((d) => d.id === order.designId)
  const style = designStyle(request.designStyle)

  const fact = (label: string, value: React.ReactNode) => (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-[0.08em] text-[#8B98A8]">{label}</span>
      <span className="text-sm text-[#0B2037]">{value ?? "—"}</span>
    </div>
  )

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-xs text-[#5A6B7E] transition hover:text-[#1FA6E5]"
      >
        <ArrowLeft className="size-3.5" />
        All orders
      </Link>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight text-[#0B2037]">
          {request.businessName ?? "Order"}
        </h1>
        <span className="font-mono text-xs tabular-nums text-[#8B98A8]">{order.id}</span>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          {/* Selected design + print bundle */}
          <section className="overflow-hidden rounded-2xl border border-[#D7E0EA] bg-white shadow-sm">
            <div className="border-b border-[#D7E0EA] px-5 py-3 text-sm font-semibold text-[#0B2037]">
              Selected design
            </div>
            {selected?.storageKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/design/images/${selected.id}`}
                alt="Selected design"
                className="w-full bg-[#E4EBF3]/60 object-contain"
              />
            ) : (
              <p className="px-5 py-6 text-sm text-[#5A6B7E]">Design image unavailable.</p>
            )}
            <div className="flex flex-wrap gap-2 border-t border-[#D7E0EA] px-5 py-3">
              {selected && (
                <>
                  <BundleLink href={`/api/design/images/${selected.id}`} label="Final PNG (with QR)" />
                  <BundleLink href={`/api/design/images/${selected.id}?raw=1`} label="Raw PNG (no QR)" />
                </>
              )}
              {qr && <BundleLink href={`/api/admin/qr-svg/${qr.slug}`} label="QR as SVG (vector)" />}
              {uploads.map((u) => (
                <BundleLink
                  key={u.id}
                  href={`/api/design/uploads/${u.id}`}
                  label={`Logo: ${u.fileName}`}
                />
              ))}
            </div>
          </section>

          {/* All versions */}
          {designs.length > 1 && (
            <section className="rounded-2xl border border-[#D7E0EA] bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-[#0B2037]">All versions</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {designs.map((d) => (
                  <figure key={d.id} className="overflow-hidden rounded-lg border border-[#D7E0EA]">
                    {d.status === "succeeded" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/design/images/${d.id}`}
                        alt={`v${d.version}`}
                        className="aspect-[2/1] w-full bg-[#E4EBF3]/60 object-contain"
                      />
                    ) : (
                      <div className="flex aspect-[2/1] items-center justify-center bg-[#E4EBF3]/60 text-[11px] text-[#8B98A8]">
                        {d.status}
                      </div>
                    )}
                    <figcaption className="flex items-center justify-between px-2 py-1 text-[11px] text-[#5A6B7E]">
                      <span>
                        v{d.version}
                        {d.id === order.designId ? " · selected" : ""}
                      </span>
                      {d.revisionNote && <FileImage className="size-3 text-[#8B98A8]" />}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {/* Status */}
          <section className="rounded-2xl border border-[#D7E0EA] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#0B2037]">Status</h2>
            <div className="mt-3">
              <OrderStatusActions orderId={order.id} currentStatus={order.status} />
            </div>
            <ol className="mt-4 flex flex-col gap-1.5 border-t border-[#D7E0EA] pt-3">
              {[...order.events].reverse().map((e, i) => (
                <li key={`${e.at}-${i}`} className="flex items-baseline gap-2 text-xs">
                  <span className="shrink-0 font-mono tabular-nums text-[#8B98A8]">
                    {new Date(e.at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="text-[#5A6B7E]">{e.note}</span>
                </li>
              ))}
            </ol>
            {!order.teamNotifiedAt && (
              <p className="mt-3 rounded-lg border border-[#F47A20]/40 bg-[#F47A20]/10 px-3 py-2 text-xs text-[#0B2037]">
                Team email was not sent (email service not configured when this order landed).
              </p>
            )}
          </section>

          {/* QR */}
          {qr && (
            <section className="rounded-2xl border border-[#D7E0EA] bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[#0B2037]">
                <QrCode className="size-4 text-[#1FA6E5]" />
                Printed QR
              </h2>
              <p className="mt-1.5 font-mono text-xs text-[#5A6B7E]">
                {qrUrl(qr.slug)} · {qr.hits} scan{qr.hits === 1 ? "" : "s"}
              </p>
              <div className="mt-3">
                <QrRetarget slug={qr.slug} initialTarget={qr.targetUrl} />
              </div>
            </section>
          )}

          {/* Request facts */}
          <section className="flex flex-col gap-3 rounded-2xl border border-[#D7E0EA] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#0B2037]">Request</h2>
            {fact("Contact", `${request.fullName ?? "—"} · ${request.phone ?? "—"}`)}
            {fact("Email", request.email)}
            {fact("Ship to", <span className="whitespace-pre-wrap">{request.shippingAddress}</span>)}
            {fact("Website", request.website)}
            {fact("Style", style ? `${style.name} (${style.tagline})` : request.designStyle)}
            {fact("Services", request.services?.join(", "))}
            {fact("Badges", request.vendorBadges?.join(", "))}
            {fact("Found us via", request.howFoundOther ? `${request.howFound} — ${request.howFoundOther}` : request.howFound)}
            {fact("Revisions used", String(request.revisionCount))}
            {fact(
              "SMS consent",
              `Order updates: ${request.consentTransactionalSms ? "yes" : "no"} · Marketing: ${request.consentMarketingSms ? "yes" : "no"}`,
            )}
            {request.specialInstructions?.trim()
              ? fact(
                  "Special instructions",
                  <span className="whitespace-pre-wrap">{request.specialInstructions}</span>,
                )
              : null}
            {fact("Source", request.source === "google_form" ? "Google Form" : "Chat wizard")}
          </section>
        </div>
      </div>
    </main>
  )
}

function BundleLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-[#D7E0EA] bg-white px-3 py-1.5 text-xs font-medium text-[#0B2037] transition hover:bg-[#E4EBF3]"
    >
      <Download className="size-3 text-[#1FA6E5]" />
      {label}
    </a>
  )
}
