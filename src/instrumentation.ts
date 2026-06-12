export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  try {
    const { hydrateFromDb } = await import("./lib/db/persist")
    const h = await hydrateFromDb()
    console.log(
      `[storm-sentry] hydrated from db: ${h.storms} storms, ${h.zipInsights} zip insights, budget=${h.budget}`,
    )
  } catch (err) {
    console.error("[storm-sentry] db hydration failed (continuing in-memory)", err)
  }
  const { startPoller } = await import("./lib/storms/poller")
  const pollerResult = startPoller()
  console.log(
    `[storm-sentry] poller ${pollerResult.started ? "started" : `not started (${pollerResult.reason})`}`,
  )
  const { startWebhookDispatcher } = await import("./lib/webhooks/dispatcher")
  const dispatcherResult = startWebhookDispatcher()
  console.log(
    `[storm-sentry] webhook dispatcher ${dispatcherResult.started ? "started" : `not started (${dispatcherResult.reason})`}`,
  )
  const { startGhlNotifier } = await import("./lib/ghl/notifier")
  const ghlResult = await startGhlNotifier()
  console.log(
    `[storm-sentry] ghl notifier ${ghlResult.started ? "started" : `not started (${ghlResult.reason})`}`,
  )
}
