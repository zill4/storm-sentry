"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { ArrowLeft, Bell, MessageSquare, RefreshCw, Send } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useLiveEvents } from "@/lib/use-live-events"
import type { Business } from "@/lib/businesses/types"

type Props = {
  business: Business
  businessId: string
  initialMessages: UIMessage[]
}

function partsToText(m: UIMessage): string {
  return (m.parts ?? [])
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

function isAlertMessage(m: UIMessage): boolean {
  return Boolean((m as UIMessage & { metadata?: { kind?: string } }).metadata?.kind === "alert")
}

export function ChatThread({ business, businessId, initialMessages }: Props) {
  const [transport] = useState(
    () => new DefaultChatTransport({ api: `/api/chat/${businessId}` }),
  )
  const { messages, sendMessage, status, setMessages } = useChat({
    id: `biz-${businessId}`,
    messages: initialMessages,
    transport,
  })
  const [input, setInput] = useState("")
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
    }
  }, [messages, status])

  async function refreshAlerts() {
    const res = await fetch(`/api/chat/${businessId}/initial`, { cache: "no-store" })
    if (!res.ok) return
    const data = (await res.json()) as { messages: UIMessage[] }
    // Replace alert messages but keep typed user/assistant messages.
    setMessages((prev) => {
      const nonAlerts = prev.filter((m) => !isAlertMessage(m))
      return [...data.messages, ...nonAlerts]
    })
  }

  // Live: refresh alerts whenever a relevant server event lands.
  useLiveEvents((event) => {
    if (
      event.type === "match_created" ||
      event.type === "storm_removed" ||
      event.type === "fixtures_cleared" ||
      event.type === "matches_pruned"
    ) {
      refreshAlerts()
    }
  })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return
    setInput("")
    await sendMessage({ text: trimmed })
  }

  const alertCount = messages.filter(isAlertMessage).length

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-2xl border-[#D7E0EA] bg-[#FFFFFF] shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between border-b border-[#D7E0EA]">
          <div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon-sm" render={<Link href="/contacts" />}>
                <ArrowLeft />
              </Button>
              <CardTitle className="text-base">{business.name}</CardTitle>
              <Badge variant="outline" className="border-[#D7E0EA] text-xs text-[#5A6B7E]">
                {business.city}, {business.state}
              </Badge>
            </div>
            <CardDescription className="mt-1 text-[#5A6B7E]">
              Operator-to-roofer chat surface · simulated. Storm Sentry posts an
              alert here the moment a match fires; this is the same payload the
              operator&apos;s real chat app would receive.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-[#D7E0EA] bg-transparent text-[#5A6B7E]">
              <Bell className="mr-1 size-3" />
              {alertCount} alert{alertCount === 1 ? "" : "s"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-[#D7E0EA] bg-transparent text-[#0B2037] hover:bg-[#E4EBF3]"
              onClick={refreshAlerts}
              disabled={status === "submitted" || status === "streaming"}
            >
              <RefreshCw />
              Sync alerts
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div
            ref={scrollerRef}
            className="flex h-[480px] flex-col gap-3 overflow-y-auto bg-[#E4EBF3]/40 p-4"
          >
            {messages.length === 0 && (
              <div className="m-auto text-center text-sm text-[#8B98A8]">
                <MessageSquare className="mx-auto mb-2 size-6 text-[#8B98A8]" />
                No conversation yet.
                <p className="mt-1">
                  Inject a fixture storm from the dashboard to trigger an alert
                  message in this thread.
                </p>
              </div>
            )}
            {messages.map((m) => {
              const text = partsToText(m)
              const isAlert = isAlertMessage(m)
              const isUser = m.role === "user"
              return (
                <ChatBubble
                  key={m.id}
                  text={text}
                  side={isUser ? "right" : "left"}
                  variant={isAlert ? "alert" : isUser ? "user" : "operator"}
                />
              )
            })}
            {status === "streaming" && (
              <div className="text-xs text-[#8B98A8]">operator typing…</div>
            )}
          </div>
        </CardContent>
      </Card>

      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 rounded-2xl border border-[#D7E0EA] bg-[#FFFFFF] p-2 shadow-sm"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Reply as the roofer (try 'yes', 'price', 'when can you deploy')…"
          className="flex-1 bg-transparent px-3 py-2 text-sm text-[#0B2037] outline-none placeholder:text-[#8B98A8]"
          disabled={status === "submitted" || status === "streaming"}
        />
        <Button
          type="submit"
          className="rounded-full bg-[#0B2037] text-[#FFFFFF] hover:bg-[#0B2037]/90"
          disabled={!input.trim() || status === "submitted" || status === "streaming"}
        >
          <Send />
          Send
        </Button>
      </form>
    </div>
  )
}

function ChatBubble({
  text,
  side,
  variant,
}: {
  text: string
  side: "left" | "right"
  variant: "alert" | "user" | "operator"
}) {
  const align = side === "left" ? "items-start" : "items-end"
  const bubble =
    variant === "alert"
      ? "bg-[#F47A20]/15 text-[#0B2037] ring-1 ring-[#F47A20]/40"
      : variant === "user"
      ? "bg-[#0B2037] text-[#FFFFFF]"
      : "bg-[#FFFFFF] ring-1 ring-[#D7E0EA] text-[#0B2037]"
  const label =
    variant === "alert"
      ? "Storm Sentry → Operator chat"
      : variant === "user"
      ? "Roofer reply"
      : "Operator"
  return (
    <div className={`flex flex-col ${align} max-w-full`}>
      <span className="mb-1 text-[11px] uppercase tracking-[0.08em] text-[#5A6B7E]">
        {label}
      </span>
      <div className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-6 ${bubble}`}>
        {text}
      </div>
    </div>
  )
}