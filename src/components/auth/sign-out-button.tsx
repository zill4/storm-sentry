"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"

import { signOut } from "@/lib/auth/client"

export function SignOutButton({
  variant = "icon",
}: {
  variant?: "icon" | "full"
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handle() {
    setPending(true)
    await signOut()
    router.push("/")
    router.refresh()
  }

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={handle}
        disabled={pending}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#D7E0EA] bg-white px-4 text-sm font-medium text-[#0B2037] transition hover:bg-[#E4EBF3] disabled:opacity-60"
      >
        <LogOut className="size-4" />
        Sign out
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      aria-label="Sign out"
      className="flex size-8 items-center justify-center rounded-full text-[#5A6B7E] transition hover:bg-[#E4EBF3] hover:text-[#0B2037] disabled:opacity-60"
    >
      <LogOut className="size-4" />
    </button>
  )
}
