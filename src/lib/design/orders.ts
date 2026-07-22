import { desc, eq } from "drizzle-orm"

import { getDb, isDbConfigured } from "@/lib/db/client"
import { designRequests, designs, orders } from "@/lib/db/schema"
import { appBaseUrl } from "@/lib/app-url"
import { sendEmail } from "@/lib/email/send"
import { getQrLinkForRequest, qrUrl } from "@/lib/qr/store"
import { newId } from "./ids"
import { designStyle, ORDER_STATUS_LABELS, type OrderEvent, type OrderStatus } from "./types"
import type { DesignRequestRow, DesignRow } from "./store"

export type OrderRow = typeof orders.$inferSelect

/**
 * The customer picked a design: mark it selected, freeze the request as
 * submitted, open the order, and notify the print team. Idempotent per request
 * (unique request_id) — a double click returns the existing order.
 */
export async function createOrderForSelection(
  request: DesignRequestRow,
  design: DesignRow,
): Promise<{ order: OrderRow; created: boolean }> {
  const db = getDb()
  const existing = await db
    .select()
    .from(orders)
    .where(eq(orders.requestId, request.id))
    .limit(1)
  if (existing[0]) return { order: existing[0], created: false }

  const now = new Date()
  const firstEvent: OrderEvent = {
    at: now.toISOString(),
    status: "pending_review",
    note: "Design selected by customer — awaiting print team review.",
  }
  const [order] = await db
    .insert(orders)
    .values({
      id: newId("or"),
      requestId: request.id,
      userId: request.userId,
      designId: design.id,
      events: [firstEvent],
    })
    .returning()

  await db
    .update(designs)
    .set({ selectedAt: now, updatedAt: now })
    .where(eq(designs.id, design.id))
  await db
    .update(designRequests)
    .set({ status: "submitted", updatedAt: now })
    .where(eq(designRequests.id, request.id))

  return { order, created: true }
}

/** Fire the team-review email; stamps team_notified_at on success. */
export async function notifyTeamOfOrder(
  order: OrderRow,
  request: DesignRequestRow,
  design: DesignRow,
): Promise<void> {
  const to = process.env.ORDER_NOTIFY_EMAIL
  if (!to) {
    console.log("[orders] ORDER_NOTIFY_EMAIL not set — team notification skipped")
    return
  }
  const qr = await getQrLinkForRequest(request.id)
  const style = designStyle(request.designStyle)
  const base = appBaseUrl()
  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#5A6B7E;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:4px 0;color:#0B2037">${value}</td></tr>`

  const html = [
    `<div style="font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.6;color:#0B2037;max-width:640px">`,
    `<h2 style="margin:0 0 4px">New Smart Tarp order — ${request.businessName ?? "Unknown business"}</h2>`,
    `<p style="margin:0 0 16px;color:#5A6B7E">A customer selected a design and it's ready for print review.</p>`,
    `<table style="border-collapse:collapse">`,
    row("Order", order.id),
    row("Business", request.businessName ?? "—"),
    row("Contact", `${request.fullName ?? "—"} · ${request.email ?? "—"} · ${request.phone ?? "—"}`),
    row("Ship to", (request.shippingAddress ?? "—").replace(/\n/g, "<br/>")),
    row("Website", request.website ?? "—"),
    row("Style", style ? `${style.name} (${style.tagline})` : (request.designStyle ?? "—")),
    row("Services", request.services?.join(", ") ?? "—"),
    row("Badges", request.vendorBadges?.join(", ") ?? "—"),
    row("Revisions used", String(request.revisionCount)),
    qr ? row("QR", `<a href="${qr ? qrUrl(qr.slug) : "#"}">${qrUrl(qr.slug)}</a> → ${qr.targetUrl}`) : "",
    request.specialInstructions?.trim()
      ? row("Instructions", request.specialInstructions.replace(/\n/g, "<br/>"))
      : "",
    `</table>`,
    `<p style="margin:16px 0">`,
    `<a href="${base}/admin/orders/${order.id}" style="background:#0B2037;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Open order &amp; print bundle</a>`,
    `</p>`,
    `<p style="margin:0;color:#8B98A8;font-size:12px">Selected design: version ${design.version} · ${design.width ?? "?"}×${design.height ?? "?"}px · Storm Sentry Tarp Studio</p>`,
    `</div>`,
  ].join("")

  const result = await sendEmail({
    to,
    subject: `Smart Tarp order: ${request.businessName ?? request.fullName ?? order.id}`,
    html,
    replyTo: request.email ?? undefined,
  })
  if (result.sent) {
    await getDb()
      .update(orders)
      .set({ teamNotifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(orders.id, order.id))
  }
}

export async function getOrderForRequest(requestId: string): Promise<OrderRow | null> {
  if (!isDbConfigured()) return null
  const rows = await getDb().select().from(orders).where(eq(orders.requestId, requestId)).limit(1)
  return rows[0] ?? null
}

export async function getOrder(id: string): Promise<OrderRow | null> {
  if (!isDbConfigured()) return null
  const rows = await getDb().select().from(orders).where(eq(orders.id, id)).limit(1)
  return rows[0] ?? null
}

export async function listOrdersForUser(userId: string): Promise<OrderRow[]> {
  if (!isDbConfigured()) return []
  return getDb()
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
}

export async function listAllOrders(): Promise<OrderRow[]> {
  if (!isDbConfigured()) return []
  return getDb().select().from(orders).orderBy(desc(orders.createdAt))
}

/** Admin status transition; appends to the event timeline. */
export async function setOrderStatus(
  id: string,
  status: OrderStatus,
  note?: string | null,
): Promise<OrderRow | null> {
  const db = getDb()
  const [existing] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!existing) return null
  const event: OrderEvent = {
    at: new Date().toISOString(),
    status,
    note: note?.trim() || `Status set to ${ORDER_STATUS_LABELS[status]}.`,
  }
  const [updated] = await db
    .update(orders)
    .set({
      status,
      events: [...existing.events, event],
      updatedAt: new Date(),
    })
    .where(eq(orders.id, id))
    .returning()
  return updated ?? null
}
