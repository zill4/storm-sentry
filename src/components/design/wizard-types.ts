// Client-side shapes for the design wizard (serialized rows from
// /api/design/draft — timestamps arrive as strings and are unused here).

export type ClientUpload = {
  id: string
  kind: string
  fileName: string
  contentType: string
  sizeBytes: number
  width: number | null
  height: number | null
}

export type ClientDraft = {
  id: string
  status: string
  email: string | null
  fullName: string | null
  businessName: string | null
  shippingAddress: string | null
  phone: string | null
  website: string | null
  qrAction: string | null
  qrTargetUrl: string | null
  services: string[] | null
  vendorBadges: string[] | null
  howFound: string | null
  howFoundOther: string | null
  designStyle: string | null
  orientation: string | null
  specialInstructions: string | null
  consentTransactionalSms: boolean
  consentMarketingSms: boolean
  revisionCount: number
}

export type DraftResponse = {
  draft: ClientDraft | null
  uploads?: ClientUpload[]
  completeness?: { ready: boolean; missing: string[] }
  error?: string
}

export function firstName(draft: ClientDraft | null): string | null {
  const name = draft?.fullName?.trim()
  if (!name) return null
  return name.split(/\s+/)[0]
}
