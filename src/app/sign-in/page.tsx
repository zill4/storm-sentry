import { redirect } from "next/navigation"

import { AuthForm } from "@/components/auth/auth-form"
import { getServerSession } from "@/lib/auth/session"
import { safeNextPath } from "@/lib/auth/next-path"

export const dynamic = "force-dynamic"

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const next = safeNextPath((await searchParams).next)
  const session = await getServerSession()
  if (session) redirect(next ?? "/account")

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <AuthForm mode="sign-in" next={next} />
    </main>
  )
}
