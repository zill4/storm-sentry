import type { Business } from "@/lib/businesses/types"
import type { StormEvent } from "@/lib/storms/types"

export function buildAlertText(business: Business, storm: StormEvent, distanceMeters: number): string {
  const miles = (distanceMeters / 1609.344).toFixed(1)
  const expires = storm.expiresAt
    ? new Date(storm.expiresAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "soon"
  return [
    `STORM ALERT — ${storm.severity.toUpperCase()} ${storm.eventType.toUpperCase()}`,
    `${business.name} (${business.city}, ${business.state})`,
    `Active alert ~${miles} mi from your service area. Expires ${expires}.`,
    `Smart Tarps fast-deploy crews are staged for this storm. Reply YES to lock priority dispatch, or call us anytime.`,
  ].join("\n")
}

const KEYWORD_REPLIES: Array<{ pattern: RegExp; reply: string }> = [
  {
    pattern: /\b(yes|y|confirm|go|deploy|book|count me in)\b/i,
    reply:
      "Locked in. Tarps and crew are on standby for {city}. We will message you again the moment damage starts coming in. Stay safe.",
  },
  {
    pattern: /\b(price|cost|how much|pricing|quote)\b/i,
    reply:
      "Standard storm-response tarp packages run between $850 and $2,400 per deployment depending on roof size and pitch. Reply with a property address and we will send a precise number.",
  },
  {
    pattern: /\b(when|eta|how long|timeline)\b/i,
    reply:
      "Crews can be at your first job within 90 minutes of confirmation while the storm is active. We pre-stage trucks once Storm Sentry posts an alert, so we are already rolling.",
  },
  {
    pattern: /\b(how|what|who|why)\b/i,
    reply:
      "Storm Sentry watches NWS alerts in real time and pings you the second your service area is in the impact zone. Keeps you ahead of homeowner calls. Anything specific you want walked through?",
  },
  {
    pattern: /\b(no|nope|skip|pass|not now)\b/i,
    reply:
      "All good. We will keep monitoring. If conditions get worse we will check back in. Reply STOP any time to pause alerts.",
  },
  {
    pattern: /\b(stop|unsubscribe|opt out)\b/i,
    reply:
      "Got it. We will pause alerts for this storm. You will still get our weekly recap unless you reply STOP ALL.",
  },
]

const DEFAULT_REPLY =
  "Copy that. Smart Tarps team is standing by. Send YES to lock priority dispatch or ask anything about the storm response."

export function buildScriptedReply(userInput: string, business: Business): string {
  for (const { pattern, reply } of KEYWORD_REPLIES) {
    if (pattern.test(userInput)) {
      return reply.replace("{city}", business.city)
    }
  }
  return DEFAULT_REPLY
}
