import { StormWatch } from "@/components/storm-watch"
import { listActiveStorms } from "@/lib/storms/store"

export const dynamic = "force-dynamic"

export default function StormMapPage() {
  const storms = listActiveStorms()
  return (
    <main className="min-h-screen bg-[#f7f8f6] text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-1 border-b border-zinc-200 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight">Storm Map</h1>
          <p className="max-w-3xl text-sm leading-6 text-zinc-600">
            Live US severe-weather feed pulled from the National Weather Service
            every 60 seconds. The map shows alerts with polygon geometry; the
            table below lists every active alert sorted by severity.
          </p>
        </header>

        <StormWatch initialStorms={storms} />
      </div>
    </main>
  )
}
