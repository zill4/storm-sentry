import { z } from "zod"

// GoHighLevel API v2 client (Private Integration token). Used by the storm
// notifier to find contacts in threatened ZIPs and tag them — the tag fires a
// GHL workflow that sends the actual message, so content/compliance stay in GHL.
//
// Every call is throttled (GHL allows bursts of ~100/10s per location; we stay
// far under) and the search-body shape is centralized here: if the tenant's
// searchable postal field differs, set GHL_ZIP_FIELD instead of editing code.

const BASE = "https://services.leadconnectorhq.com"
const API_VERSION = "2021-07-28"

export class GhlClientError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = "GhlClientError"
    this.status = status
  }
}

export function ghlConfigured(): boolean {
  return Boolean(process.env.GHL_PRIVATE_TOKEN && process.env.GHL_LOCATION_ID)
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.GHL_PRIVATE_TOKEN}`,
    Version: API_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  }
}

// Simple spacing throttle: at most ~3 GHL calls/sec per process.
declare global {
  // eslint-disable-next-line no-var
  var __stormSentryGhlLastCall: number | undefined
}
async function throttle(): Promise<void> {
  const minGapMs = Number(process.env.GHL_MIN_CALL_GAP_MS ?? 350)
  const last = globalThis.__stormSentryGhlLastCall ?? 0
  const wait = last + minGapMs - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  globalThis.__stormSentryGhlLastCall = Date.now()
}

const ContactSchema = z.object({
  id: z.string(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
})
const SearchResponseSchema = z.object({
  contacts: z.array(ContactSchema).nullable().optional(),
  total: z.number().nullable().optional(),
})
export type GhlContact = z.infer<typeof ContactSchema>

/** Contacts whose postal code exactly matches `zip` (paginated, capped). */
export async function searchContactsByZip(zip: string): Promise<GhlContact[]> {
  if (!ghlConfigured()) throw new GhlClientError("GHL not configured")
  const field = process.env.GHL_ZIP_FIELD ?? "postalCode"
  const out: GhlContact[] = []
  const pageLimit = 100
  const maxPages = Number(process.env.GHL_MAX_PAGES_PER_ZIP ?? 3)

  for (let page = 1; page <= maxPages; page++) {
    await throttle()
    const res = await fetch(`${BASE}/contacts/search`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        locationId: process.env.GHL_LOCATION_ID,
        page,
        pageLimit,
        filters: [{ field, operator: "eq", value: zip }],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      throw new GhlClientError(`GHL search responded ${res.status}`, res.status)
    }
    const parsed = SearchResponseSchema.parse((await res.json()) as unknown)
    const batch = parsed.contacts ?? []
    out.push(...batch)
    if (batch.length < pageLimit) break
  }
  return out
}

/** Add the alert tag to a contact (idempotent on the GHL side). */
export async function addTagToContact(contactId: string, tag: string): Promise<void> {
  if (!ghlConfigured()) throw new GhlClientError("GHL not configured")
  await throttle()
  const res = await fetch(`${BASE}/contacts/${encodeURIComponent(contactId)}/tags`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ tags: [tag] }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    throw new GhlClientError(`GHL add-tag responded ${res.status}`, res.status)
  }
}

/**
 * Write storm context onto the contact as custom-field values (by field KEY,
 * which needs only the contacts scope). The GHL workflow's SMS/email reads
 * these as merge tags, e.g. {{contact.storm_event_type}}. Fields must exist in
 * GHL (Settings → Custom Fields) with these exact keys.
 */
export async function updateContactStormFields(
  contactId: string,
  fields: Record<string, string>,
): Promise<void> {
  if (!ghlConfigured()) throw new GhlClientError("GHL not configured")
  await throttle()
  const res = await fetch(`${BASE}/contacts/${encodeURIComponent(contactId)}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({
      customFields: Object.entries(fields).map(([key, field_value]) => ({
        key,
        field_value,
      })),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    throw new GhlClientError(`GHL contact update responded ${res.status}`, res.status)
  }
}

/** Remove the alert tag. Used before re-adding so GHL emits a fresh
 *  "tag added" event — adding an already-present tag fires no workflow. */
export async function removeTagFromContact(contactId: string, tag: string): Promise<void> {
  if (!ghlConfigured()) throw new GhlClientError("GHL not configured")
  await throttle()
  const res = await fetch(`${BASE}/contacts/${encodeURIComponent(contactId)}/tags`, {
    method: "DELETE",
    headers: headers(),
    body: JSON.stringify({ tags: [tag] }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  })
  // 404 = contact didn't have the tag; that's the normal first-storm case.
  if (!res.ok && res.status !== 404) {
    throw new GhlClientError(`GHL remove-tag responded ${res.status}`, res.status)
  }
}
