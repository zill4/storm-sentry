import { StormWatch } from "@/components/storm-watch"
import { listActiveStorms } from "@/lib/storms/store"

export const dynamic = "force-dynamic"

export default function StormMapPage() {
  const storms = listActiveStorms()
  return (
    <main className="min-h-screen bg-[#EDEAE3] text-[#201E1A]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-2">
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight sm:text-5xl">
            Live storms.
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-[#6F6A5F]">
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
