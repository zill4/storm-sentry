import type { Metadata } from "next"

import { DesignWizard } from "@/components/design/wizard"
import { getServerSession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Design your Smart Tarp — Storm Sentry",
  description:
    "Answer a few questions, upload your logo, and generate print-ready Smart Tarp design concepts.",
}

export default async function DesignPage() {
  const session = await getServerSession()

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <p className="text-[11px] uppercase tracking-[0.14em] text-[#1FA6E5]">Smart Tarp studio</p>
      <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-[#0B2037]">
        Design your Smart Tarp
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[#5A6B7E]">
        A few quick questions, your logo, and our design engine drafts tarp concepts for your
        review — with a scannable QR code you can re-point any time.
      </p>
      <div className="mt-6">
        <DesignWizard signedIn={Boolean(session)} />
      </div>
    </main>
  )
}
