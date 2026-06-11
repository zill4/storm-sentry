import { z } from "zod"

// Schemas + constants for the Tomorrow.io v4 API. Shapes confirmed against the
// live API (free "Core" plan) on 2026-06-02. zod strips unknown keys by
// default, so these intentionally list only the fields we consume.

// ---- Realtime Weather (GET /v4/weather/realtime) ----
// Note: v4 has no single `precipitationIntensity`; it is split into rain/
// sleet/snow/freezingRain intensities. There is no hail field in realtime.
export const RealtimeResponseSchema = z.object({
  data: z.object({
    time: z.string().optional(),
    values: z.object({
      temperature: z.number().nullable().optional(),
      temperatureApparent: z.number().nullable().optional(),
      windSpeed: z.number().nullable().optional(),
      windGust: z.number().nullable().optional(),
      precipitationProbability: z.number().nullable().optional(),
      rainIntensity: z.number().nullable().optional(),
      sleetIntensity: z.number().nullable().optional(),
      snowIntensity: z.number().nullable().optional(),
      freezingRainIntensity: z.number().nullable().optional(),
      weatherCode: z.number().nullable().optional(),
    }),
  }),
  location: z
    .object({
      lat: z.number().optional(),
      lon: z.number().optional(),
      name: z.string().optional(),
    })
    .optional(),
})
export type RealtimeResponse = z.infer<typeof RealtimeResponseSchema>

// ---- Severe Weather Events (POST /v4/events) ----
// On the US, `eventValues.origin` is "NWS" — Tomorrow re-serves NWS alerts.
const EventGeometrySchema = z.object({
  type: z.string(),
  coordinates: z.unknown(),
})
export const TomorrowEventSchema = z.object({
  insight: z.string(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  updateTime: z.string().nullable().optional(),
  severity: z.string().nullable().optional(),
  certainty: z.string().nullable().optional(),
  urgency: z.string().nullable().optional(),
  eventValues: z.object({
    origin: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    headline: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    response: z
      .array(z.object({ instruction: z.string().nullable().optional() }))
      .nullable()
      .optional(),
    link: z.string().nullable().optional(),
    location: EventGeometrySchema.nullable().optional(),
    distance: z.number().nullable().optional(),
  }),
})
export const EventsResponseSchema = z.object({
  data: z
    .object({ events: z.array(TomorrowEventSchema).nullable().optional() })
    .nullable()
    .optional(),
})
export type TomorrowEvent = z.infer<typeof TomorrowEventSchema>

// Severe-weather insight categories accepted by the /v4/events `insights` param
// (validated against the live API). Roofing-relevant subset.
export const INSIGHT_CATEGORIES = [
  "tornado",
  "thunderstorms",
  "wind",
  "floods",
  "tropical",
  "winter",
] as const

// Tomorrow event severities are lowercase; the rest of the app uses the NWS
// capitalized form (see storms/severity.ts + SEVERITY_RANK).
const SEVERITY_TITLECASE: Record<string, string> = {
  extreme: "Extreme",
  severe: "Severe",
  moderate: "Moderate",
  minor: "Minor",
  unknown: "Unknown",
}
export function titleCaseSeverity(s: string | null | undefined): string {
  if (!s) return "Unknown"
  return SEVERITY_TITLECASE[s.toLowerCase()] ?? "Unknown"
}

// Quantitative nowcast we derive per ZIP from Realtime — the data NWS alerts
// don't carry. Imperial units (in/hr, mph, °F).
export type NowcastValues = {
  precipIntensity: number | null
  precipProbability: number | null
  windGust: number | null
  windSpeed: number | null
  temperature: number | null
  weatherCode: number | null
  weatherLabel: string | null
  fetchedAt: string
}

// Tomorrow.io v4 weatherCode → label.
export const WEATHER_CODES: Record<number, string> = {
  0: "Unknown",
  1000: "Clear",
  1100: "Mostly Clear",
  1101: "Partly Cloudy",
  1102: "Mostly Cloudy",
  1001: "Cloudy",
  2000: "Fog",
  2100: "Light Fog",
  4000: "Drizzle",
  4001: "Rain",
  4200: "Light Rain",
  4201: "Heavy Rain",
  5000: "Snow",
  5001: "Flurries",
  5100: "Light Snow",
  5101: "Heavy Snow",
  6000: "Freezing Drizzle",
  6001: "Freezing Rain",
  6200: "Light Freezing Rain",
  6201: "Heavy Freezing Rain",
  7000: "Ice Pellets",
  7101: "Heavy Ice Pellets",
  7102: "Light Ice Pellets",
  8000: "Thunderstorm",
}
export function weatherLabel(code: number | null | undefined): string | null {
  if (code == null) return null
  return WEATHER_CODES[code] ?? null
}

// ---- Weather Forecast (GET /v4/weather/forecast) ----
// timelines: { minutely (premium only), hourly (120h), daily (5d) }, each
// { time, values }. Daily field names aren't documented, so the schema lists
// every plausible variant (all optional) and normalizeForecast picks the best.
const ForecastValuesSchema = z.object({
  temperature: z.number().nullable().optional(),
  temperatureApparent: z.number().nullable().optional(),
  temperatureMin: z.number().nullable().optional(),
  temperatureMax: z.number().nullable().optional(),
  windGust: z.number().nullable().optional(),
  windGustMax: z.number().nullable().optional(),
  windGustAvg: z.number().nullable().optional(),
  windSpeed: z.number().nullable().optional(),
  precipitationProbability: z.number().nullable().optional(),
  precipitationProbabilityAvg: z.number().nullable().optional(),
  precipitationProbabilityMax: z.number().nullable().optional(),
  rainIntensity: z.number().nullable().optional(),
  rainIntensityAvg: z.number().nullable().optional(),
  rainIntensityMax: z.number().nullable().optional(),
  sleetIntensity: z.number().nullable().optional(),
  snowIntensity: z.number().nullable().optional(),
  freezingRainIntensity: z.number().nullable().optional(),
  weatherCode: z.number().nullable().optional(),
  weatherCodeMax: z.number().nullable().optional(),
  weatherCodeMin: z.number().nullable().optional(),
})
const ForecastEntrySchema = z.object({
  time: z.string(),
  values: ForecastValuesSchema,
})
export const ForecastResponseSchema = z.object({
  timelines: z.object({
    minutely: z.array(ForecastEntrySchema).nullable().optional(),
    hourly: z.array(ForecastEntrySchema).nullable().optional(),
    daily: z.array(ForecastEntrySchema).nullable().optional(),
  }),
  location: z
    .object({
      lat: z.number().optional(),
      lon: z.number().optional(),
      name: z.string().optional(),
    })
    .nullable()
    .optional(),
})
export type ForecastResponse = z.infer<typeof ForecastResponseSchema>

export type ForecastHour = {
  time: string
  temperature: number | null
  precipProbability: number | null
  precipIntensity: number | null
  windGust: number | null
  weatherCode: number | null
  weatherLabel: string | null
}
export type ForecastDay = {
  date: string
  tempMin: number | null
  tempMax: number | null
  precipProbability: number | null
  windGust: number | null
  weatherCode: number | null
  weatherLabel: string | null
}
export type NormalizedForecast = {
  zip: string
  location: { name: string | null; lat: number | null; lon: number | null }
  hourly: ForecastHour[]
  daily: ForecastDay[]
  fetchedAt: string
}
