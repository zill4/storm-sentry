# Storm Sentry Design Language — "Severe Weather Intelligence"

Clean, technical, instrument-grade. The app should read like a modern
weather-intelligence console built around the Storm Sentry identity: cool light
surfaces, a navy spine, and two brand colors (radar blue + alert orange) used
with intent. Reference: `storm_sentry_logo_package/` (the brand board, primary
on-white lockup, navy reverse lockup, and shield mark).

## Brand foundation (from the logo package)

- **Mark:** the shield — navy field, split radar-blue / alert-orange interior,
  AI circuitry, severe-weather rain strokes, and a central white lightning
  divider. Rendered in code by `src/components/brand/logo.tsx`
  (`StormSentryMark` / `StormSentryWordmark`); raster + vector source live in
  `public/brand/`.
- **Wordmark:** `STORM SENTRY` in bold Inter + an orange `AI` badge.
- **Core palette:** Sentry Navy `#0B2037` · Radar Blue `#1FA6E5` · Alert Orange
  `#F47A20`.

## We explicitly REJECT the "vibe coded" look

The default AI-generated aesthetic is well documented (thecrit.co, banani.co):
blue→purple/indigo gradients, glassmorphism (`bg-white/5 backdrop-blur`), neon
glows, ambient radial gradients, identical shadcn defaults, rounded-card grid
with no hierarchy. **None of these are allowed in this codebase:**

- ❌ No purple/indigo/violet — our blue is the specific Radar Blue, nothing else.
- ❌ No gradients except data viz (radar, severity ramps).
- ❌ No glassmorphism on content: the only blur is the sticky nav bar.
- ❌ No glow/`shadow-[0_0_…]`/ambient radial backgrounds behind content.
- ❌ No default-shadcn gray-on-white with `ring-white/10` styling.
- ❌ No emoji in UI copy.

## Foundations

- **Surfaces:** page `#EEF3F9` (cool light); cards `#FFFFFF`; inset panels
  `#E4EBF3`. Borders: `#D7E0EA` hairlines (1px), generous radius (`rounded-2xl`
  cards, `rounded-lg` controls, `--radius` 0.75rem). Shadows: at most one soft
  ambient (`shadow-sm`), never colored.
- **Navy chrome:** `#0B2037` is reserved for the spine — the wordmark, active
  nav pills, primary buttons, code blocks, and the one loud stat card per view.
  Raised navy surface `#103153`. Use the reverse (light-on-navy) treatment there.
- **Ink:** primary `#0B2037`; secondary `#5A6B7E`; faint `#8B98A8`. On navy:
  `#FFFFFF` primary, `#91A8BF` secondary.
- **Accents (used with intent, one loud surface per view):**
  - `--radar-blue #1FA6E5` — primary accent: eyebrows, links, focus rings,
    active/enriched states, the radar highlight card.
  - `--alert-orange #F47A20` — alert/severity emphasis, the `AI` badge, demo
    controls, the high end of the severity ramp.
  - Severity scale (the only saturated colors on maps/badges — see
    `src/lib/storms/severity.ts`): Extreme `#D93A2B` · Severe `#F47A20` ·
    Moderate `#E0A52A` · Minor `#2FA37A` · Unknown `#8B98A8`.
- **Type:** display = Inter (`font-display`, weighted 700 with `-0.02em`
  tracking) for page titles + section headings, echoing the wordmark; body/UI =
  Geist Sans; data/numerals = Geist Mono with `tabular-nums`. Page titles get a
  radar-blue eyebrow label (`text-[11px] uppercase tracking-[0.14em]`) above
  them and no trailing period. Small labels are
  `text-[11px] uppercase tracking-[0.08em]` in secondary ink.
- **Buttons:** primary = navy fill (`#0B2037`) with white text; pill
  (`rounded-full`) for inline/nav actions, `rounded-lg` for forms. Secondary =
  hairline border on white. On navy cards, the primary CTA is radar-blue.
- **Density:** generous padding (`p-5+` in cards), few words, numbers carry the
  story. Dashboard = one dominant panel (map/report) + a rail of small stat
  cards, with exactly one loud accent card.
- **Map:** light basemap (CARTO `light_all`) over a `#EEF3F9` backdrop; brand
  severity colors above; legend on a white card; maplibre controls restyled to
  the cool chrome.

## Rules of thumb

1. If a surface could be mistaken for a generic SaaS dark dashboard, it's wrong.
   Light content surfaces, navy spine.
2. Color must mean something (severity, alert, status, brand). Decoration stays
   in the cool neutrals.
3. Headings are bold Inter and short, with a radar-blue eyebrow, no period.
4. One loud accent surface per view (the radar/navy stat card), maximum two.
5. Numbers: mono, tabular, big. Labels: tiny, uppercase, letterspaced.
6. The shield mark and wordmark are the only branding — never recolor the mark.
