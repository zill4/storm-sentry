export const SEVERITY_HEX: Record<string, string> = {
  Extreme: "#D9482B",
  Severe: "#E8772E",
  Moderate: "#D9A82B",
  Minor: "#7BA05B",
  Unknown: "#9B958A",
}

export const SEVERITY_BADGE_CLASS: Record<string, string> = {
  Extreme: "bg-[#D9482B]/10 text-[#A8361F] ring-[#D9482B]/25",
  Severe: "bg-[#E8772E]/10 text-[#B55A1D] ring-[#E8772E]/25",
  Moderate: "bg-[#D9A82B]/10 text-[#9C7A1C] ring-[#D9A82B]/25",
  Minor: "bg-[#7BA05B]/10 text-[#5C7A42] ring-[#7BA05B]/25",
  Unknown: "bg-[#9B958A]/10 text-[#6F6A5F] ring-[#9B958A]/25",
}

export function severityHex(severity: string | null | undefined): string {
  if (!severity) return SEVERITY_HEX.Unknown
  return SEVERITY_HEX[severity] ?? SEVERITY_HEX.Unknown
}

export function severityBadgeClass(severity: string | null | undefined): string {
  if (!severity) return SEVERITY_BADGE_CLASS.Unknown
  return SEVERITY_BADGE_CLASS[severity] ?? SEVERITY_BADGE_CLASS.Unknown
}
