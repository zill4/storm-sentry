import type { Metadata } from "next"

import { DesignReview } from "@/components/design/review"
import { requireUser } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Review your designs — Storm Sentry",
}

export default async function DesignReviewPage() {
  await requireUser()

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <p className="text-[11px] uppercase tracking-[0.14em] text-[#1FA6E5]">Smart Tarp studio</p>
      <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-[#0B2037]">
        Review your designs
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[#5A6B7E]">
        Select the concept you want printed, or ask for changes — you have three revisions
        included before our design team steps in personally.
      </p>
      <div className="mt-6">
        <DesignReview />
      </div>
    </main>
  )
}
