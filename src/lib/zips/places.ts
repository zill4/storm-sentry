import { ZIP_PLACES_PACKED } from "./data/zip-places"

// US ZIP → city/state labels, parsed once from the bundled dataset (generated
// by scripts/build-zip-places.mjs). Server-only — imported by pages/APIs, never
// by client components, so the ~770KB source never reaches the browser bundle.

export type ZipPlace = { city: string; state: string }

type PlacesShape = Map<string, ZipPlace>

declare global {
  // eslint-disable-next-line no-var
  var __stormSentryZipPlaces: PlacesShape | undefined
}

function getStore(): PlacesShape {
  if (!globalThis.__stormSentryZipPlaces) {
    const byZip: PlacesShape = new Map()
    for (const row of ZIP_PLACES_PACKED.split(";")) {
      if (!row) continue
      const comma1 = row.indexOf(",")
      const comma2 = row.lastIndexOf(",")
      if (comma1 < 0 || comma2 <= comma1) continue
      byZip.set(row.slice(0, comma1), {
        city: row.slice(comma1 + 1, comma2),
        state: row.slice(comma2 + 1),
      })
    }
    globalThis.__stormSentryZipPlaces = byZip
  }
  return globalThis.__stormSentryZipPlaces
}

export function getPlace(zip: string): ZipPlace | null {
  return getStore().get(zip) ?? null
}

/** "San Antonio, TX" — or null for ZIPs the dataset doesn't cover. */
export function placeLabel(zip: string): string | null {
  const p = getPlace(zip)
  return p ? `${p.city}, ${p.state}` : null
}
