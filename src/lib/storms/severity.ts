export const SEVERITY_HEX: Record<string, string> = {
  Extreme: "#dc2626",
  Severe: "#f97316",
  Moderate: "#eab308",
  Minor: "#22c55e",
  Unknown: "#94a3b8",
}

export const SEVERITY_BADGE_CLASS: Record<string, string> = {
  Extreme: "bg-red-100 text-red-900 ring-red-200",
  Severe: "bg-orange-100 text-orange-900 ring-orange-200",
  Moderate: "bg-yellow-100 text-yellow-900 ring-yellow-200",
  Minor: "bg-green-100 text-green-900 ring-green-200",
  Unknown: "bg-slate-100 text-slate-900 ring-slate-200",
}

export function severityHex(severity: string | null | undefined): string {
  if (!severity) return SEVERITY_HEX.Unknown
  return SEVERITY_HEX[severity] ?? SEVERITY_HEX.Unknown
}

export function severityBadgeClass(severity: string | null | undefined): string {
  if (!severity) return SEVERITY_BADGE_CLASS.Unknown
  return SEVERITY_BADGE_CLASS[severity] ?? SEVERITY_BADGE_CLASS.Unknown
}
