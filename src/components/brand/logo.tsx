import { cn } from "@/lib/utils"

/**
 * Storm Sentry shield mark — flat vector identity: protective shield, AI
 * circuitry, severe-weather rain, and a central lightning divider. Brand
 * colors are intrinsic to the mark (navy / radar-blue / alert-orange), so it
 * renders identically on any surface. Mirrors public/brand/mark.svg.
 */
export function StormSentryMark({
  className,
  title = "Storm Sentry",
}: {
  className?: string
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 380 380"
      role="img"
      aria-label={title}
      className={cn("block", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id="ssInnerShield">
          <path d="M150 42 L250 76 L240 180 C232 235 202 277 150 305 C98 277 68 235 60 180 L50 76 Z" />
        </clipPath>
      </defs>
      <g transform="translate(40 10)">
        <path
          d="M150 15 L280 60 L265 185 C255 255 215 310 150 342 C85 310 45 255 35 185 L20 60 Z"
          fill="#0B2037"
        />
        <g clipPath="url(#ssInnerShield)">
          <rect x="45" y="38" width="108" height="280" fill="#1FA6E5" />
          <rect x="153" y="38" width="102" height="280" fill="#F47A20" />
          <g
            fill="none"
            stroke="#0B2037"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M127 103 H96 V82 H78" />
            <path d="M119 154 H84 V184 H66" />
            <path d="M126 211 H96 V244 H78" />
          </g>
          <g fill="#0B2037">
            <circle cx="73" cy="82" r="8" />
            <circle cx="61" cy="184" r="8" />
            <circle cx="73" cy="244" r="8" />
          </g>
          <g fill="none" stroke="#0B2037" strokeWidth="9" strokeLinecap="round">
            <path d="M211 112 L197 148" />
            <path d="M242 138 L226 179" />
            <path d="M257 185 L241 226" />
          </g>
        </g>
        <path
          d="M177 56 L122 171 H158 L134 284 L221 144 H181 L205 56 Z"
          fill="#FFFFFF"
        />
      </g>
    </svg>
  )
}

/**
 * Full horizontal lockup: shield mark + "STORM SENTRY" wordmark + the orange
 * "AI" badge from the brand board. `tone` selects ink color for the wordmark so
 * it works on light surfaces (default) or navy chrome (reverse).
 */
export function StormSentryWordmark({
  className,
  markClassName,
  tone = "ink",
  showAi = true,
}: {
  className?: string
  markClassName?: string
  tone?: "ink" | "reverse"
  showAi?: boolean
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <StormSentryMark className={cn("size-8", markClassName)} />
      <span
        className={cn(
          "font-display text-lg leading-none font-extrabold tracking-[-0.01em]",
          tone === "reverse" ? "text-white" : "text-[#0B2037]"
        )}
      >
        STORM SENTRY
      </span>
      {showAi && (
        <span className="rounded-md bg-[#F47A20] px-1.5 py-0.5 text-[11px] font-bold leading-none tracking-wide text-white">
          AI
        </span>
      )}
    </span>
  )
}
