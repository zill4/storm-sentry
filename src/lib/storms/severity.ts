// Severity palette, tuned to the Storm Sentry brand (navy / radar-blue /
// alert-orange). Saturated severity colors are the only loud color on maps and
// badges; everything else stays in the cool brand neutrals.
export const SEVERITY_HEX: Record<string, string> = {
  Extreme: "#D93A2B",
  Severe: "#F47A20",
  Moderate: "#E0A52A",
  Minor: "#2FA37A",
  Unknown: "#8B98A8",
}

export const SEVERITY_BADGE_CLASS: Record<string, string> = {
  Extreme: "bg-[#D93A2B]/10 text-[#B22A1E] ring-[#D93A2B]/25",
  Severe: "bg-[#F47A20]/10 text-[#B85614] ring-[#F47A20]/25",
  Moderate: "bg-[#E0A52A]/10 text-[#9C7320] ring-[#E0A52A]/25",
  Minor: "bg-[#2FA37A]/10 text-[#247A5B] ring-[#2FA37A]/25",
  Unknown: "bg-[#8B98A8]/12 text-[#5A6B7E] ring-[#8B98A8]/25",
}

export function severityHex(severity: string | null | undefined): string {
  if (!severity) return SEVERITY_HEX.Unknown
  return SEVERITY_HEX[severity] ?? SEVERITY_HEX.Unknown
}

export function severityBadgeClass(severity: string | null | undefined): string {
  if (!severity) return SEVERITY_BADGE_CLASS.Unknown
  return SEVERITY_BADGE_CLASS[severity] ?? SEVERITY_BADGE_CLASS.Unknown
}
