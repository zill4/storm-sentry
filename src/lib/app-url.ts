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

/** Public, no-auth storm report for a ZIP — the link automations send out. */
export function zipReportUrl(zip: string): string {
  return `${appBaseUrl()}/zip/${zip}`
}
