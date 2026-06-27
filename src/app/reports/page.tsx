import { ZipReports } from "@/components/zip-reports"

export const dynamic = "force-dynamic"

export default function ReportsPage() {
  return (
    <main className="min-h-screen bg-[#EEF3F9] text-[#0B2037]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1FA6E5]">
            Severe weather intelligence
          </span>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
            ZIP reports
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-[#5A6B7E]">
            Live National Weather Service alerts resolved to US ZIP codes, each
            enriched with a Tomorrow.io nowcast. Search a ZIP or filter by
            severity to open its report.
          </p>
        </header>

        <ZipReports />
      </div>
    </main>
  )
}