"use client"

import { useEffect, useRef, useState } from "react"
import { Check, FileText, Loader2, Paperclip, Send, Trash2 } from "lucide-react"

import type { ClientUpload } from "./wizard-types"

// Input widgets for the wizard dock. Each renders the control for one step
// kind and calls back with a normalized value. Styling follows DESIGN.md:
// white surfaces, #D7E0EA hairlines, navy primary, radar-blue focus/selection.

const INPUT =
  "flex-1 bg-transparent px-3 py-2 text-sm text-[#0B2037] outline-none placeholder:text-[#8B98A8]"
const CHIP_BASE =
  "rounded-full border px-3.5 py-1.5 text-sm transition select-none cursor-pointer"
const CHIP_OFF = "border-[#D7E0EA] bg-white text-[#0B2037] hover:bg-[#E4EBF3]"
const CHIP_ON = "border-[#0B2037] bg-[#0B2037] text-white"
const PRIMARY_BTN =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-[#0B2037] px-4 text-sm font-semibold text-white transition hover:bg-[#0B2037]/90 disabled:opacity-50 disabled:pointer-events-none"

export function TextDock({
  placeholder,
  inputType = "text",
  initialValue = "",
  validate,
  onSubmit,
}: {
  placeholder: string
  inputType?: "text" | "email" | "tel" | "url"
  initialValue?: string
  validate?: (value: string) => string | null
  onSubmit: (value: string) => void
}) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    const problem = validate?.(trimmed) ?? null
    if (problem) {
      setError(problem)
      return
    }
    onSubmit(trimmed)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 rounded-2xl border border-[#D7E0EA] bg-white p-1.5 shadow-sm">
        <input
          ref={ref}
          type={inputType}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          placeholder={placeholder}
          className={INPUT}
        />
        <button type="submit" className={PRIMARY_BTN} disabled={!value.trim()}>
          <Send className="size-3.5" />
          Send
        </button>
      </div>
      {error && <p className="px-2 text-xs text-[#B22A1E]">{error}</p>}
    </form>
  )
}

export function TextareaDock({
  placeholder,
  initialValue = "",
  skippable,
  onSubmit,
}: {
  placeholder: string
  initialValue?: string
  skippable?: boolean
  onSubmit: (value: string) => void
}) {
  const [value, setValue] = useState(initialValue)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => ref.current?.focus(), [])

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-[#D7E0EA] bg-white p-2 shadow-sm">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="resize-none bg-transparent px-2 py-1.5 text-sm text-[#0B2037] outline-none placeholder:text-[#8B98A8]"
      />
      <div className="flex items-center justify-end gap-2">
        {skippable && (
          <button
            type="button"
            onClick={() => onSubmit("")}
            className="rounded-full px-3 py-1.5 text-sm text-[#5A6B7E] transition hover:bg-[#E4EBF3] hover:text-[#0B2037]"
          >
            Skip
          </button>
        )}
        <button
          type="button"
          className={PRIMARY_BTN}
          disabled={!value.trim() && !skippable}
          onClick={() => onSubmit(value.trim())}
        >
          <Send className="size-3.5" />
          {value.trim() ? "Send" : "Continue"}
        </button>
      </div>
    </div>
  )
}

export function ChipsDock({
  options,
  multi,
  initialSelected = [],
  otherKey,
  onSubmit,
}: {
  options: readonly string[]
  multi: boolean
  initialSelected?: string[]
  /** When set, choosing this option reveals a free-text field (e.g. "Other"). */
  otherKey?: string
  onSubmit: (selected: string[], otherText?: string) => void
}) {
  const [selected, setSelected] = useState<string[]>(initialSelected)
  const [otherText, setOtherText] = useState("")
  const needsOther = Boolean(otherKey && selected.includes(otherKey))

  function toggle(opt: string) {
    if (multi) {
      setSelected((prev) =>
        prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt],
      )
    } else {
      setSelected([opt])
      // Single choice without a follow-up field advances immediately.
      if (!(otherKey && opt === otherKey)) onSubmit([opt])
    }
  }

  const canContinue = selected.length > 0 && (!needsOther || otherText.trim().length > 0)

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-[#D7E0EA] bg-white p-3 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const on = selected.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`${CHIP_BASE} ${on ? CHIP_ON : CHIP_OFF}`}
            >
              {on && <Check className="mr-1 inline size-3.5" />}
              {opt}
            </button>
          )
        })}
      </div>
      {needsOther && (
        <input
          autoFocus
          value={otherText}
          onChange={(e) => setOtherText(e.target.value)}
          placeholder="Tell us where…"
          className="rounded-lg border border-[#D7E0EA] bg-white px-3 py-2 text-sm text-[#0B2037] outline-none placeholder:text-[#8B98A8] focus:border-[#1FA6E5]"
        />
      )}
      {(multi || needsOther) && (
        <div className="flex justify-end">
          <button
            type="button"
            className={PRIMARY_BTN}
            disabled={!canContinue}
            onClick={() => onSubmit(selected, otherText.trim() || undefined)}
          >
            Continue
          </button>
        </div>
      )}
    </div>
  )
}

export function OrientationDock({
  initialKey,
  onSubmit,
}: {
  initialKey?: string | null
  onSubmit: (key: string) => void
}) {
  const OPTIONS = [
    {
      key: "vertical",
      label: "Vertical",
      badge: "Best for 1-story buildings",
      guidance:
        "Graphics ride high with the long coverage zone below — debris never sits on your branding.",
      image: "/tarp-examples/vertical-16x20.png",
    },
    {
      key: "horizontal",
      label: "Horizontal",
      badge: "Best for 2-3 story buildings",
      guidance: "The wide billboard read — maximum street presence hung high on taller buildings.",
      image: "/tarp-examples/horizontal-20x16.png",
    },
  ]
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {OPTIONS.map((o) => {
        const on = initialKey === o.key
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onSubmit(o.key)}
            className={`flex flex-col rounded-2xl border bg-white text-left shadow-sm transition ${
              on
                ? "border-[#1FA6E5] ring-2 ring-[#1FA6E5]/30"
                : "border-[#D7E0EA] hover:border-[#8B98A8]"
            }`}
          >
            <span className="flex h-64 w-full items-center justify-center overflow-hidden rounded-t-2xl bg-[#E4EBF3]/60 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={o.image}
                alt={`${o.label} tarp example`}
                className="max-h-full max-w-full rounded object-contain"
                loading="lazy"
              />
            </span>
            <span className="flex flex-col gap-1 p-4">
              <span className="text-[11px] uppercase tracking-[0.14em] text-[#1FA6E5]">
                {o.badge}
              </span>
              <span className="font-display text-base font-bold text-[#0B2037]">{o.label}</span>
              <span className="text-xs leading-5 text-[#5A6B7E]">{o.guidance}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function UploadDock({
  uploads,
  uploading,
  warning,
  onPick,
  onRemove,
  onContinue,
}: {
  uploads: ClientUpload[]
  uploading: boolean
  warning: string | null
  onPick: (file: File) => void
  onRemove: (id: string) => void
  onContinue: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-[#D7E0EA] bg-white p-3 shadow-sm">
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.psd,.eps,application/pdf,image/jpeg,image/png,image/tiff"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onPick(f)
          e.target.value = ""
        }}
      />
      {uploads.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {uploads.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-2 rounded-lg border border-[#D7E0EA] bg-[#E4EBF3]/50 px-3 py-2"
            >
              {u.contentType.startsWith("image/") && u.contentType !== "image/tiff" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/design/uploads/${u.id}`}
                  alt={u.fileName}
                  className="size-9 rounded bg-white object-contain"
                />
              ) : (
                <FileText className="size-5 text-[#5A6B7E]" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-[#0B2037]">{u.fileName}</p>
                <p className="font-mono text-[11px] tabular-nums text-[#8B98A8]">
                  {(u.sizeBytes / 1024 / 1024).toFixed(1)} MB
                  {u.width && u.height ? ` · ${u.width}×${u.height}px` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(u.id)}
                className="rounded-full p-1.5 text-[#8B98A8] transition hover:bg-white hover:text-[#B22A1E]"
                aria-label={`Remove ${u.fileName}`}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {warning && (
        <p className="rounded-lg border border-[#F47A20]/40 bg-[#F47A20]/10 px-3 py-2 text-xs text-[#0B2037]">
          {warning}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#D7E0EA] bg-white px-4 text-sm font-medium text-[#0B2037] transition hover:bg-[#E4EBF3] disabled:opacity-50"
        >
          {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />}
          {uploads.length ? "Add another file" : "Choose a file"}
        </button>
        <button
          type="button"
          className={PRIMARY_BTN}
          disabled={uploads.length === 0 || uploading}
          onClick={onContinue}
        >
          Continue
        </button>
      </div>
      <p className="px-1 text-[11px] leading-4 text-[#8B98A8]">
        PDF preferred (vector). JPEG, PNG, EPS, TIFF, or PSD also accepted — up to 5 files, 10 MB
        each. High resolution helps: 5000px wide or 150 DPI+.
      </p>
    </div>
  )
}

function ConsentRow({
  checked,
  onChange,
  required,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition ${
        checked ? "border-[#1FA6E5] bg-[#1FA6E5]/5" : "border-[#D7E0EA] bg-white"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 accent-[#0B2037]"
      />
      <span className="text-xs leading-5 text-[#5A6B7E]">
        {required && (
          <span className="mr-1.5 rounded bg-[#0B2037] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
            Required
          </span>
        )}
        {children}
      </span>
    </label>
  )
}

export function ConsentDock({
  initialTransactional,
  initialMarketing,
  onSubmit,
}: {
  initialTransactional: boolean
  initialMarketing: boolean
  onSubmit: (transactional: boolean, marketing: boolean) => void
}) {
  const [transactional, setTransactional] = useState(initialTransactional)
  const [marketing, setMarketing] = useState(initialMarketing)

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-[#D7E0EA] bg-white p-3 shadow-sm">
      <ConsentRow checked={transactional} onChange={setTransactional} required>
        I consent to receive non-marketing text messages from The Smart Tarp Co. about my Smart
        Tarp order. Message frequency varies, message &amp; data rates may apply. Text HELP for
        assistance, reply STOP to opt out.
      </ConsentRow>
      <ConsentRow checked={marketing} onChange={setMarketing}>
        Optional: I consent to receive marketing and promotional messages, including special
        offers, discounts, and product updates from The Smart Tarp Co. at the phone number
        provided. Frequency may vary. Message &amp; data rates may apply. Text HELP for
        assistance, reply STOP to opt out.
      </ConsentRow>
      <div className="flex justify-end">
        <button
          type="button"
          className={PRIMARY_BTN}
          disabled={!transactional}
          onClick={() => onSubmit(transactional, marketing)}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
