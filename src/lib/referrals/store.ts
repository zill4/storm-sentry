import { randomBytes } from "node:crypto"

import { and, desc, eq, gte, isNull, sql } from "drizzle-orm"

import { getDb, isDbConfigured } from "@/lib/db/client"
import { linkTokens, prospects, siteVisits } from "@/lib/db/schema"
import type { GhlContact } from "@/lib/ghl/client"

// Referral tracking + soft accounts.
//
// Outbound alert links carry an OPAQUE per-contact token (?sv=…) instead of
// any personal data — the token resolves server-side to the GHL contact we
// alerted. Visiting with a token records the landing (site_visits), stamps a
// cookie, and keeps a "prospect" row (soft account) fresh; when that person
// later signs up with the same email, the prospect is claimed and linked to
// their user id. Everything is a no-op without DATABASE_URL.

export const VISIT_COOKIE = "ss_ref"
export const VISIT_PARAM = "sv"

type TokenInfo = {
  token: string
  contactId: string
  email: string | null
  name: string | null
  zip: string | null
}

type Shape = {
  // contactId → token, so a storm fan-out doesn't re-query per contact.
  byContact: Map<string, string>
}

declare global {
  // eslint-disable-next-line no-var
  var __stormSentryReferrals: Shape | undefined
}

function getShape(): Shape {
  if (!globalThis.__stormSentryReferrals) {
    globalThis.__stormSentryReferrals = { byContact: new Map() }
  }
  return globalThis.__stormSentryReferrals
}

function contactName(c: Pick<GhlContact, "firstName" | "lastName">): string | null {
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim()
  return name || null
}

/**
 * Token for this contact, creating (and upserting the prospect row) on first
 * use. Returns null when no DB is configured — callers then send plain links.
 */
export async function ensureLinkToken(
  contact: GhlContact,
  zip: string,
): Promise<string | null> {
  if (!isDbConfigured()) return null
  const s = getShape()
  const cached = s.byContact.get(contact.id)
  if (cached) return cached
  const db = getDb()
  const email = contact.email?.trim().toLowerCase() || null
  const name = contactName(contact)

  try {
    // Soft account: we already know this person — record them as a prospect
    // whether or not they ever visit.
    await db
      .insert(prospects)
      .values({ id: contact.id, email, name, zip, contactId: contact.id, source: "ghl" })
      .onConflictDoUpdate({
        target: prospects.id,
        set: { email, name, zip },
      })

    const existing = await db
      .select({ token: linkTokens.token })
      .from(linkTokens)
      .where(eq(linkTokens.contactId, contact.id))
      .limit(1)
    if (existing[0]) {
      s.byContact.set(contact.id, existing[0].token)
      return existing[0].token
    }

    const token = randomBytes(18).toString("base64url")
    await db
      .insert(linkTokens)
      .values({ token, contactId: contact.id, email, name, zip })
      .onConflictDoNothing({ target: linkTokens.contactId })
    // A concurrent insert can win the race — re-read to get the canonical token.
    const row = await db
      .select({ token: linkTokens.token })
      .from(linkTokens)
      .where(eq(linkTokens.contactId, contact.id))
      .limit(1)
    const final = row[0]?.token ?? token
    s.byContact.set(contact.id, final)
    return final
  } catch (err) {
    console.error("[referrals] ensureLinkToken failed", err)
    return null
  }
}

/** Append `?sv=<token>` to a URL (no-op for null tokens). */
export function withVisitToken(url: string, token: string | null): string {
  if (!token) return url
  return `${url}${url.includes("?") ? "&" : "?"}${VISIT_PARAM}=${token}`
}

export async function resolveToken(token: string): Promise<TokenInfo | null> {
  if (!isDbConfigured() || !token) return null
  try {
    const rows = await getDb()
      .select()
      .from(linkTokens)
      .where(eq(linkTokens.token, token))
      .limit(1)
    const r = rows[0]
    if (!r) return null
    return { token: r.token, contactId: r.contactId, email: r.email, name: r.name, zip: r.zip }
  } catch (err) {
    console.error("[referrals] resolveToken failed", err)
    return null
  }
}

/** Record a landing. Returns the resolved token info when `sv` was valid. */
export async function recordVisit(opts: {
  sv?: string | null
  path: string
  referrer?: string | null
  userAgent?: string | null
}): Promise<TokenInfo | null> {
  if (!isDbConfigured()) return null
  const db = getDb()
  const info = opts.sv ? await resolveToken(opts.sv) : null

  let source = "direct"
  if (info) source = "ghl"
  else if (opts.referrer) {
    try {
      source = `referral:${new URL(opts.referrer).hostname}`
    } catch {
      /* unparseable referrer → direct */
    }
  }

  try {
    await db.insert(siteVisits).values({
      id: randomBytes(12).toString("hex"),
      token: info?.token ?? null,
      source,
      path: opts.path.slice(0, 300),
      referrer: opts.referrer?.slice(0, 500) ?? null,
      userAgent: opts.userAgent?.slice(0, 300) ?? null,
    })
    if (info) {
      const now = new Date()
      await db
        .update(linkTokens)
        .set({ lastVisitAt: now, visitCount: sql`${linkTokens.visitCount} + 1` })
        .where(eq(linkTokens.token, info.token))
      await db
        .update(prospects)
        .set({ lastSeenAt: now })
        .where(eq(prospects.id, info.contactId))
    }
  } catch (err) {
    console.error("[referrals] recordVisit failed", err)
  }
  return info
}

/** Link any unclaimed prospects with this email to a freshly signed-up user. */
export async function claimProspects(userId: string, email: string): Promise<number> {
  if (!isDbConfigured() || !email) return 0
  try {
    const rows = await getDb()
      .update(prospects)
      .set({ claimedUserId: userId })
      .where(and(eq(prospects.email, email.trim().toLowerCase()), isNull(prospects.claimedUserId)))
      .returning({ id: prospects.id })
    return rows.length
  } catch (err) {
    console.error("[referrals] claimProspects failed", err)
    return 0
  }
}

/** Aggregate referral picture for the last `days` days (no PII). */
export async function referralSummary(days = 30): Promise<{
  since: string
  visitsBySource: Array<{ source: string; visits: number }>
  tokenVisitors: number
  prospects: number
  claimedProspects: number
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const empty = {
    since: since.toISOString(),
    visitsBySource: [],
    tokenVisitors: 0,
    prospects: 0,
    claimedProspects: 0,
  }
  if (!isDbConfigured()) return empty
  try {
    const db = getDb()
    const bySource = await db
      .select({ source: siteVisits.source, visits: sql<number>`count(*)::int` })
      .from(siteVisits)
      .where(gte(siteVisits.visitedAt, since))
      .groupBy(siteVisits.source)
      .orderBy(desc(sql`count(*)`))
    const tokenVisitors = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(linkTokens)
      .where(gte(linkTokens.visitCount, 1))
    const totalProspects = await db.select({ n: sql<number>`count(*)::int` }).from(prospects)
    const claimed = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(prospects)
      .where(sql`${prospects.claimedUserId} is not null`)
    return {
      since: since.toISOString(),
      visitsBySource: bySource,
      tokenVisitors: tokenVisitors[0]?.n ?? 0,
      prospects: totalProspects[0]?.n ?? 0,
      claimedProspects: claimed[0]?.n ?? 0,
    }
  } catch (err) {
    console.error("[referrals] summary failed", err)
    return empty
  }
}
