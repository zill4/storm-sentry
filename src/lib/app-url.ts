// Public origin for links embedded in outbound payloads (webhooks, GHL custom
// fields, emails). Set APP_BASE_URL in production; falls back to the auth
// origin so local dev links work without extra config.
export function appBaseUrl(): string {
  const raw =
    process.env.APP_BASE_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:8080"
  return raw.replace(/\/+$/, "")
}

/**
 * Public, no-auth storm report for a ZIP — the link the GHL/Zapier automations
 * send out.
 *
 * These now point at the umbrella site, which is where the storm section lives
 * (smarttarpsolutions.com/storms/zip/{zip}). Links already sent still work:
 * this app's middleware forwards /zip/{zip} there, query string intact, so the
 * ?sv= referral token survives. New messages skip that hop.
 */
export function solutionsBaseUrl(): string {
  return (process.env.SOLUTIONS_BASE_URL ?? "https://smarttarpsolutions.com").replace(/\/+$/, "")
}

export function zipReportUrl(zip: string): string {
  return `${solutionsBaseUrl()}/storms/zip/${zip}`
}
