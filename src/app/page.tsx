import { StormWatch } from "@/components/storm-watch"
import { listActiveStorms } from "@/lib/storms/store"

export const dynamic = "force-dynamic"

export default function StormMapPage() {
  const storms = listActiveStorms()
  return (
    <main className="min-h-screen bg-[#EEF3F9] text-[#0B2037]">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <StormWatch initialStorms={storms} />
      </div>
    </main>
  )
}