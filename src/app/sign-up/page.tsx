import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { AuthForm } from "@/components/auth/auth-form"
import { getServerSession } from "@/lib/auth/session"
import { resolveToken, VISIT_COOKIE } from "@/lib/referrals/store"

export const dynamic = "force-dynamic"

export default async function SignUpPage() {
  const session = await getServerSession()
  if (session) redirect("/account")

  // Visitors who arrived through an alert link carry the referral cookie —
  // resolve it server-side (the token is opaque; no PII ever rides the URL)
  // and prefill the form with what the CRM already knows.
  const token = (await cookies()).get(VISIT_COOKIE)?.value
  const known = token ? await resolveToken(token) : null

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <AuthForm
        mode="sign-up"
        defaultName={known?.name ?? undefined}
        defaultEmail={known?.email ?? undefined}
      />
    </main>
  )
}
