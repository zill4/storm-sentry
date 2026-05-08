import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai"

import { getBusiness } from "@/lib/businesses/store"
import { buildScriptedReply } from "@/lib/chat/templates"

export const dynamic = "force-dynamic"

type IncomingBody = {
  id?: string
  messages: UIMessage[]
}

function lastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== "user") continue
    const text = (m.parts ?? [])
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("\n")
      .trim()
    if (text) return text
  }
  return ""
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await params
  const body = (await req.json()) as IncomingBody
  const business = getBusiness(businessId)
  if (!business) {
    return new Response(JSON.stringify({ error: "business not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  const userText = lastUserText(body.messages ?? [])
  const replyText = buildScriptedReply(userText, business)

  const stream = createUIMessageStream({
    async execute({ writer }) {
      const id = `reply:${Date.now()}`
      writer.write({ type: "text-start", id })
      // Simulate token-by-token streaming for nicer UX.
      const chunks: string[] = []
      for (let i = 0; i < replyText.length; i += 4) {
        chunks.push(replyText.slice(i, i + 4))
      }
      for (const chunk of chunks) {
        writer.write({ type: "text-delta", id, delta: chunk })
        await new Promise((r) => setTimeout(r, 18))
      }
      writer.write({ type: "text-end", id })
    },
  })

  return createUIMessageStreamResponse({ stream })
}
