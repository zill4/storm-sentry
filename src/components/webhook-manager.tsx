"use client"

import { useEffect, useState } from "react"
import { Plus, RefreshCw, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Subscription = {
  id: string
  url: string
  secret: string | null
  events: string[]
  createdAt: string
  attempts: number
  successes: number
  failures: number
  lastDispatchAt: string | null
  lastError: string | null
  lastStatus: number | null
}

type Delivery = {
  id: string
  subscriptionId: string
  url: string
  eventType: string
  status: number | null
  ok: boolean
  error: string | null
  attemptedAt: string
  durationMs: number
}

function formatTime(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  })
}

const CARD = "rounded-2xl border-[#D7E0EA] bg-white shadow-sm"
const INPUT =
  "rounded-lg border border-[#D7E0EA] bg-white px-3 py-2 text-sm text-[#0B2037] outline-none transition focus:border-[#1FA6E5] focus:ring-2 focus:ring-[#1FA6E5]/25"

export function WebhookManager() {
  const [subs, setSubs] = useState<Subscription[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [url, setUrl] = useState("")
  const [secret, setSecret] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function refresh() {
    const res = await fetch("/api/webhooks", { cache: "no-store" })
    if (!res.ok) return
    const data = await res.json()
    setSubs(data.subscriptions ?? [])
    setDeliveries(data.recentDeliveries ?? [])
  }

  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0)
    const id = setInterval(() => void refresh(), 4000)
    return () => {
      clearTimeout(initial)
      clearInterval(id)
    }
  }, [])

  async function createSub(e: React.FormEvent) {
    e.preventDefault()
    if (!url) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, secret: secret || undefined }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg(`✓ Subscribed: ${data.subscription.id}`)
        setUrl("")
        setSecret("")
        refresh()
      } else {
        setMsg(`✗ ${JSON.stringify(data.error)}`)
      }
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    try {
      await fetch(`/api/webhooks/${id}`, { method: "DELETE" })
      refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className={CARD}>
        <CardHeader>
          <CardTitle className="text-base">Subscribe a webhook</CardTitle>
          <CardDescription className="text-[#5A6B7E]">
            Storm Sentry POSTs <code>storm_sentry.match.v1</code> events to your
            URL the moment a match fires. Use the local sink at{" "}
            <code>/api/webhook-sink</code> if you just want to see what arrives.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createSub} className="flex flex-wrap items-end gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-[#5A6B7E]">URL</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-chat-app.example.com/storm-sentry/inbound"
                className={`flex-1 ${INPUT}`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#5A6B7E]">Secret (optional)</label>
              <input
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="bearer token"
                className={INPUT}
              />
            </div>
            <Button type="submit" disabled={busy || !url}>
              <Plus />
              Subscribe
            </Button>
            <Button type="button" variant="outline" onClick={refresh} disabled={busy}>
              <RefreshCw />
              Refresh
            </Button>
          </form>
          {msg && <p className="mt-2 text-xs text-[#5A6B7E]">{msg}</p>}
        </CardContent>
      </Card>

      <Card className={CARD}>
        <CardHeader>
          <CardTitle className="text-base">Active subscriptions ({subs.length})</CardTitle>
          <CardDescription className="text-[#5A6B7E]">Live counts from the delivery log.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Events</TableHead>
                <TableHead className="w-32">Stats</TableHead>
                <TableHead className="w-44">Last dispatch</TableHead>
                <TableHead className="w-12 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-[#8B98A8]">
                    No webhook subscriptions yet.
                  </TableCell>
                </TableRow>
              )}
              {subs.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.id}</TableCell>
                  <TableCell className="max-w-xs truncate text-xs">{s.url}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {s.events.map((e) => (
                        <Badge key={e} variant="outline" className="text-xs">
                          {e}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {s.successes}/{s.attempts} ok
                    {s.failures > 0 && (
                      <span className="text-[#D93A2B]"> · {s.failures} failed</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {formatTime(s.lastDispatchAt)}
                    {s.lastStatus !== null && (
                      <span className="ml-2 text-[#8B98A8]">HTTP {s.lastStatus}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(s.id)}
                      disabled={busy}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className={CARD}>
        <CardHeader>
          <CardTitle className="text-base">Recent deliveries ({deliveries.length})</CardTitle>
          <CardDescription className="text-[#5A6B7E]">Last 20 webhook attempts across all subscriptions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">When</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>URL</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-20">Took</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-[#8B98A8]">
                    No deliveries yet. They appear here as alerts fire.
                  </TableCell>
                </TableRow>
              )}
              {deliveries.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-xs tabular-nums">{formatTime(d.attemptedAt)}</TableCell>
                  <TableCell className="text-xs">{d.eventType}</TableCell>
                  <TableCell className="max-w-xs truncate text-xs">{d.url}</TableCell>
                  <TableCell>
                    {d.ok ? (
                      <Badge className="bg-[#2FA37A]/12 text-[#247A5B]">{d.status}</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-[#D93A2B]/10 text-[#B22A1E]">
                        {d.status ?? "err"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">{d.durationMs}ms</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
