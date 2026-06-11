# Storm Sentry Design Language — "Field Instrument"

Calm, editorial, instrument-like. The app should read like a beautifully printed
weather report: warm paper surfaces, precise typography, restrained color used
only where data demands it. Reference: the a.Record / Mortgage dashboards
(warm cream, soft cards, serif display headings, one loud accent per view).

## We explicitly REJECT the "vibe coded" look

The default AI-generated aesthetic is well documented (thecrit.co, banani.co):
dark mode by default, blue→purple/indigo gradients, glassmorphism
(`bg-white/5 backdrop-blur`), neon glows, ambient radial gradients, Inter
everywhere, identical shadcn defaults, rounded-card grid with no hierarchy.
**None of these are allowed in this codebase:**

- ❌ No dark backgrounds as the default theme. Paper, not OLED.
- ❌ No purple/indigo/sky gradient accents. No gradients at all except data viz.
- ❌ No glassmorphism: no `backdrop-blur`, no translucent white/black card fills.
- ❌ No glow/`shadow-[0_0_…]`/ambient radial backgrounds behind content.
- ❌ No default-shadcn gray-on-white with `ring-white/10` styling.
- ❌ No emoji in UI copy.

## Foundations

- **Surfaces:** page `#EDEAE3` (warm paper); cards `#F7F5F0`; inset panels
  `#E7E3DA`. Borders: `#DDD8CC` hairlines (1px), generous radius (`rounded-2xl`
  cards, `rounded-lg` controls). Shadows: at most one soft ambient
  (`shadow-sm`), never colored.
- **Ink:** primary `#201E1A`; secondary `#6F6A5F`; faint `#9B958A`.
- **Accents (data only, one loud per view):**
  - `--accent-lime #D9F25C` (highlight card / primary CTA surface, ink text)
  - `--accent-orange #F2915C` (cost/severity emphasis card, ink text)
  - Severity scale (the only saturated colors on maps/badges):
    Extreme `#D9482B` · Severe `#E8772E` · Moderate `#D9A82B` · Minor `#7BA05B`
    · Unknown `#9B958A`.
- **Type:** display = Instrument Serif (`font-display`), used for page titles
  and big numerals with a trailing period style ("Live storms."); body/UI =
  Geist Sans; data/numerals = Geist Mono with `tabular-nums`. Labels are
  `text-[11px] uppercase tracking-[0.08em] text-secondary`.
- **Buttons:** pill (`rounded-full`). Primary = ink fill (`#201E1A`) with paper
  text; on lime cards primary = ink fill; secondary = hairline border on paper.
- **Density:** generous padding (`p-5+` in cards), few words, numbers carry the
  story. Dashboard = one dominant panel (map/report) + a rail of small stat
  cards, like the reference.
- **Map:** light basemap (CARTO `light_all`), severity colors above; legend on
  a paper card, not a dark chip.

## Rules of thumb

1. If a surface could be mistaken for a generic SaaS dark dashboard, it's wrong.
2. Color must mean something (severity, cost, status). Decoration stays neutral.
3. Headings are serif and short, with a period. Everything else is quiet.
4. One accent-filled card per view, maximum two.
5. Numbers: mono, tabular, big. Labels: tiny, uppercase, letterspaced.
