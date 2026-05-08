export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
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
}
