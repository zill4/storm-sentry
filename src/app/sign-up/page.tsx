import { redirect } from "next/navigation"

import { AuthForm } from "@/components/auth/auth-form"
import { getServerSession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

export default async function SignUpPage() {
  const session = await getServerSession()
  if (session) redirect("/account")

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <AuthForm mode="sign-up" />
    </main>
  )
}
