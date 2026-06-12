import { NextResponse } from "next/server"
import { z } from "zod"

import {
  demoEndpointsBlockedResponse,
  demoEndpointsEnabled,
} from "@/lib/demo-guard"
import {
  addTagToContact,
  ghlConfigured,
  removeTagFromContact,
  searchContactsByZip,
  updateContactStormFields,
} from "@/lib/ghl/client"
import { stormFieldValues } from "@/lib/ghl/notifier"

export const dynamic = "force-dynamic"

// Runs the full per-contact alert sequence (custom fields → retag) against ONE
// contact with SAMPLE storm data, so the GHL workflow + merge tags can be
// verified end-to-end without waiting for a real storm. Demo-guarded: blocked
// on production unless ALLOW_DEMO_ENDPOINTS=true.
const Body = z.object({
  contactId: z.string().optional(),
  // Alternative: look the contact up by ZIP (uses the same search as the notifier).
  zip: z.string().regex(/^\d{5}$/).optional(),
})

export async function POST(req: Request) {
  if (!demoEndpointsEnabled()) return demoEndpointsBlockedResponse()
  if (!ghlConfigured()) {
    return NextResponse.json(
      { ok: false, error: "GHL_PRIVATE_TOKEN / GHL_LOCATION_ID not set" },
      { status: 400 },
    )
  }
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    raw = {}
  }
  const parsed = Body.safeParse(raw)
  if (!parsed.success || (!parsed.data.contactId && !parsed.data.zip)) {
    return NextResponse.json(
      { ok: false, error: "Provide contactId or zip." },
      { status: 400 },
    )
  }

  const steps: Record<string, string> = {}
  try {
    let contactId = parsed.data.contactId
    const zip = parsed.data.zip ?? "75201"
    if (!contactId) {
      const contacts = await searchContactsByZip(zip)
      if (contacts.length === 0) {
        return NextResponse.json(
          { ok: false, error: `No GHL contacts with postal code ${zip}.` },
          { status: 404 },
        )
      }
      contactId = contacts[0].id
      steps.search = `found ${contacts.length} contact(s), using ${contactId}`
    }

    const fields = stormFieldValues(zip, {
      eventType: "Tornado Warning (TEST)",
      severity: "Extreme",
      headline:
        "[TEST] Storm Sentry end-to-end test — no real storm. Safe to ignore.",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
    await updateContactStormFields(contactId, fields)
    steps.customFields = `set: ${Object.keys(fields).join(", ")}`

    const tag = process.env.GHL_ALERT_TAG ?? "storm-alert"
    try {
      await removeTagFromContact(contactId, tag)
      steps.removeTag = "ok"
    } catch (err) {
      steps.removeTag = `skipped (${err instanceof Error ? err.message : err})`
    }
    await addTagToContact(contactId, tag)
    steps.addTag = `"${tag}" added — workflow should fire now`

    return NextResponse.json({ ok: true, contactId, fields, steps })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        steps,
      },
      { status: 502 },
    )
  }
}
