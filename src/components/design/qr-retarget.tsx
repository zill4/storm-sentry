"use client"

import { useState } from "react"
import { Check, Loader2, QrCode } from "lucide-react"

// Inline editor for where a printed QR lands. Lives on the account page (the
// customer's own tarps) and the admin order view.

export function QrRetarget({ slug, initialTarget }: { slug: string; initialTarget: string }) {
  const [value, setValue] = useState(initialTarget)
  const [savedTarget, setSavedTarget] = useState(initialTarget)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const dirty = value.trim() !== savedTarget

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/qr/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl: value.trim() }),
      })
      const body = (await res.json()) as { targetUrl?: string; error?: string }
      if (!res.ok || !body.targetUrl) {
        setError(body.error ?? "Couldn't update the link.")
        return
      }
      setSavedTarget(body.targetUrl)
      setValue(body.targetUrl)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2500)
    } catch {
      setError("Couldn't reach the server — try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-[#5A6B7E]">
        <QrCode className="size-3.5 text-[#1FA6E5]" />
        QR destination — editable any time, even after printing
      </span>
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          className="flex-1 rounded-lg border border-[#D7E0EA] bg-white px-3 py-2 font-mono text-xs text-[#0B2037] outline-none transition focus:border-[#1FA6E5] focus:ring-2 focus:ring-[#1FA6E5]/25"
        />
        <button
          type="button"
          onClick={save}
          disabled={!dirty || busy}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#0B2037] px-3.5 text-xs font-semibold text-white transition hover:bg-[#0B2037]/90 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-3 animate-spin" />
          ) : justSaved ? (
            <Check className="size-3" />
          ) : null}
          {justSaved && !dirty ? "Saved" : "Update"}
        </button>
      </div>
      {error && <p className="text-xs text-[#B22A1E]">{error}</p>}
    </div>
  )
}
