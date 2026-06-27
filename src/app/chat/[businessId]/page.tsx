import { notFound } from "next/navigation"
import type { UIMessage } from "ai"

import { ChatThread } from "@/components/chat-thread"
import { getBusiness, listMatchesForBusiness } from "@/lib/businesses/store"
import { listActiveStorms } from "@/lib/storms/store"
import { buildAlertText } from "@/lib/chat/templates"

export const dynamic = "force-dynamic"

export default async function ChatPage({
  params,
}: {
  params: Promise<{ businessId: string }>
}) {
  const { businessId } = await params
  const business = getBusiness(businessId)
  if (!business) notFound()

  const matches = listMatchesForBusiness(businessId)
  const storms = listActiveStorms()
  const stormById = new Map(storms.map((s) => [s.id, s]))
  const activeMatches = matches
    .filter((m) => stormById.has(m.stormId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const initialMessages: UIMessage[] = activeMatches.map((m) => {
    const storm = stormById.get(m.stormId)!
    return {
      id: `alert:${m.id}`,
      role: "assistant",
      parts: [
        {
          type: "text",
          text: buildAlertText(business, storm, m.distanceMeters),
        },
      ],
      metadata: {
        kind: "alert",
        stormId: storm.id,
        createdAt: m.createdAt,
      },
    }
  })

  return (
    <main className="min-h-screen bg-[#EEF3F9] text-[#0B2037]">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        <ChatThread
          business={business}
          businessId={businessId}
          initialMessages={initialMessages}
        />
      </div>
    </main>
  )
}