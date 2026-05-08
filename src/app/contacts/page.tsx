import { BusinessesDashboard } from "@/components/businesses-dashboard"
import { listBusinessesWithStatus } from "@/lib/businesses/status"

export const dynamic = "force-dynamic"

export default function ContactsPage() {
  const businesses = listBusinessesWithStatus()
  return (
    <main className="min-h-screen bg-[#f7f8f6] text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-1 border-b border-zinc-200 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="max-w-3xl text-sm leading-6 text-zinc-600">
            Every roofer you manage, with their notification status. A contact
            flips to <span className="font-medium text-red-700">notified</span>{" "}
            when an active NWS alert lands within 5 miles of their location.
          </p>
        </header>

        <BusinessesDashboard initial={businesses} />
      </div>
    </main>
  )
}
