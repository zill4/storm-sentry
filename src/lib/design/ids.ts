import { randomBytes } from "node:crypto"

/** Prefixed opaque id, e.g. dr_kJ8v2nQxTz4w1pYc (URL-safe). */
export function newId(prefix: "dr" | "du" | "dg" | "or"): string {
  return `${prefix}_${randomBytes(10).toString("base64url")}`
}

// QR slugs are printed on physical tarps, so keep them short and free of
// ambiguous glyphs (no 0/O/1/l/i) in case anyone ever has to type one.
const SLUG_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"
export const QR_SLUG_LENGTH = 7

export function newQrSlug(): string {
  const bytes = randomBytes(QR_SLUG_LENGTH)
  let slug = ""
  for (let i = 0; i < QR_SLUG_LENGTH; i++) {
    slug += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length]
  }
  return slug
}
