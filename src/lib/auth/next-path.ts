/**
 * Only same-site absolute paths survive as post-auth redirect targets —
 * anything with a scheme, host, or protocol-relative prefix is dropped so
 * ?next= can't become an open redirect.
 */
export function safeNextPath(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return undefined
  return raw
}
