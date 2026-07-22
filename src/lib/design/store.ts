import { and, desc, eq, isNull, notInArray } from "drizzle-orm"

import { getDb, isDbConfigured } from "@/lib/db/client"
import { designRequests, designUploads, designs } from "@/lib/db/schema"
import { newId } from "./ids"
import {
  DESIGN_STYLES,
  QR_ACTIONS,
  type DesignRequestStatus,
} from "./types"

// Draft lifecycle for the tarp-design wizard. A draft is created on the first
// answer and owned either by the `draft_key` cookie (pre-auth) or by a user id
// (post account gate). Unlike the storm stores there is no in-memory fallback:
// customer designs must persist, so this feature requires DATABASE_URL.

export const DRAFT_COOKIE = "ss_tarp_draft"
export const DRAFT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export type DesignRequestRow = typeof designRequests.$inferSelect
export type DesignUploadRow = typeof designUploads.$inferSelect
export type DesignRow = typeof designs.$inferSelect

// Statuses that still belong to an in-flight wizard session. Anything past
// "selected" is history and shouldn't be resumed as a draft.
const ACTIVE_STATUSES: DesignRequestStatus[] = ["draft", "generating", "reviewing", "selected"]

/** Fields the wizard may PATCH directly (everything else is server-managed). */
export type DraftPatch = Partial<
  Pick<
    DesignRequestRow,
    | "email"
    | "fullName"
    | "businessName"
    | "shippingAddress"
    | "phone"
    | "website"
    | "qrAction"
    | "qrTargetUrl"
    | "services"
    | "vendorBadges"
    | "howFound"
    | "howFoundOther"
    | "designStyle"
    | "specialInstructions"
    | "consentTransactionalSms"
    | "consentMarketingSms"
  >
>

const PATCHABLE_KEYS = [
  "email",
  "fullName",
  "businessName",
  "shippingAddress",
  "phone",
  "website",
  "qrAction",
  "qrTargetUrl",
  "services",
  "vendorBadges",
  "howFound",
  "howFoundOther",
  "designStyle",
  "specialInstructions",
  "consentTransactionalSms",
  "consentMarketingSms",
] as const satisfies readonly (keyof DraftPatch)[]

/** Drop unknown keys so a crafted PATCH body can't touch server-managed columns. */
export function sanitizeDraftPatch(raw: Record<string, unknown>): DraftPatch {
  const patch: Record<string, unknown> = {}
  for (const key of PATCHABLE_KEYS) {
    if (!(key in raw)) continue
    const value = raw[key]
    if (key === "services" || key === "vendorBadges") {
      if (value === null) patch[key] = null
      else if (Array.isArray(value)) patch[key] = value.filter((v) => typeof v === "string")
      continue
    }
    if (key === "consentTransactionalSms" || key === "consentMarketingSms") {
      if (typeof value === "boolean") patch[key] = value
      continue
    }
    if (value === null || typeof value === "string") patch[key] = value
  }
  return patch as DraftPatch
}

export async function createDraft(input: {
  draftKey: string
  userId?: string | null
}): Promise<DesignRequestRow> {
  const [row] = await getDb()
    .insert(designRequests)
    .values({ id: newId("dr"), draftKey: input.draftKey, userId: input.userId ?? null })
    .returning()
  return row
}

export async function getDraftByKey(draftKey: string): Promise<DesignRequestRow | null> {
  if (!isDbConfigured() || !draftKey) return null
  const rows = await getDb()
    .select()
    .from(designRequests)
    .where(eq(designRequests.draftKey, draftKey))
    .limit(1)
  const row = rows[0] ?? null
  return row && ACTIVE_STATUSES.includes(row.status as DesignRequestStatus) ? row : null
}

/** The user's most recent in-flight request (drives /design resume). */
export async function getActiveRequestForUser(userId: string): Promise<DesignRequestRow | null> {
  if (!isDbConfigured()) return null
  const rows = await getDb()
    .select()
    .from(designRequests)
    .where(
      and(
        eq(designRequests.userId, userId),
        notInArray(designRequests.status, ["submitted", "imported"]),
      ),
    )
    .orderBy(desc(designRequests.updatedAt))
    .limit(1)
  return rows[0] ?? null
}

/** Every request this user owns, newest first (drives the account page). */
export async function listRequestsForUser(userId: string): Promise<DesignRequestRow[]> {
  if (!isDbConfigured()) return []
  return getDb()
    .select()
    .from(designRequests)
    .where(eq(designRequests.userId, userId))
    .orderBy(desc(designRequests.updatedAt))
}

export async function getRequest(id: string): Promise<DesignRequestRow | null> {
  if (!isDbConfigured()) return null
  const rows = await getDb().select().from(designRequests).where(eq(designRequests.id, id)).limit(1)
  return rows[0] ?? null
}

export async function updateDraft(id: string, patch: DraftPatch): Promise<DesignRequestRow | null> {
  const rows = await getDb()
    .update(designRequests)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(designRequests.id, id))
    .returning()
  return rows[0] ?? null
}

export async function setRequestStatus(
  id: string,
  status: DesignRequestStatus,
): Promise<void> {
  await getDb()
    .update(designRequests)
    .set({ status, updatedAt: new Date() })
    .where(eq(designRequests.id, id))
}

/**
 * Attach an anonymous draft to a freshly signed-in user. Only unclaimed drafts
 * are touched, so a cookie replayed after claiming can't reassign ownership.
 */
export async function claimDraft(draftKey: string, userId: string): Promise<DesignRequestRow | null> {
  if (!isDbConfigured() || !draftKey) return null
  const rows = await getDb()
    .update(designRequests)
    .set({ userId, updatedAt: new Date() })
    .where(and(eq(designRequests.draftKey, draftKey), isNull(designRequests.userId)))
    .returning()
  return rows[0] ?? null
}

// --- Uploads ---

export async function addUpload(input: {
  requestId: string
  kind?: string
  fileName: string
  contentType: string
  sizeBytes: number
  storageKey: string
  width?: number | null
  height?: number | null
}): Promise<DesignUploadRow> {
  const [row] = await getDb()
    .insert(designUploads)
    .values({
      id: newId("du"),
      requestId: input.requestId,
      kind: input.kind ?? "logo",
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      storageKey: input.storageKey,
      width: input.width ?? null,
      height: input.height ?? null,
    })
    .returning()
  return row
}

export async function listUploads(requestId: string): Promise<DesignUploadRow[]> {
  if (!isDbConfigured()) return []
  return getDb()
    .select()
    .from(designUploads)
    .where(eq(designUploads.requestId, requestId))
    .orderBy(designUploads.createdAt)
}

export async function getUpload(id: string): Promise<DesignUploadRow | null> {
  if (!isDbConfigured()) return null
  const rows = await getDb().select().from(designUploads).where(eq(designUploads.id, id)).limit(1)
  return rows[0] ?? null
}

export async function deleteUpload(id: string): Promise<DesignUploadRow | null> {
  const rows = await getDb().delete(designUploads).where(eq(designUploads.id, id)).returning()
  return rows[0] ?? null
}

// --- Designs (read side; generation writes live in lib/design/generate) ---

export async function listDesigns(requestId: string): Promise<DesignRow[]> {
  if (!isDbConfigured()) return []
  return getDb()
    .select()
    .from(designs)
    .where(eq(designs.requestId, requestId))
    .orderBy(designs.version)
}

export async function getDesign(id: string): Promise<DesignRow | null> {
  if (!isDbConfigured()) return null
  const rows = await getDb().select().from(designs).where(eq(designs.id, id)).limit(1)
  return rows[0] ?? null
}

// --- Validation ---

const QR_ACTION_KEYS = QR_ACTIONS.map((a) => a.key) as string[]
const STYLE_KEYS = DESIGN_STYLES.map((s) => s.key) as string[]

export type DraftCompleteness = { ready: boolean; missing: string[] }

/** Mirrors the Google Form's required questions (marketing SMS stays optional). */
export function draftCompleteness(
  row: DesignRequestRow,
  uploads: Pick<DesignUploadRow, "kind">[],
): DraftCompleteness {
  const missing: string[] = []
  if (!row.email?.trim()) missing.push("email")
  if (!row.fullName?.trim()) missing.push("full name")
  if (!row.businessName?.trim()) missing.push("business name")
  if (!row.shippingAddress?.trim()) missing.push("shipping address")
  if (!row.phone?.trim()) missing.push("phone number")
  if (!row.website?.trim()) missing.push("website")
  if (!row.qrAction || !QR_ACTION_KEYS.includes(row.qrAction)) missing.push("QR code action")
  if (!row.qrTargetUrl?.trim()) missing.push("QR destination")
  if (!row.services?.length) missing.push("services")
  if (!row.vendorBadges?.length) missing.push("vendor badges")
  if (!row.howFound?.trim()) missing.push("how you found us")
  if (!row.designStyle || !STYLE_KEYS.includes(row.designStyle)) missing.push("design style")
  if (!row.consentTransactionalSms) missing.push("order-update SMS consent")
  if (!uploads.some((u) => u.kind === "logo")) missing.push("logo upload")
  return { ready: missing.length === 0, missing }
}
