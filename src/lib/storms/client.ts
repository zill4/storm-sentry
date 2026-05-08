import { NwsAlertsResponseSchema } from "./types"

const NWS_ACTIVE_ALERTS_URL = "https://api.weather.gov/alerts/active"

export class NwsClientError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = "NwsClientError"
    this.status = status
  }
}

export async function fetchActiveAlerts(): Promise<ReturnType<typeof NwsAlertsResponseSchema.parse>> {
  const userAgent = process.env.NWS_USER_AGENT
  if (!userAgent) {
    throw new NwsClientError("NWS_USER_AGENT env var is required")
  }

  const res = await fetch(NWS_ACTIVE_ALERTS_URL, {
    headers: {
      "User-Agent": userAgent,
      Accept: "application/geo+json",
    },
    cache: "no-store",
  })

  if (!res.ok) {
    throw new NwsClientError(`NWS responded ${res.status}`, res.status)
  }

  const json = (await res.json()) as unknown
  return NwsAlertsResponseSchema.parse(json)
}
