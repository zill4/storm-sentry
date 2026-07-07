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
  // The per-ZIP alert gate must be live before the outbound channels so it can
  // re-emit `zip_alert` events for them to consume.
  const { startAlertGate } = await import("./lib/alerts/gate")
  const gateResult = await startAlertGate()
  console.log(
    `[storm-sentry] alert gate ${gateResult.started ? "started" : `not started (${gateResult.reason})`}`,
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
