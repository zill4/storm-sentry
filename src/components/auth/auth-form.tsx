"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"

import { StormSentryMark } from "@/components/brand/logo"
import { signIn, signUp } from "@/lib/auth/client"

const INPUT =
  "w-full rounded-lg border border-[#D7E0EA] bg-white px-3 py-2.5 text-sm text-[#0B2037] outline-none transition placeholder:text-[#8B98A8] focus:border-[#1FA6E5] focus:ring-2 focus:ring-[#1FA6E5]/25"
const LABEL = "text-xs font-medium text-[#5A6B7E]"

export function AuthForm({
  mode,
  defaultName,
  defaultEmail,
}: {
  mode: "sign-in" | "sign-up"
  /** Prefill for visitors we already know from an alert link (see /api/visit). */
  defaultName?: string
  defaultEmail?: string
}) {
  const isSignUp = mode === "sign-up"
  const [name, setName] = useState(defaultName ?? "")
  const [email, setEmail] = useState(defaultEmail ?? "")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }

    setPending(true)
    try {
      const result = isSignUp
        ? await signUp.email({ name: name.trim(), email: email.trim(), password })
        : await signIn.email({ email: email.trim(), password })

      if (result.error) {
        setError(result.error.message ?? "Something went wrong. Please try again.")
        setPending(false)
        return
      }
      // Hard navigation so server components (nav + account) re-read the new
      // session cookie. Keep `pending` true through the redirect.
      window.location.assign("/account")
    } catch {
      setError("Couldn't reach the server. Please try again.")
      setPending(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-2xl border border-[#D7E0EA] bg-white p-7 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <StormSentryMark className="size-11" />
          <h1 className="font-display mt-4 text-2xl font-bold tracking-tight text-[#0B2037]">
            {isSignUp ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-[#5A6B7E]">
            {isSignUp
              ? "Save ZIPs, set alerts, and manage notifications."
              : "Sign in to your Storm Sentry account."}
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          {isSignUp && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className={LABEL}>
                Name
              </label>
              <input
                id="name"
                name="name"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jordan Rivera"
                className={INPUT}
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className={LABEL}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className={INPUT}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className={LABEL}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignUp ? "At least 8 characters" : "••••••••"}
              className={INPUT}
            />
          </div>

          {error && (
            <p className="rounded-lg border border-[#D93A2B]/30 bg-[#D93A2B]/10 px-3 py-2 text-xs text-[#B22A1E]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0B2037] px-4 text-sm font-semibold text-white transition hover:bg-[#0B2037]/90 disabled:opacity-60"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>
      </div>

      <p className="mt-4 text-center text-sm text-[#5A6B7E]">
        {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
        <Link
          href={isSignUp ? "/sign-in" : "/sign-up"}
          className="font-medium text-[#1FA6E5] hover:underline"
        >
          {isSignUp ? "Sign in" : "Create one"}
        </Link>
      </p>
    </div>
  )
}
