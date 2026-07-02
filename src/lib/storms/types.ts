import { z } from "zod"

export const SEVERITY_RANK: Record<string, number> = {
  Extreme: 4,
  Severe: 3,
  Moderate: 2,
  Minor: 1,
  Unknown: 0,
}

export const ACCEPTED_EVENT_TYPES = [
  "Tornado Warning",
  "Tornado Watch",
  "Severe Thunderstorm Warning",
  "Severe Thunderstorm Watch",
  "High Wind Warning",
  "High Wind Watch",
  "Wind Advisory",
  "Flash Flood Warning",
  "Flood Warning",
  "Hurricane Warning",
  "Hurricane Watch",
  "Tropical Storm Warning",
  "Tropical Storm Watch",
] as const

const NwsGeometrySchema = z.union([
  z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
  }),
  z.object({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(z.array(z.array(z.tuple([z.number(), z.number()])))),
  }),
])

const NwsPropertiesSchema = z.object({
  id: z.string(),
  areaDesc: z.string().nullable().optional(),
  sent: z.string().nullable().optional(),
  effective: z.string().nullable().optional(),
  onset: z.string().nullable().optional(),
  expires: z.string().nullable().optional(),
  ends: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  messageType: z.string().nullable().optional(),
  severity: z.string().nullable().optional(),
  certainty: z.string().nullable().optional(),
  urgency: z.string().nullable().optional(),
  event: z.string(),
  senderName: z.string().nullable().optional(),
  headline: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  instruction: z.string().nullable().optional(),
  // Radar-derived storm motion (TIME...MOT...LOC), present on warned storms —
  // the source for minutes-to-arrival. zod strips keys we don't list.
  parameters: z
    .object({
      eventMotionDescription: z.array(z.string()).nullable().optional(),
    })
    .nullable()
    .optional(),
})

export const NwsFeatureSchema = z.object({
  id: z.string(),
  type: z.literal("Feature"),
  geometry: NwsGeometrySchema.nullable(),
  properties: NwsPropertiesSchema,
})

export const NwsAlertsResponseSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(NwsFeatureSchema),
})

export type NwsFeature = z.infer<typeof NwsFeatureSchema>

export type StormGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] }

/** Radar-derived cell motion from an NWS warning (eventMotionDescription). */
export type StormMotion = {
  /** When the cell positions were observed (ISO). */
  refTime: string
  /** Direction of TRAVEL in degrees true (already converted from the NWS
   *  meteorological "moving from" convention). */
  headingDeg: number
  speedKt: number
  /** One point per radar-identified cell (squall lines carry several). */
  points: Array<{ lat: number; lng: number }>
}

export type StormEvent = {
  id: string
  source: "nws" | "fixture" | "tomorrow"
  sourceEventId: string
  eventType: string
  severity: string
  certainty: string | null
  urgency: string | null
  headline: string | null
  description: string | null
  instruction: string | null
  areaDesc: string | null
  senderName: string | null
  startedAt: string | null
  expiresAt: string | null
  endedAt: string | null
  nwsUrl: string | null
  geometry: StormGeometry | null
  motion: StormMotion | null
  fetchedAt: string
}

export function severityRank(s: string | null | undefined): number {
  if (!s) return 0
  return SEVERITY_RANK[s] ?? 0
}

export function isHailRelated(event: string, description: string | null | undefined): boolean {
  const haystack = `${event} ${description ?? ""}`.toLowerCase()
  return haystack.includes("hail")
}

export function isAcceptedEventType(event: string, description: string | null | undefined): boolean {
  if ((ACCEPTED_EVENT_TYPES as readonly string[]).includes(event)) return true
  return isHailRelated(event, description)
}
