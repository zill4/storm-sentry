"use client"

import { useState } from "react"
import { CloudLightning, FlaskConical, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Preset = {
  id: string
  label: string
  description: string
  body: Record<string, unknown>
}

const PRESETS: Preset[] = [
  {
    id: "tx-dallas",
    label: "Dallas · severe thunderstorm",
    description: "15 mi severe thunderstorm over Lone Star Roofing.",
    body: {
      businessId: "biz-tx-01",
      radiusMiles: 15,
      eventType: "Severe Thunderstorm Warning",
      severity: "Severe",
      durationMinutes: 90,
    },
  },
  {
    id: "se-tornado",
    label: "Southeast · tornado outbreak",
    description: "150mi Tornado Warning over AL/MS/GA — 6+ matches.",
    body: {
      lat: 33.0,
      lng: -86.8,
      radiusMiles: 150,
      eventType: "Tornado Warning",
      severity: "Extreme",
      durationMinutes: 120,
    },
  },
  {
    id: "co-hail",
    label: "Colorado · Front Range hail",
    description: "75mi Severe Thunderstorm over CO Front Range — 4 matches.",
    body: {
      lat: 39.9,
      lng: -105.0,
      radiusMiles: 75,
      eventType: "Severe Thunderstorm Warning",
      severity: "Severe",
      durationMinutes: 90,
    },
  },
  {
    id: "fl-hurricane",
    label: "Florida · hurricane warning",
    description: "250mi Hurricane Warning across the FL peninsula.",
    body: {
      lat: 28.0,
      lng: -82.0,
      radiusMiles: 250,
      eventType: "Hurricane Warning",
      severity: "Extreme",
      durationMinutes: 240,
    },
  },
]

type Props = {
  onChange?: () => void
}

export function DemoControls({ onChange }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)

  async function inject(p: Preset) {
    setBusy(p.id)
    try {
      const res = await fetch("/api/replay/inject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p.body),
      })
      const data = await res.json()
      if (res.ok) {
        const created = data.matcher?.matchesCreated ?? 0
        const existing = data.matcher?.matchesExisting ?? 0
        setLastResult(`✓ ${p.label}: ${created} new + ${existing} existing matches`)
        onChange?.()
      } else {
        setLastResult(`✗ ${p.label}: ${data.error ?? "failed"}`)
      }
    } finally {
      setBusy(null)
    }
  }

  async function clear() {
    setBusy("clear")
    try {
      const res = await fetch("/api/replay/clear", { method: "POST" })
      const data = await res.json()
      setLastResult(`✓ Cleared ${data.removed ?? 0} test alerts`)
      onChange?.()
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="rounded-2xl border-[#F47A20]/40 bg-[#F47A20]/15 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-[#0B2037]">
          <FlaskConical className="size-4 text-[#B85614]" />
          Alert simulator
          <Badge variant="outline" className="border-[#F47A20]/40 bg-transparent text-[#B85614]">
            sandbox
          </Badge>
        </CardTitle>
        <CardDescription className="text-[#5A6B7E]">
          Send a sample severe-weather alert to validate matching and downstream
          delivery — useful for onboarding and when live weather is calm.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 md:grid-cols-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => inject(p)}
              disabled={busy !== null}
              className="flex flex-col items-start gap-1 rounded-lg border border-[#D7E0EA] bg-[#FFFFFF] p-3 text-left text-sm shadow-sm hover:bg-[#E4EBF3] disabled:opacity-50"
            >
              <div className="flex items-center gap-2 font-medium text-[#0B2037]">
                <CloudLightning className="size-3.5 text-[#B85614]" />
                {p.label}
                {busy === p.id && (
                  <Badge variant="outline" className="border-[#D7E0EA] text-xs text-[#5A6B7E]">running</Badge>
                )}
              </div>
              <p className="text-xs text-[#5A6B7E]">{p.description}</p>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full border-[#D7E0EA] bg-transparent text-[#0B2037] hover:bg-[#E4EBF3]"
            onClick={clear}
            disabled={busy !== null}
          >
            <Trash2 />
            Clear test alerts
          </Button>
          {lastResult && (
            <span className="text-xs text-[#5A6B7E]">{lastResult}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}