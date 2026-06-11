import { ZipForecast } from "@/components/zip-forecast"

export const dynamic = "force-dynamic"

export default function ForecastPage() {
  return (
    <main className="dark relative min-h-screen overflow-hidden bg-[#070b16] text-zinc-100">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(70%_55%_at_50%_-10%,rgba(56,189,248,0.16),transparent_60%)]" />
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-2">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-300">
            ZIP Forecast
          </span>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            ZIP Forecast
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-zinc-400">
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
