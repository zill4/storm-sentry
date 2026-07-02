import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth/auth"

/** Current session (or null), deduped within a single server render. */
export const getServerSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() })
})

/** For gated pages: returns the session, or redirects to /sign-in. */
export async function requireUser() {
  const session = await getServerSession()
  if (!session) redirect("/sign-in")
  return session
}
