import { ZipForecast } from "@/components/zip-forecast"

export const dynamic = "force-dynamic"

export default function ForecastPage() {
  return (
    <main className="min-h-screen bg-[#EEF3F9] text-[#0B2037]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1FA6E5]">
            Powered by Tomorrow.io
          </span>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
            Forecast
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-[#5A6B7E]">
            Enter a US ZIP code for an hourly and 5-day outlook, powered by
            Tomorrow.io. Results are cached so repeated lookups of the same ZIP
            don&apos;t spend against the API budget.
          </p>
        </header>

        <ZipForecast />
      </div>
    </main>
  )
}