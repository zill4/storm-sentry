import { zipReportUrl } from "@/lib/app-url"
import { subscribe } from "@/lib/bus"
import { getDb, isDbConfigured } from "@/lib/db/client"
import { ghlNotifications } from "@/lib/db/schema"
import { formatEta } from "@/lib/storms/eta"
import type { ZipInsightEvent } from "@/lib/zip-insights/types"
import {
  addTagToContact,
  ghlConfigured,
  removeTagFromContact,
  searchContactsByZip,
  updateContactStormFields,
  type GhlContact,
} from "./client"

// Storm context carried per ZIP so each contact's custom fields (and therefore
// their message merge tags) reference THEIR zip, not the storm's whole list.
export type ZipStormContext = {
  eventType: string
  severity: string
  headline: string | null
  expiresAt: string | null
  etaMinutes: number | null
}

export function stormFieldValues(zip: string, ctx: ZipStormContext): Record<string, string> {
  const tz = process.env.GHL_TIME_ZONE ?? "America/Chicago"
  let expires = ""
  if (ctx.expiresAt) {
    const d = new Date(ctx.expiresAt)
    if (!Number.isNaN(d.getTime())) {
      expires = d.toLocaleString("en-US", {
        timeZone: tz,
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })
    }
  }
  return {
    storm_event_type: ctx.eventType,
    storm_severity: ctx.severity,
    storm_zip: zip,
    storm_headline: (ctx.headline ?? ctx.eventType).slice(0, 200),
    storm_expires: expires,
    // "~40 minutes" / "~2 hours" / "" when unknown — workflows should branch
    // on the empty case ("tracking into your area right now").
    storm_eta: formatEta(ctx.etaMinutes) ?? "",
    // Public no-auth storm report the message can link to.
    storm_link: zipReportUrl(zip),
  }
}

// GHL delivery channel for the per-ZIP alert gate. Consumes `zip_alert` events
// (already severity-gated + per-ZIP-cooldown'd upstream — see lib/alerts/gate.ts),
// finds every GHL contact whose postal code matches the ZIP, and adds the alert
// tag; a GHL workflow ("contact tagged → send message") does the messaging.
//
// Safety properties (this path reaches real customers):
//  - all severity / fixture / anti-spam filtering happens in the ZIP alert gate;
//    this module only ever receives ZIPs that already cleared it.
//  - idempotent per contact×storm, persisted to Postgres and hydrated at boot,
//    so restarts/redeploys can never re-message anyone for the same warning.
//  - hard cap on contacts tagged per storm (GHL_MAX_CONTACTS_PER_STORM).
//  - per-ZIP contact lookups are cached (TTL) and all calls are throttled.

type Stats = {
  enabled: boolean
  tagged: number
  failed: number
  skippedDisabled: number
  stormsProcessed: number
  lastError: string | null
  lastRunAt: string | null
}

type Shape = {
  // zip → storm context accumulating per storm until its debounce flush fires
  pending: Map<string, { zips: Map<string, ZipStormContext>; timer: NodeJS.Timeout }>
  // `${contactId}:${stormId}` already handled (hydrated from DB at boot)
  notified: Set<string>
  // zip -> cached contacts
  contactCache: Map<string, { contacts: GhlContact[]; at: number }>
  stats: Stats
  unsubscribe?: () => void
}

declare global {
  // eslint-disable-next-line no-var
  var __stormSentryGhlNotifier: Shape | undefined
}

function getShape(): Shape {
  if (!globalThis.__stormSentryGhlNotifier) {
    globalThis.__stormSentryGhlNotifier = {
      pending: new Map(),
      notified: new Set(),
      contactCache: new Map(),
      stats: {
        enabled: ghlConfigured(),
        tagged: 0,
        failed: 0,
        skippedDisabled: 0,
        stormsProcessed: 0,
        lastError: null,
        lastRunAt: null,
      },
    }
  }
  return globalThis.__stormSentryGhlNotifier
}

function alertTag(): string {
  return process.env.GHL_ALERT_TAG ?? "storm-alert"
}

async function cachedContacts(zip: string): Promise<GhlContact[]> {
  const s = getShape()
  const ttlMs = Number(process.env.GHL_CONTACT_CACHE_TTL_MIN ?? 360) * 60_000
  const hit = s.contactCache.get(zip)
  if (hit && Date.now() - hit.at < ttlMs) return hit.contacts
  const contacts = await searchContactsByZip(zip)
  s.contactCache.set(zip, { contacts, at: Date.now() })
  return contacts
}

function recordNotification(row: {
  contactId: string
  stormId: string
  zip: string
  status: "tagged" | "failed"
  error?: string | null
}): void {
  if (!isDbConfigured()) return
  void getDb()
    .insert(ghlNotifications)
    .values({
      id: `${row.contactId}:${row.stormId}`,
      contactId: row.contactId,
      stormId: row.stormId,
      zip: row.zip,
      tag: alertTag(),
      status: row.status,
      error: row.error ?? null,
    })
    .onConflictDoNothing()
    .catch((err) => console.error("[ghl] persist notification failed", err))
}

async function flushStorm(stormId: string): Promise<void> {
  const s = getShape()
  const entry = s.pending.get(stormId)
  if (!entry) return
  s.pending.delete(stormId)
  s.stats.lastRunAt = new Date().toISOString()

  if (!ghlConfigured()) {
    s.stats.enabled = false
    s.stats.skippedDisabled++
    console.log(
      `[ghl] would notify for storm ${stormId} across ${entry.zips.size} ZIPs — skipped (GHL_PRIVATE_TOKEN/GHL_LOCATION_ID not set)`,
    )
    return
  }
  s.stats.enabled = true
  s.stats.stormsProcessed++

  const maxZips = Number(process.env.GHL_MAX_ZIPS_PER_STORM ?? 250)
  const maxContacts = Number(process.env.GHL_MAX_CONTACTS_PER_STORM ?? 500)
  const zips = [...entry.zips.entries()].slice(0, maxZips)
  let taggedThisStorm = 0

  for (const [zip, ctx] of zips) {
    if (taggedThisStorm >= maxContacts) break
    let contacts: GhlContact[]
    try {
      contacts = await cachedContacts(zip)
    } catch (err) {
      s.stats.lastError = err instanceof Error ? err.message : String(err)
      console.error(`[ghl] contact search failed for ${zip}`, err)
      continue
    }
    for (const c of contacts) {
      if (taggedThisStorm >= maxContacts) break
      const key = `${c.id}:${stormId}`
      if (s.notified.has(key)) continue
      s.notified.add(key)
      try {
        // Write the storm context onto the contact FIRST so the workflow's
        // merge tags ({{contact.storm_event_type}} etc.) are already fresh
        // when the tag event fires. Best-effort: a missing custom field must
        // not block the alert itself.
        try {
          await updateContactStormFields(c.id, stormFieldValues(zip, ctx))
        } catch (err) {
          s.stats.lastError = err instanceof Error ? err.message : String(err)
          console.error(`[ghl] custom-field update failed for ${c.id}`, err)
        }
        // Remove-then-add forces a fresh "tag added" event per storm — if the
        // contact kept the tag from a previous storm, a bare add is a no-op
        // and the GHL workflow would never fire. (Disable: GHL_FORCE_RETAG=false)
        if (process.env.GHL_FORCE_RETAG !== "false") {
          try {
            await removeTagFromContact(c.id, alertTag())
          } catch {
            /* best-effort; the add below is what matters */
          }
        }
        await addTagToContact(c.id, alertTag())
        s.stats.tagged++
        taggedThisStorm++
        recordNotification({ contactId: c.id, stormId, zip, status: "tagged" })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        s.stats.failed++
        s.stats.lastError = msg
        recordNotification({ contactId: c.id, stormId, zip, status: "failed", error: msg })
        console.error(`[ghl] tag failed for contact ${c.id}`, err)
      }
    }
  }
  console.log(
    `[ghl] storm ${stormId}: tagged ${taggedThisStorm} contacts across ${zips.length} ZIPs`,
  )
}

// Batch the per-ZIP alerts of one storm (arriving within a poll cycle) into a
// single flush. Severity / fixture / cooldown are already enforced by the gate.
function consider(insight: ZipInsightEvent): void {
  const s = getShape()
  const ctx: ZipStormContext = {
    eventType: insight.eventType,
    severity: insight.severity,
    headline: insight.headline,
    expiresAt: insight.expiresAt,
    etaMinutes: insight.etaMinutes,
  }
  const debounceMs = Number(process.env.GHL_STORM_DEBOUNCE_MS ?? 5000)
  const existing = s.pending.get(insight.stormId)
  if (existing) {
    if (!existing.zips.has(insight.zip)) existing.zips.set(insight.zip, ctx)
    return
  }
  const timer = setTimeout(() => {
    void flushStorm(insight.stormId)
  }, debounceMs)
  // Don't let a pending debounce keep the process alive.
  timer.unref?.()
  s.pending.set(insight.stormId, { zips: new Map([[insight.zip, ctx]]), timer })
}

export function ghlStats(): Stats & { pendingStorms: number; knownNotifications: number } {
  const s = getShape()
  return {
    ...s.stats,
    enabled: ghlConfigured(),
    pendingStorms: s.pending.size,
    knownNotifications: s.notified.size,
  }
}

export async function startGhlNotifier(): Promise<{ started: boolean; reason?: string }> {
  // Dev machines share the real GHL location AND the poller sees real storms —
  // an unguarded local notifier competes with production for rate limits and
  // can message real contacts. Opt in explicitly when that's intended.
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.GHL_DEV_NOTIFIER !== "true"
  ) {
    return {
      started: false,
      reason: "dev environment (set GHL_DEV_NOTIFIER=true to enable)",
    }
  }
  const s = getShape()
  if (s.unsubscribe) return { started: false, reason: "already running" }

  // Hydrate the idempotency ledger so a redeploy can't re-message contacts.
  if (isDbConfigured()) {
    try {
      const rows = await getDb()
        .select({ id: ghlNotifications.id })
        .from(ghlNotifications)
      for (const r of rows) s.notified.add(r.id)
    } catch (err) {
      console.error("[ghl] hydration failed (continuing with empty ledger)", err)
    }
  }

  s.unsubscribe = subscribe((event) => {
    if (event.type === "zip_alert") consider(event.insight)
  })
  return { started: true }
}
