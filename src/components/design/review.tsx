"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Loader2, QrCode, RefreshCw, Send, XCircle } from "lucide-react"

import { useLiveEvents } from "@/lib/use-live-events"

// Post-generation review: variant grid + the revision chat. All chat content
// is derived from server state (designs, revision notes, statuses), so a
// refresh reconstructs the exact conversation. Live updates ride the existing
// SSE bus (design_updated) with a slow poll as belt-and-suspenders.

type StateDesign = {
  id: string
  version: number
  status: "pending" | "generating" | "succeeded" | "failed"
  error: string | null
  revisionNote: string | null
  parentDesignId: string | null
  imageUrl: string | null
  selectedAt: string | null
  createdAt: string
}

type ReviewState = {
  request: {
    id: string
    status: string
    businessName: string | null
    revisionCount: number
    revisionsRemaining: number
  } | null
  supportEmail?: string
  qr?: { slug: string; url: string; targetUrl: string; hits: number } | null
  designs?: StateDesign[]
}

export function DesignReview() {
  const [state, setState] = useState<ReviewState | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [reviseTarget, setReviseTarget] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [flowError, setFlowError] = useState<string | null>(null)
  const [selecting, setSelecting] = useState(false)
  const scrollerRef = useRef<HTMLDivElement>(null)

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/design/state", { cache: "no-store" })
      if (!res.ok) return
      setState((await res.json()) as ReviewState)
    } catch {
      /* transient */
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await refetch()
      if (!cancelled) setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [refetch])

  useLiveEvents((event) => {
    if (event.type === "design_updated") refetch()
  })

  const generating = useMemo(
    () => (state?.designs ?? []).some((d) => d.status === "pending" || d.status === "generating"),
    [state],
  )

  // Poll fallback while jobs run, in case the SSE stream drops.
  useEffect(() => {
    if (!generating) return
    const t = setInterval(refetch, 5000)
    return () => clearInterval(t)
  }, [generating, refetch])

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" })
  }, [state?.designs?.length, generating, flowError, reviseTarget])

  async function submitRevision(e: React.FormEvent) {
    e.preventDefault()
    if (!reviseTarget || !note.trim()) return
    setBusy(true)
    setFlowError(null)
    try {
      const res = await fetch("/api/design/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId: reviseTarget, note: note.trim() }),
      })
      const body = (await res.json()) as { error?: string }
      if (!res.ok) {
        setFlowError(body.error ?? "Couldn't start the revision.")
      } else {
        setNote("")
        setReviseTarget(null)
        await refetch()
      }
    } catch {
      setFlowError("Couldn't reach the server — try again.")
    } finally {
      setBusy(false)
    }
  }

  async function selectDesign(designId: string) {
    setSelecting(true)
    setFlowError(null)
    try {
      const res = await fetch("/api/design/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId }),
      })
      const body = (await res.json()) as { error?: string }
      if (!res.ok) {
        setFlowError(body.error ?? "Couldn't submit your selection.")
        setSelecting(false)
        return
      }
      window.location.assign("/account")
    } catch {
      setFlowError("Couldn't reach the server — try again.")
      setSelecting(false)
    }
  }

  if (!loaded) {
    return (
      <div className="flex h-64 items-center justify-center text-[#8B98A8]">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }

  if (!state?.request || (state.designs ?? []).length === 0) {
    return (
      <div className="rounded-2xl border border-[#D7E0EA] bg-white p-6 shadow-sm">
        <p className="text-sm text-[#5A6B7E]">
          No designs yet — finish the intake first and we&apos;ll generate your concepts.
        </p>
        <Link
          href="/design"
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-[#0B2037] px-4 text-sm font-semibold text-white transition hover:bg-[#0B2037]/90"
        >
          <ArrowLeft className="size-3.5" />
          Back to the intake
        </Link>
      </div>
    )
  }

  const designs = state.designs ?? []
  const succeeded = designs.filter((d) => d.status === "succeeded")
  const revisionsRemaining = state.request.revisionsRemaining
  const limitReached = revisionsRemaining <= 0
  const targetDesign = designs.find((d) => d.id === reviseTarget)

  return (
    <div className="flex flex-col gap-4">
      {/* Variant grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {designs.map((d) => (
          <div
            key={d.id}
            className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ${
              d.selectedAt ? "border-[#1FA6E5] ring-2 ring-[#1FA6E5]/30" : "border-[#D7E0EA]"
            }`}
          >
            <div className="flex aspect-[2/1] items-center justify-center bg-[#E4EBF3]/60">
              {d.status === "succeeded" && d.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={d.imageUrl}
                  alt={`Concept ${d.version}`}
                  className="h-full w-full object-contain"
                />
              ) : d.status === "failed" ? (
                <div className="flex flex-col items-center gap-1 px-4 text-center">
                  <XCircle className="size-5 text-[#D93A2B]" />
                  <span className="text-xs text-[#5A6B7E]">{d.error ?? "Generation failed."}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5">
                  <Loader2 className="size-5 animate-spin text-[#1FA6E5]" />
                  <span className="text-xs text-[#8B98A8]">
                    {d.status === "pending" ? "Queued…" : "Generating…"}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-[#D7E0EA] px-3 py-2">
              <span className="text-[11px] uppercase tracking-[0.08em] text-[#5A6B7E]">
                {d.revisionNote ? `Revision · v${d.version}` : `Concept ${d.version}`}
              </span>
              {d.status === "succeeded" && (
                <div className="flex items-center gap-1.5">
                  {!limitReached && (
                    <button
                      type="button"
                      onClick={() => setReviseTarget(d.id)}
                      className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs transition ${
                        reviseTarget === d.id
                          ? "border-[#1FA6E5] bg-[#1FA6E5]/10 text-[#0B2037]"
                          : "border-[#D7E0EA] text-[#5A6B7E] hover:bg-[#E4EBF3]"
                      }`}
                    >
                      <RefreshCw className="size-3" />
                      Revise
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={selecting}
                    onClick={() => selectDesign(d.id)}
                    className="inline-flex h-7 items-center gap-1 rounded-full bg-[#0B2037] px-2.5 text-xs font-semibold text-white transition hover:bg-[#0B2037]/90 disabled:opacity-60"
                  >
                    <CheckCircle2 className="size-3" />
                    Select
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* QR note */}
      {state.qr && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-[#D7E0EA] bg-white px-4 py-3 shadow-sm">
          <QrCode className="mt-0.5 size-4 shrink-0 text-[#1FA6E5]" />
          <p className="text-xs leading-5 text-[#5A6B7E]">
            The QR code on every concept is live: it points to{" "}
            <span className="font-mono text-[#0B2037]">{state.qr.targetUrl}</span> via{" "}
            <span className="font-mono text-[#0B2037]">{state.qr.url}</span>. Scan it right off
            your screen to test it — and you can re-point it any time from your account, even
            after the tarp is printed.
          </p>
        </div>
      )}

      {/* Revision chat */}
      <div className="rounded-2xl border border-[#D7E0EA] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#D7E0EA] px-4 py-3">
          <span className="text-sm font-semibold text-[#0B2037]">Design review</span>
          <span className="font-mono text-xs tabular-nums text-[#5A6B7E]">
            {revisionsRemaining} revision{revisionsRemaining === 1 ? "" : "s"} left
          </span>
        </div>
        <div
          ref={scrollerRef}
          className="flex max-h-[40vh] min-h-[180px] flex-col gap-3 overflow-y-auto bg-[#E4EBF3]/40 p-4"
        >
          <ChatLine side="left">
            {generating
              ? "Your concepts are rendering — each one takes a minute or two. They'll appear above as they finish."
              : succeeded.length > 0
                ? "Here are your concepts. Love one? Hit Select and it goes to our print team. Want tweaks? Pick Revise on a design and tell me what to change."
                : "Generation hit a snag on every concept. Use the intake to double-check your logo, then try again — or contact support and we'll take over."}
          </ChatLine>
          {designs
            .filter((d) => d.revisionNote)
            .map((d) => (
              <div key={d.id} className="flex flex-col gap-3">
                <ChatLine side="right">{d.revisionNote}</ChatLine>
                <ChatLine side="left">
                  {d.status === "succeeded"
                    ? `Revision ready — see v${d.version} above.`
                    : d.status === "failed"
                      ? `That revision failed: ${d.error ?? "unknown error"}`
                      : `Working on it — v${d.version} is rendering now.`}
                </ChatLine>
              </div>
            ))}
          {limitReached && (
            <ChatLine side="left">
              {`You've used all your included revisions. Our human design team is happy to take it from here — email `}
              <a
                className="font-medium text-[#1FA6E5] hover:underline"
                href={`mailto:${state.supportEmail}`}
              >
                {state.supportEmail}
              </a>
              {` with your request, or select the concept that's closest and add notes for the team.`}
            </ChatLine>
          )}
          {flowError && (
            <p className="rounded-lg border border-[#D93A2B]/30 bg-[#D93A2B]/10 px-3 py-2 text-xs text-[#B22A1E]">
              {flowError}
            </p>
          )}
        </div>
        <form onSubmit={submitRevision} className="border-t border-[#D7E0EA] p-2.5">
          {targetDesign && (
            <div className="mb-1.5 flex items-center gap-2 px-1">
              <span className="rounded-full bg-[#1FA6E5]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#0B2037]">
                Revising {targetDesign.revisionNote ? `v${targetDesign.version}` : `Concept ${targetDesign.version}`}
              </span>
              <button
                type="button"
                onClick={() => setReviseTarget(null)}
                className="text-[11px] text-[#8B98A8] hover:text-[#0B2037]"
              >
                cancel
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={limitReached || busy || generating}
              placeholder={
                limitReached
                  ? "Revision limit reached — contact support for further changes"
                  : generating
                    ? "Hold on — designs are still rendering"
                    : reviseTarget
                      ? "Describe the change: e.g. make the phone number bigger, use a darker blue…"
                      : "Pick Revise on a design above, then describe your change here"
              }
              className="flex-1 bg-transparent px-3 py-2 text-sm text-[#0B2037] outline-none placeholder:text-[#8B98A8] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!reviseTarget || !note.trim() || busy || limitReached || generating}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#0B2037] px-4 text-sm font-semibold text-white transition hover:bg-[#0B2037]/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ChatLine({ side, children }: { side: "left" | "right"; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col ${side === "left" ? "items-start" : "items-end"}`}>
      <span className="mb-1 text-[11px] uppercase tracking-[0.08em] text-[#5A6B7E]">
        {side === "left" ? "Tarp Studio" : "You"}
      </span>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-6 whitespace-pre-wrap ${
          side === "left" ? "bg-white text-[#0B2037] ring-1 ring-[#D7E0EA]" : "bg-[#0B2037] text-white"
        }`}
      >
        {children}
      </div>
    </div>
  )
}
