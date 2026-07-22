// Shared vocabulary for the Smart Tarp design funnel. The option lists mirror
// the "Your Smart Tarp Design Form" Google Form verbatim — the chat wizard,
// validation, ingestion, and admin views all read from here so the two intake
// tracks stay in sync.

export type DesignRequestSource = "chat" | "google_form"

export type DesignRequestStatus =
  | "draft" // wizard in progress
  | "generating" // initial variants being generated
  | "reviewing" // variants ready, customer reviewing / requesting revisions
  | "selected" // a design was chosen, order not yet created
  | "submitted" // order created, team notified
  | "imported" // ingested Google Form response (no in-app design session yet)

export type DesignStatus = "pending" | "generating" | "succeeded" | "failed"

export type OrderStatus =
  | "pending_review"
  | "approved"
  | "printing"
  | "shipped"
  | "completed"
  | "canceled"

export type OrderEvent = {
  at: string // ISO timestamp
  status: OrderStatus
  note?: string | null
}

export const ORDER_STATUSES: OrderStatus[] = [
  "pending_review",
  "approved",
  "printing",
  "shipped",
  "completed",
  "canceled",
]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_review: "Pending review",
  approved: "Approved",
  printing: "Printing",
  shipped: "Shipped",
  completed: "Completed",
  canceled: "Canceled",
}

// "What would you like your QR code to do when scanned?"
export const QR_ACTIONS = [
  { key: "website", label: "Go to my website" },
  { key: "call", label: "Call a telephone number" },
  { key: "quote", label: "Link to a quick-quote tool or landing page" },
] as const

export type QrAction = (typeof QR_ACTIONS)[number]["key"]

// "What Services do you want listed?"
export const SERVICES = ["Roofing", "Windows", "Siding", "Rejuvenation", "Gutters"] as const

// "What Vendor Badges would you like included?"
export const VENDOR_BADGES = [
  "Google",
  "BBB",
  "Owens Corning",
  "SRS",
  "GAF",
  "Facebook",
  "Instagram",
] as const

// "How did you find us?"
export const HOW_FOUND = [
  "Facebook",
  "Instagram",
  "Forum",
  "Email",
  "Podcast",
  "YouTube",
  "Limitless GPO",
  "Other",
] as const

// "REQUIRED: Choose Your Design Style Preference" — the four styles, with the
// form's own positioning copy (shown in the wizard) and the design mandate
// (drives the image-generation prompt).
export const DESIGN_STYLES = [
  {
    key: "authority",
    name: "The Authority",
    tagline: "The Billboard",
    mandate: "Brand dominance: a massive, centered logo legible from three houses away.",
    pitch:
      "Choose this style if you want to be the most recognized name in the zip code. We prioritize a massive, centered logo placement that is legible from three houses away.",
    bestFor: "Square or stacked (vertical) logos",
  },
  {
    key: "lead_machine",
    name: "The Lead Machine",
    tagline: "Direct Response",
    mandate:
      "Maximize inbound calls: a bold CALL OR TEXT banner and an oversized phone number, logo slightly smaller.",
    pitch:
      "Choose this style if your primary goal is to capture the 5-10 leads currently being left behind at every job site. A bold CALL OR TEXT banner and an oversized phone number turn your property protection into a sales asset.",
    bestFor: "Horizontal (wide) logos",
  },
  {
    key: "modern_star",
    name: "The Modern Star",
    tagline: "The Tech Hub",
    mandate:
      "Technology-forward: a high-visibility, street-scannable QR code linking to an instant quote tool or landing page.",
    pitch:
      "Choose this style to let technology do the selling for you. A high-visibility, street-scannable QR code links directly to your instant quote tool or landing page.",
    bestFor: "Any logo shape; requires a working QR link",
  },
  {
    key: "neighborhood_hero",
    name: "The Neighborhood Hero",
    tagline: "Trust & Access",
    mandate:
      "Community trust: balanced branding with a trust stack of vendor badges and 100% financing callouts.",
    pitch:
      "Choose this style to lower the barrier to entry for new customers. Your branding is balanced with a trust stack (BBB, awards, trade badges) and 100% financing callouts.",
    bestFor: "Square or stacked logos; needs trust badges or financing info",
  },
] as const

export type DesignStyleKey = (typeof DESIGN_STYLES)[number]["key"]

export function designStyle(key: string | null | undefined) {
  return DESIGN_STYLES.find((s) => s.key === key) ?? null
}

// Logo upload constraints (mirrors the form's guidance; enforced in code).
export const LOGO_ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/vnd.adobe.photoshop",
  "application/postscript", // .eps
] as const
export const LOGO_MAX_BYTES = 10 * 1024 * 1024 // 10 MB, per the form
// Below this the form's "high resolution" ask clearly isn't met; we warn, not block.
export const LOGO_MIN_WIDTH_PX = 1000

// Revision policy: after this many revisions the chat hands off to support.
export const MAX_REVISIONS = 3
export const SUPPORT_EMAIL = process.env.DESIGN_SUPPORT_EMAIL ?? "kellie@brandalltarps.com"
