import { cookies } from "next/headers"

import { getServerSession } from "@/lib/auth/session"
import {
  DRAFT_COOKIE,
  claimDraft,
  getActiveRequestForUser,
  getDraftByKey,
  type DesignRequestRow,
} from "./store"

// Resolves "the current customer's design request" for API routes and pages.
// Ownership is either the signed-in user or the anonymous draft cookie; a
// signed-in load with an unclaimed cookie draft claims it as a side effect
// (that's the account-gate handoff).

export type DraftContext = {
  draft: DesignRequestRow | null
  draftKey: string | null // cookie value, if present
  userId: string | null
}

export async function resolveDraftContext(): Promise<DraftContext> {
  const session = await getServerSession()
  const userId = session?.user.id ?? null
  const jar = await cookies()
  const draftKey = jar.get(DRAFT_COOKIE)?.value ?? null

  if (userId) {
    // Claim any anonymous draft riding in on the cookie before resolving, so
    // the freshly signed-up user resumes the exact wizard they started.
    if (draftKey) await claimDraft(draftKey, userId)
    const draft = await getActiveRequestForUser(userId)
    return { draft, draftKey, userId }
  }

  const draft = draftKey ? await getDraftByKey(draftKey) : null
  // Cookie drafts someone else already claimed are not this visitor's to see.
  return { draft: draft && draft.userId ? null : draft, draftKey, userId }
}

/** True when this context may read/write the given request. */
export function ownsRequest(ctx: DraftContext, row: DesignRequestRow): boolean {
  if (row.userId) return Boolean(ctx.userId && ctx.userId === row.userId)
  return Boolean(ctx.draftKey && row.draftKey === ctx.draftKey)
}
