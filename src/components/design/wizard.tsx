"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Loader2, PencilLine, Sparkles } from "lucide-react"

import { Progress } from "@/components/ui/progress"
import {
  HOW_FOUND,
  QR_ACTIONS,
  SERVICES,
  VENDOR_BADGES,
  designStyle,
} from "@/lib/design/types"
import {
  ChipsDock,
  ConsentDock,
  StyleDock,
  TextDock,
  TextareaDock,
  UploadDock,
} from "./wizard-inputs"
import { firstName, type ClientDraft, type ClientUpload, type DraftResponse } from "./wizard-types"

// The typeform-style intake: a deterministic state machine rendered as a chat
// transcript. No LLM here on purpose — questions are fixed, answers land as a
// PATCH on the server-side draft, and a refresh resumes exactly where the
// customer left off. The model only enters the flow after generation, in the
// revision loop.

type StepKey =
  | "fullName"
  | "businessName"
  | "email"
  | "phone"
  | "website"
  | "shippingAddress"
  | "services"
  | "vendorBadges"
  | "designStyle"
  | "qrAction"
  | "qrTarget"
  | "logo"
  | "specialInstructions"
  | "howFound"
  | "consents"
  | "review"

type Step = {
  key: StepKey
  question: (draft: ClientDraft | null, uploads: ClientUpload[]) => string
  answered: (draft: ClientDraft | null, uploads: ClientUpload[]) => boolean
  summary: (draft: ClientDraft, uploads: ClientUpload[]) => string | null
}

const qrActionLabel = (key: string | null) =>
  QR_ACTIONS.find((a) => a.key === key)?.label ?? key ?? ""

const STEPS: Step[] = [
  {
    key: "fullName",
    question: () =>
      "Welcome to the Smart Tarp design studio. Answer a few quick questions, upload your logo, and we'll generate tarp design concepts for your review. First things first — what's your full name?",
    answered: (d) => Boolean(d?.fullName?.trim()),
    summary: (d) => d.fullName,
  },
  {
    key: "businessName",
    question: (d) =>
      `Thanks${firstName(d) ? `, ${firstName(d)}` : ""}. What's the name of your business — exactly as it should appear on the tarp?`,
    answered: (d) => Boolean(d?.businessName?.trim()),
    summary: (d) => d.businessName,
  },
  {
    key: "email",
    question: () => "What email should we use for your proofs and order updates?",
    answered: (d) => Boolean(d?.email?.trim()),
    summary: (d) => d.email,
  },
  {
    key: "phone",
    question: () =>
      "What's the best phone number? If your design features a call banner, this is the number we'll print.",
    answered: (d) => Boolean(d?.phone?.trim()),
    summary: (d) => d.phone,
  },
  {
    key: "website",
    question: () => "What's your website?",
    answered: (d) => Boolean(d?.website?.trim()),
    summary: (d) => d.website,
  },
  {
    key: "shippingAddress",
    question: () => "Where should the finished tarps ship? Full address, please.",
    answered: (d) => Boolean(d?.shippingAddress?.trim()),
    summary: (d) => d.shippingAddress,
  },
  {
    key: "services",
    question: () => "Which services do you want listed on the tarp? Pick all that apply.",
    answered: (d) => Boolean(d?.services?.length),
    summary: (d) => d.services?.join(", ") ?? null,
  },
  {
    key: "vendorBadges",
    question: () =>
      "Which vendor badges should we include? These build the trust stack — pick all that apply.",
    answered: (d) => Boolean(d?.vendorBadges?.length),
    summary: (d) => d.vendorBadges?.join(", ") ?? null,
  },
  {
    key: "designStyle",
    question: () =>
      "Now the big one: choose your design style. This sets the focus of the whole layout and helps us nail the first proof.",
    answered: (d) => Boolean(d?.designStyle),
    summary: (d) => {
      const s = designStyle(d.designStyle)
      return s ? `${s.name} (${s.tagline})` : d.designStyle
    },
  },
  {
    key: "qrAction",
    question: () =>
      "Every Smart Tarp carries a scannable QR code, and you can change where it points at any time — even after printing. What should it do when scanned?",
    answered: (d) => Boolean(d?.qrAction),
    summary: (d) => qrActionLabel(d.qrAction),
  },
  {
    key: "qrTarget",
    question: (d) =>
      d?.qrAction === "call"
        ? "What phone number should the QR code dial?"
        : d?.qrAction === "quote"
          ? "Paste the link to your quote tool or landing page."
          : "What web address should the QR code open?",
    answered: (d) => Boolean(d?.qrTargetUrl?.trim()),
    summary: (d) =>
      d.qrTargetUrl?.startsWith("tel:") ? d.qrTargetUrl.replace("tel:", "Call ") : d.qrTargetUrl,
  },
  {
    key: "logo",
    question: () =>
      "Upload your logo. High resolution matters here — a vector PDF is ideal, or an image at least 5000px wide. JPEG, PNG, EPS, TIFF, and PSD all work.",
    answered: (_d, uploads) => uploads.length > 0,
    summary: (_d, uploads) => uploads.map((u) => u.fileName).join(", ") || null,
  },
  {
    key: "specialInstructions",
    question: () =>
      "Any special design instructions? Colors to avoid, a slogan, license numbers — anything the designer should know. This one's optional.",
    answered: (d) => d?.specialInstructions !== null && d?.specialInstructions !== undefined,
    summary: (d) => (d.specialInstructions?.trim() ? d.specialInstructions : "None"),
  },
  {
    key: "howFound",
    question: () => "Almost done. How did you find us?",
    answered: (d) => Boolean(d?.howFound?.trim()),
    summary: (d) =>
      d.howFound === "Other" && d.howFoundOther ? `Other — ${d.howFoundOther}` : d.howFound,
  },
  {
    key: "consents",
    question: () =>
      "Last step before your designs: text-message consent for order updates (required), and optionally for offers.",
    answered: (d) => Boolean(d?.consentTransactionalSms),
    summary: (d) =>
      `Order updates: agreed · Marketing: ${d.consentMarketingSms ? "agreed" : "declined"}`,
  },
  {
    key: "review",
    question: () =>
      "Here's everything we'll hand to the design engine. Give it a once-over — you can change any answer.",
    answered: () => false,
    summary: () => null,
  },
]

const ANSWERABLE_COUNT = STEPS.length - 1 // review isn't an answer

function Bubble({
  side,
  variant,
  label,
  children,
}: {
  side: "left" | "right"
  variant: "studio" | "user"
  label: string
  children: React.ReactNode
}) {
  return (
    <div className={`flex max-w-full flex-col ${side === "left" ? "items-start" : "items-end"}`}>
      <span className="mb-1 text-[11px] uppercase tracking-[0.08em] text-[#5A6B7E]">{label}</span>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-6 whitespace-pre-wrap ${
          variant === "user"
            ? "bg-[#0B2037] text-white"
            : "bg-white text-[#0B2037] ring-1 ring-[#D7E0EA]"
        }`}
      >
        {children}
      </div>
    </div>
  )
}

export function DesignWizard({ signedIn }: { signedIn: boolean }) {
  const [draft, setDraft] = useState<ClientDraft | null>(null)
  const [uploads, setUploads] = useState<ClientUpload[]>([])
  const [loaded, setLoaded] = useState(false)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [cursor, setCursor] = useState(0)
  const [editingFromReview, setEditingFromReview] = useState(false)
  // The question for `cursor` is revealed once this catches up — the gap is
  // rendered as the typing indicator.
  const [revealedCursor, setRevealedCursor] = useState(-1)
  const typing = revealedCursor !== cursor
  const [saving, setSaving] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [uploadWarning, setUploadWarning] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [flowError, setFlowError] = useState<string | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)

  const step = STEPS[cursor]

  const firstUnanswered = useCallback((d: ClientDraft | null, ups: ClientUpload[]) => {
    const idx = STEPS.findIndex((s) => s.key !== "review" && !s.answered(d, ups))
    return idx === -1 ? STEPS.length - 1 : idx
  }, [])

  // Load (or resume) the draft.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/design/draft", { cache: "no-store" })
        if (res.status === 503) {
          const body = (await res.json()) as { error?: string }
          if (!cancelled) setUnavailable(body.error ?? "The design studio is briefly offline.")
          return
        }
        const body = (await res.json()) as DraftResponse
        if (cancelled) return
        if (body.draft) {
          setDraft(body.draft)
          setUploads(body.uploads ?? [])
          setCursor(firstUnanswered(body.draft, body.uploads ?? []))
        }
      } catch {
        if (!cancelled) setUnavailable("Couldn't reach the design studio. Refresh to try again.")
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [firstUnanswered])

  // Typing indicator between questions, for pacing.
  useEffect(() => {
    const t = setTimeout(() => setRevealedCursor(cursor), 420)
    return () => clearTimeout(t)
  }, [cursor])

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" })
  }, [cursor, typing, uploads.length, generating, flowError])

  const applyResponse = useCallback((body: DraftResponse) => {
    if (body.draft) setDraft(body.draft)
    if (body.uploads) setUploads(body.uploads)
  }, [])

  const ensureDraft = useCallback(async (): Promise<boolean> => {
    if (draft) return true
    const res = await fetch("/api/design/draft", { method: "POST" })
    if (!res.ok) return false
    applyResponse((await res.json()) as DraftResponse)
    return true
  }, [draft, applyResponse])

  const save = useCallback(
    async (patch: Record<string, unknown>) => {
      setSaving(true)
      setFlowError(null)
      try {
        if (!(await ensureDraft())) throw new Error("draft create failed")
        const res = await fetch("/api/design/draft", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        })
        if (!res.ok) throw new Error(`save failed (${res.status})`)
        const body = (await res.json()) as DraftResponse
        applyResponse(body)
        if (editingFromReview) {
          setEditingFromReview(false)
          setCursor(STEPS.length - 1)
        } else {
          setCursor((c) => Math.min(c + 1, STEPS.length - 1))
        }
      } catch {
        setFlowError("That didn't save — check your connection and try again.")
      } finally {
        setSaving(false)
      }
    },
    [ensureDraft, applyResponse, editingFromReview],
  )

  async function uploadLogo(file: File) {
    setUploadBusy(true)
    setUploadWarning(null)
    setFlowError(null)
    try {
      if (!(await ensureDraft())) throw new Error("draft create failed")
      const form = new FormData()
      form.set("file", file)
      const res = await fetch("/api/design/draft/logo", { method: "POST", body: form })
      const body = (await res.json()) as {
        upload?: ClientUpload
        warning?: string | null
        error?: string
      }
      if (!res.ok || !body.upload) {
        setUploadWarning(body.error ?? "Upload failed — try a different file.")
        return
      }
      setUploads((prev) => [...prev, body.upload!])
      if (body.warning) setUploadWarning(body.warning)
    } catch {
      setUploadWarning("Upload failed — check your connection and try again.")
    } finally {
      setUploadBusy(false)
    }
  }

  async function removeUpload(id: string) {
    setUploads((prev) => prev.filter((u) => u.id !== id))
    await fetch("/api/design/draft/logo", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadId: id }),
    }).catch(() => {})
  }

  async function startGeneration() {
    setGenerating(true)
    setFlowError(null)
    try {
      const res = await fetch("/api/design/generate", { method: "POST" })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setGenerating(false)
        setFlowError(body.error ?? "Generation couldn't start. Please try again.")
        return
      }
      // Hand off to the review experience, which owns live progress.
      window.location.assign("/design/review")
    } catch {
      setGenerating(false)
      setFlowError("Generation couldn't start — check your connection and try again.")
    }
  }

  function jumpTo(key: StepKey) {
    const idx = STEPS.findIndex((s) => s.key === key)
    if (idx >= 0) {
      setEditingFromReview(true)
      setCursor(idx)
    }
  }

  const answeredCount = useMemo(
    () => STEPS.filter((s) => s.key !== "review" && s.answered(draft, uploads)).length,
    [draft, uploads],
  )

  if (!loaded) {
    return (
      <div className="flex h-64 items-center justify-center text-[#8B98A8]">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }

  if (unavailable) {
    return (
      <div className="rounded-2xl border border-[#D7E0EA] bg-white p-6 text-sm text-[#5A6B7E] shadow-sm">
        {unavailable}
      </div>
    )
  }

  const transcript = STEPS.slice(0, cursor).filter((s) => s.answered(draft, uploads))

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-[#D7E0EA] bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-[#D7E0EA] px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-[#1FA6E5]" />
            <span className="text-sm font-semibold text-[#0B2037]">Design intake</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs tabular-nums text-[#5A6B7E]">
              {Math.min(answeredCount, ANSWERABLE_COUNT)}/{ANSWERABLE_COUNT}
            </span>
            <Progress
              value={(Math.min(answeredCount, ANSWERABLE_COUNT) / ANSWERABLE_COUNT) * 100}
              className="w-28"
            />
          </div>
        </div>

        <div
          ref={scrollerRef}
          className="flex max-h-[58vh] min-h-[320px] flex-col gap-3 overflow-y-auto bg-[#E4EBF3]/40 p-4"
        >
          {transcript.map((s) => (
            <div key={s.key} className="flex flex-col gap-3">
              <Bubble side="left" variant="studio" label="Tarp Studio">
                {s.question(draft, uploads)}
              </Bubble>
              <div className="group relative flex flex-col items-end">
                <Bubble side="right" variant="user" label="You">
                  {draft ? (s.summary(draft, uploads) ?? "—") : "—"}
                </Bubble>
                {step.key === "review" && (
                  <button
                    type="button"
                    onClick={() => jumpTo(s.key)}
                    className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-[#5A6B7E] transition hover:bg-white hover:text-[#1FA6E5]"
                  >
                    <PencilLine className="size-3" />
                    Change
                  </button>
                )}
              </div>
            </div>
          ))}

          {typing ? (
            <div className="text-xs text-[#8B98A8]">Tarp Studio is typing…</div>
          ) : (
            <Bubble side="left" variant="studio" label="Tarp Studio">
              {step.question(draft, uploads)}
            </Bubble>
          )}

          {flowError && !typing && (
            <p className="rounded-lg border border-[#D93A2B]/30 bg-[#D93A2B]/10 px-3 py-2 text-xs text-[#B22A1E]">
              {flowError}
            </p>
          )}
        </div>
      </div>

      {!typing && (
        <div className={saving ? "pointer-events-none opacity-60" : undefined}>
          {step.key === "fullName" && (
            <TextDock
              placeholder="Jordan Rivera"
              initialValue={draft?.fullName ?? ""}
              onSubmit={(v) => save({ fullName: v })}
            />
          )}
          {step.key === "businessName" && (
            <TextDock
              placeholder="Rivera Roofing Co."
              initialValue={draft?.businessName ?? ""}
              onSubmit={(v) => save({ businessName: v })}
            />
          )}
          {step.key === "email" && (
            <TextDock
              placeholder="you@company.com"
              inputType="email"
              initialValue={draft?.email ?? ""}
              validate={(v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "That doesn't look like an email address.")}
              onSubmit={(v) => save({ email: v })}
            />
          )}
          {step.key === "phone" && (
            <TextDock
              placeholder="(816) 555-0123"
              inputType="tel"
              initialValue={draft?.phone ?? ""}
              validate={(v) =>
                v.replace(/\D/g, "").length >= 10 ? null : "Please enter a full 10-digit number."
              }
              onSubmit={(v) => save({ phone: v })}
            />
          )}
          {step.key === "website" && (
            <TextDock
              placeholder="riveraroofing.com"
              initialValue={draft?.website ?? ""}
              onSubmit={(v) => save({ website: v })}
            />
          )}
          {step.key === "shippingAddress" && (
            <TextareaDock
              placeholder={"123 Main St\nKansas City, MO 64105"}
              initialValue={draft?.shippingAddress ?? ""}
              onSubmit={(v) => save({ shippingAddress: v })}
            />
          )}
          {step.key === "services" && (
            <ChipsDock
              options={SERVICES}
              multi
              initialSelected={draft?.services ?? []}
              onSubmit={(sel) => save({ services: sel })}
            />
          )}
          {step.key === "vendorBadges" && (
            <ChipsDock
              options={VENDOR_BADGES}
              multi
              initialSelected={draft?.vendorBadges ?? []}
              onSubmit={(sel) => save({ vendorBadges: sel })}
            />
          )}
          {step.key === "designStyle" && (
            <StyleDock initialKey={draft?.designStyle} onSubmit={(key) => save({ designStyle: key })} />
          )}
          {step.key === "qrAction" && (
            <ChipsDock
              options={QR_ACTIONS.map((a) => a.label)}
              multi={false}
              initialSelected={draft?.qrAction ? [qrActionLabel(draft.qrAction)] : []}
              onSubmit={(sel) => {
                const action = QR_ACTIONS.find((a) => a.label === sel[0])?.key
                // Changing the action invalidates a previously entered target.
                if (action) save({ qrAction: action, qrTargetUrl: null })
              }}
            />
          )}
          {step.key === "qrTarget" && (
            <TextDock
              placeholder={
                draft?.qrAction === "call" ? "(816) 555-0123" : "https://riveraroofing.com/quote"
              }
              inputType={draft?.qrAction === "call" ? "tel" : "url"}
              initialValue={
                draft?.qrTargetUrl ??
                (draft?.qrAction === "call" ? (draft?.phone ?? "") : (draft?.website ?? ""))
              }
              validate={(v) =>
                draft?.qrAction === "call"
                  ? v.replace(/\D/g, "").length >= 10
                    ? null
                    : "Please enter a full 10-digit number."
                  : null
              }
              onSubmit={(v) => {
                if (draft?.qrAction === "call") {
                  const digits = v.replace(/[^\d+]/g, "")
                  const tel = digits.startsWith("+") ? digits : `+1${digits.replace(/\D/g, "")}`
                  save({ qrTargetUrl: `tel:${tel}` })
                } else {
                  save({ qrTargetUrl: /^https?:\/\//i.test(v) ? v : `https://${v}` })
                }
              }}
            />
          )}
          {step.key === "logo" && (
            <UploadDock
              uploads={uploads}
              uploading={uploadBusy}
              warning={uploadWarning}
              onPick={uploadLogo}
              onRemove={removeUpload}
              onContinue={() => {
                setUploadWarning(null)
                if (editingFromReview) {
                  setEditingFromReview(false)
                  setCursor(STEPS.length - 1)
                } else {
                  setCursor((c) => c + 1)
                }
              }}
            />
          )}
          {step.key === "specialInstructions" && (
            <TextareaDock
              placeholder="Anything the designer should know…"
              initialValue={draft?.specialInstructions ?? ""}
              skippable
              onSubmit={(v) => save({ specialInstructions: v })}
            />
          )}
          {step.key === "howFound" && (
            <ChipsDock
              options={HOW_FOUND}
              multi={false}
              otherKey="Other"
              initialSelected={draft?.howFound ? [draft.howFound] : []}
              onSubmit={(sel, other) => save({ howFound: sel[0], howFoundOther: other ?? null })}
            />
          )}
          {step.key === "consents" && (
            <ConsentDock
              initialTransactional={draft?.consentTransactionalSms ?? false}
              initialMarketing={draft?.consentMarketingSms ?? false}
              onSubmit={(transactional, marketing) =>
                save({ consentTransactionalSms: transactional, consentMarketingSms: marketing })
              }
            />
          )}
          {step.key === "review" && (
            <div className="flex flex-col gap-2.5 rounded-2xl border border-[#D7E0EA] bg-white p-4 shadow-sm">
              {signedIn ? (
                <>
                  <p className="text-sm leading-6 text-[#5A6B7E]">
                    {"Ready when you are. We'll generate design concepts in your chosen style — it usually takes a minute or two, and you'll review everything before anything goes to print."}
                  </p>
                  <button
                    type="button"
                    onClick={startGeneration}
                    disabled={generating}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0B2037] px-4 text-sm font-semibold text-white transition hover:bg-[#0B2037]/90 disabled:opacity-60"
                  >
                    {generating ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    Generate my designs
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm leading-6 text-[#5A6B7E]">
                    Your answers are saved. Create a free account to generate your designs —
                    it keeps every concept attached to your order so you can track printing
                    and revisit designs any time.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Link
                      href="/sign-up?next=/design"
                      className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-[#0B2037] px-4 text-sm font-semibold text-white transition hover:bg-[#0B2037]/90"
                    >
                      Create account
                    </Link>
                    <Link
                      href="/sign-in?next=/design"
                      className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-[#D7E0EA] bg-white px-4 text-sm font-medium text-[#0B2037] transition hover:bg-[#E4EBF3]"
                    >
                      Sign in
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
