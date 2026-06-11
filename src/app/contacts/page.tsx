import { BusinessesDashboard } from "@/components/businesses-dashboard"
import { listBusinessesWithStatus } from "@/lib/businesses/status"

export const dynamic = "force-dynamic"

export default function ContactsPage() {
  const businesses = listBusinessesWithStatus()
  return (
    <main className="min-h-screen bg-[#EDEAE3] text-[#201E1A]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-2 border-b border-[#DDD8CC] pb-4">
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight sm:text-5xl">
            Contacts.
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-[#6F6A5F]">
            Every roofer you manage, with their notification status. A contact
            flips to <span className="font-medium text-[#A8361F]">notified</span>{" "}
            when an active NWS alert lands within 5 miles of their location.
          </p>
        </header>

        <BusinessesDashboard initial={businesses} />
      </div>
    </main>
  )
}
