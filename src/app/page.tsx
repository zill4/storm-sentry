import { StormWatch } from "@/components/storm-watch"
import { listActiveStorms } from "@/lib/storms/store"

export const dynamic = "force-dynamic"

export default function StormMapPage() {
  const storms = listActiveStorms()
  return (
    <main className="dark relative min-h-screen overflow-hidden bg-[#070b16] text-zinc-100">
      {/* Ambient glow behind the dashboard. */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(70%_55%_at_50%_-10%,rgba(56,189,248,0.16),transparent_60%)]" />
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-2">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-300">
            Storm Sentry
          </span>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Live Storm Intelligence
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-zinc-400">
            Real-time US severe-weather alerts from the National Weather Service
            over a live precipitation-radar layer, resolved down to the ZIP
            code. Each threatened ZIP is enriched with a Tomorrow.io nowcast and
            queued as an exportable event.
          </p>
        </header>

        <StormWatch initialStorms={storms} />
      </div>
    </main>
  )
}
