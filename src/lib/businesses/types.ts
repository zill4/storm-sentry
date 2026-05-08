export type Business = {
  id: string
  name: string
  city: string
  state: string
  lat: number
  lng: number
  phone: string
  email: string
  timezone: string
}

export type BusinessStatus = "idle" | "watching" | "alerted"

export type StormMatch = {
  id: string
  businessId: string
  stormId: string
  distanceMeters: number
  createdAt: string
}

export type BusinessWithStatus = Business & {
  status: BusinessStatus
  activeMatchCount: number
  nearestStorm: {
    stormId: string
    eventType: string
    severity: string
    distanceMeters: number
  } | null
  lastAlertedAt: string | null
}
