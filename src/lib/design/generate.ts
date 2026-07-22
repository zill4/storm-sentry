import { readFile } from "node:fs/promises"
import path from "node:path"

import OpenAI, { toFile } from "openai"
import sharp from "sharp"
import { and, eq, inArray, lt, sql } from "drizzle-orm"

import { emit } from "@/lib/bus"
import { getDb, isDbConfigured } from "@/lib/db/client"
import { designRequests, designs, qrLinks } from "@/lib/db/schema"
import { getObjectBuffer, putObject } from "@/lib/storage/bucket"
import { createQrLink, normalizeQrTarget, qrUrl } from "@/lib/qr/store"
import { compositeQrOntoDesign } from "./composite"
import { newId } from "./ids"
import {
  TARP_IMAGE_MODEL,
  TARP_IMAGE_QUALITY,
  TARP_IMAGE_SIZE,
  buildRevisionPrompt,
  buildTarpPrompt,
  variantHint,
} from "./prompt"
import { listUploads, type DesignRequestRow, type DesignRow } from "./store"
import { MAX_REVISIONS } from "./types"

// Generation pipeline. A design row IS the job: pending → generating →
// succeeded|failed, persisted at every transition so a redeploy can't lose
// work silently (recoverStuckDesigns fails anything left mid-flight at boot).
// Runs in-process on the single Railway replica, like the storm poller.

export const VARIANT_COUNT = Math.max(1, Number(process.env.TARP_VARIANT_COUNT ?? 3))
const JOB_CONCURRENCY = 2
const STUCK_JOB_MINUTES = 15

export function isGenerationConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}

declare global {
  var __stormSentryOpenAI: OpenAI | undefined
}

function openai(): OpenAI {
  if (!globalThis.__stormSentryOpenAI) {
    globalThis.__stormSentryOpenAI = new OpenAI()
  }
  return globalThis.__stormSentryOpenAI
}

function emitDesign(requestId: string, designId: string, status: string, requestStatus?: string) {
  emit({
    type: "design_updated",
    at: new Date().toISOString(),
    requestId,
    designId,
    status,
    requestStatus,
  })
}

class JobError extends Error {
  friendly: string
  constructor(friendly: string, detail?: string) {
    super(detail ?? friendly)
    this.friendly = friendly
  }
}

// --- QR link (one per request; every variant carries the same slug) ---

export async function ensureRequestQrLink(request: DesignRequestRow): Promise<string> {
  const db = getDb()
  const existing = await db
    .select({ slug: qrLinks.slug })
    .from(qrLinks)
    .where(eq(qrLinks.requestId, request.id))
    .limit(1)
  if (existing[0]) return existing[0].slug

  const target = normalizeQrTarget(request.qrTargetUrl ?? "")
  if (!target) throw new JobError("The QR destination isn't a valid link — edit it and try again.")
  const link = await createQrLink({
    targetUrl: target,
    requestId: request.id,
    createdByUserId: request.userId,
    label: request.businessName ? `${request.businessName} tarp` : "Smart Tarp",
  })
  return link.slug
}

// --- Layout reference (cropped clean sample from sample_layouts.png) ---

const REFERENCE_PATH = path.join(process.cwd(), "assets/design-reference/band-reference.png")
let referenceCache: Buffer | null | undefined

async function layoutReference(): Promise<Buffer | null> {
  if (process.env.TARP_USE_REFERENCE === "false") return null
  if (referenceCache !== undefined) return referenceCache
  try {
    referenceCache = await readFile(REFERENCE_PATH)
  } catch {
    referenceCache = null // reference is an enhancement, never a requirement
  }
  return referenceCache
}

// --- Logo input selection ---

const DIRECT_MIMES = new Set(["image/png", "image/jpeg"])
const CONVERTIBLE_MIMES = new Set(["image/tiff", "application/pdf"])

async function prepareLogoInput(
  requestId: string,
): Promise<{ buffer: Buffer; mime: string; name: string }> {
  const uploads = await listUploads(requestId)
  const logos = uploads.filter((u) => u.kind === "logo")
  if (logos.length === 0) throw new JobError("No logo on file — upload one first.")

  const direct = logos.find((u) => DIRECT_MIMES.has(u.contentType))
  const convertible = logos.find((u) => CONVERTIBLE_MIMES.has(u.contentType))
  const pick = direct ?? convertible ?? logos[0]
  const buffer = await getObjectBuffer(pick.storageKey)
  if (!buffer) throw new JobError("Logo file is missing from storage — re-upload it.")

  if (DIRECT_MIMES.has(pick.contentType)) {
    return { buffer, mime: pick.contentType, name: pick.fileName }
  }
  // TIFF converts reliably; PDF depends on the platform's libvips build, so a
  // failure falls through to a friendly ask for a raster copy.
  try {
    const png = await sharp(buffer, { density: 300 }).png().toBuffer()
    return { buffer: png, mime: "image/png", name: `${pick.fileName}.png` }
  } catch {
    throw new JobError(
      "We couldn't convert that logo format automatically — please also upload a PNG or JPEG version.",
    )
  }
}

// --- Job execution ---

async function callImageModel(
  prompt: string,
  inputs: { buffer: Buffer; mime: string; name: string }[],
): Promise<Buffer> {
  const files = await Promise.all(
    inputs.map((i) => toFile(i.buffer, i.name, { type: i.mime })),
  )
  const res = await openai().images.edit({
    model: TARP_IMAGE_MODEL,
    image: files.length === 1 ? files[0] : files,
    prompt,
    size: TARP_IMAGE_SIZE as OpenAI.Images.ImageEditParams["size"],
    quality: TARP_IMAGE_QUALITY,
    n: 1,
  })
  const b64 = res.data?.[0]?.b64_json
  if (!b64) throw new JobError("The image model returned no image — try again.")
  return Buffer.from(b64, "base64")
}

async function runDesignJob(designId: string): Promise<void> {
  const db = getDb()
  const [design] = await db.select().from(designs).where(eq(designs.id, designId)).limit(1)
  if (!design || design.status === "succeeded") return
  const [request] = await db
    .select()
    .from(designRequests)
    .where(eq(designRequests.id, design.requestId))
    .limit(1)
  if (!request) return

  await db
    .update(designs)
    .set({
      status: "generating",
      attempts: sql`${designs.attempts} + 1`,
      startedAt: new Date(),
      error: null,
      updatedAt: new Date(),
    })
    .where(eq(designs.id, designId))
  emitDesign(request.id, designId, "generating")

  try {
    const slug = design.qrSlug ?? (await ensureRequestQrLink(request))
    const logo = await prepareLogoInput(request.id)

    const inputs = [logo]
    if (!design.parentDesignId) {
      // Initial variants get the layout-anatomy reference as a second input
      // (revisions instead carry the design being revised).
      const reference = await layoutReference()
      if (reference) {
        inputs.push({ buffer: reference, mime: "image/png", name: "layout-reference.png" })
      }
    }
    if (design.parentDesignId) {
      const [parent] = await db
        .select()
        .from(designs)
        .where(eq(designs.id, design.parentDesignId))
        .limit(1)
      const parentKey = parent?.rawStorageKey ?? parent?.storageKey
      const parentRaw = parentKey ? await getObjectBuffer(parentKey) : null
      if (!parentRaw) throw new JobError("The design being revised is missing — start over.")
      // Revision input order matters: current proof first, logo second.
      inputs.unshift({ buffer: parentRaw, mime: "image/png", name: "current-design.png" })
    }

    if (!design.prompt) throw new JobError("This design has no prompt — start generation again.")
    const raw = await callImageModel(design.prompt, inputs)

    const rawKey = `requests/${request.id}/designs/${designId}/raw.png`
    await putObject(rawKey, raw, "image/png")

    const { png, width, height } = await compositeQrOntoDesign(
      raw,
      qrUrl(slug),
      design.styleKey,
    )
    const finalKey = `requests/${request.id}/designs/${designId}/final.png`
    await putObject(finalKey, png, "image/png")

    await db
      .update(designs)
      .set({
        status: "succeeded",
        rawStorageKey: rawKey,
        storageKey: finalKey,
        width,
        height,
        qrSlug: slug,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(designs.id, designId))
  } catch (err) {
    const friendly =
      err instanceof JobError
        ? err.friendly
        : "Generation failed — the image service had a problem. Try again in a minute."
    console.error(`[design] job ${designId} failed`, err)
    await db
      .update(designs)
      .set({ status: "failed", error: friendly, completedAt: new Date(), updatedAt: new Date() })
      .where(eq(designs.id, designId))
  }

  // When the last in-flight job for the request settles, surface "reviewing".
  const pending = await db
    .select({ id: designs.id })
    .from(designs)
    .where(
      and(eq(designs.requestId, request.id), inArray(designs.status, ["pending", "generating"])),
    )
  let requestStatus: string | undefined
  if (pending.length === 0) {
    await db
      .update(designRequests)
      .set({ status: "reviewing", updatedAt: new Date() })
      .where(eq(designRequests.id, request.id))
    requestStatus = "reviewing"
  }
  const [finalRow] = await db.select().from(designs).where(eq(designs.id, designId)).limit(1)
  emitDesign(request.id, designId, finalRow?.status ?? "failed", requestStatus)
}

function kickJobs(designIds: string[]): void {
  // Fire-and-forget with a small pool — the HTTP response returns immediately
  // and progress flows over SSE.
  const queue = [...designIds]
  const workers = Array.from({ length: Math.min(JOB_CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0) {
      const id = queue.shift()
      if (!id) break
      await runDesignJob(id).catch((err) => console.error("[design] job crashed", err))
    }
  })
  void Promise.all(workers)
}

// --- Entry points ---

export async function startInitialGeneration(request: DesignRequestRow): Promise<DesignRow[]> {
  const db = getDb()
  const existing = await db
    .select({ id: designs.id, status: designs.status })
    .from(designs)
    .where(eq(designs.requestId, request.id))
  if (existing.some((d) => d.status === "pending" || d.status === "generating")) {
    throw new JobError("Designs are already generating for this request.")
  }
  if (existing.length > 0) {
    throw new JobError("Designs already exist — use revisions instead.")
  }

  const slug = await ensureRequestQrLink(request)
  const withReference = Boolean(await layoutReference())
  const rows: (typeof designs.$inferInsert)[] = Array.from({ length: VARIANT_COUNT }, (_, i) => ({
    id: newId("dg"),
    requestId: request.id,
    version: i + 1,
    styleKey: request.designStyle,
    prompt: buildTarpPrompt(request, variantHint(i), withReference),
    model: TARP_IMAGE_MODEL,
    qrSlug: slug,
  }))
  const created = await db.insert(designs).values(rows).returning()
  await db
    .update(designRequests)
    .set({ status: "generating", updatedAt: new Date() })
    .where(eq(designRequests.id, request.id))
  for (const row of created) emitDesign(request.id, row.id, "pending", "generating")
  kickJobs(created.map((r) => r.id))
  return created
}

export async function startRevision(
  request: DesignRequestRow,
  parent: DesignRow,
  note: string,
): Promise<DesignRow> {
  if (request.revisionCount >= MAX_REVISIONS) {
    throw new JobError("Revision limit reached.")
  }
  if (parent.status !== "succeeded") {
    throw new JobError("Only completed designs can be revised.")
  }
  const db = getDb()
  const [{ maxVersion }] = await db
    .select({ maxVersion: sql<number>`coalesce(max(${designs.version}), 0)` })
    .from(designs)
    .where(eq(designs.requestId, request.id))

  const [row] = await db
    .insert(designs)
    .values({
      id: newId("dg"),
      requestId: request.id,
      version: Number(maxVersion) + 1,
      parentDesignId: parent.id,
      styleKey: parent.styleKey,
      prompt: buildRevisionPrompt(request, note),
      revisionNote: note.trim(),
      model: TARP_IMAGE_MODEL,
      qrSlug: parent.qrSlug,
    })
    .returning()
  await db
    .update(designRequests)
    .set({
      status: "generating",
      revisionCount: sql`${designRequests.revisionCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(designRequests.id, request.id))
  emitDesign(request.id, row.id, "pending", "generating")
  kickJobs([row.id])
  return row
}

/** Boot recovery: anything left mid-flight by a redeploy is failed-retryable. */
export async function recoverStuckDesigns(): Promise<number> {
  if (!isDbConfigured()) return 0
  const cutoff = new Date(Date.now() - STUCK_JOB_MINUTES * 60 * 1000)
  const db = getDb()
  const stuck = await db
    .update(designs)
    .set({
      status: "failed",
      error: "Generation was interrupted by a restart — try again.",
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(designs.status, ["pending", "generating"]),
        lt(designs.updatedAt, cutoff),
      ),
    )
    .returning({ id: designs.id, requestId: designs.requestId })
  for (const row of stuck) {
    const remaining = await db
      .select({ id: designs.id })
      .from(designs)
      .where(
        and(eq(designs.requestId, row.requestId), inArray(designs.status, ["pending", "generating"])),
      )
    if (remaining.length === 0) {
      await db
        .update(designRequests)
        .set({ status: "reviewing", updatedAt: new Date() })
        .where(and(eq(designRequests.id, row.requestId), eq(designRequests.status, "generating")))
    }
  }
  return stuck.length
}
