import { ZipForecast } from "@/components/zip-forecast"

export const dynamic = "force-dynamic"

export default function ForecastPage() {
  return (
    <main className="min-h-screen bg-[#EDEAE3] text-[#201E1A]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-2">
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight sm:text-5xl">
            Forecast.
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-[#6F6A5F]">
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
