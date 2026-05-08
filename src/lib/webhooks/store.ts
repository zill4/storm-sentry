export type WebhookSubscription = {
  id: string
  url: string
  secret: string | null
  events: string[]
  createdAt: string
  // Stats
  attempts: number
  successes: number
  failures: number
  lastDispatchAt: string | null
  lastError: string | null
  lastStatus: number | null
}

export type WebhookDelivery = {
  id: string
  subscriptionId: string
  url: string
  eventType: string
  status: number | null
  ok: boolean
  error: string | null
  attemptedAt: string
  durationMs: number
  payloadPreview: string
}

type WebhookShape = {
  subs: Map<string, WebhookSubscription>
  // Bounded ring buffer of recent deliveries for inspection.
  deliveries: WebhookDelivery[]
}

const MAX_DELIVERIES = 200

declare global {
  // eslint-disable-next-line no-var
  var __stormSentryWebhooks: WebhookShape | undefined
}

function getStore(): WebhookShape {
  if (!globalThis.__stormSentryWebhooks) {
    globalThis.__stormSentryWebhooks = {
      subs: new Map(),
      deliveries: [],
    }
  }
  return globalThis.__stormSentryWebhooks
}

export function listWebhooks(): WebhookSubscription[] {
  return [...getStore().subs.values()]
}

export function getWebhook(id: string): WebhookSubscription | undefined {
  return getStore().subs.get(id)
}

export function createWebhook(opts: {
  url: string
  secret?: string | null
  events?: string[]
}): WebhookSubscription {
  const id = `wh_${Math.random().toString(36).slice(2, 10)}`
  const sub: WebhookSubscription = {
    id,
    url: opts.url,
    secret: opts.secret ?? null,
    events: opts.events && opts.events.length ? opts.events : ["match_created"],
    createdAt: new Date().toISOString(),
    attempts: 0,
    successes: 0,
    failures: 0,
    lastDispatchAt: null,
    lastError: null,
    lastStatus: null,
  }
  getStore().subs.set(id, sub)
  return sub
}

export function deleteWebhook(id: string): boolean {
  return getStore().subs.delete(id)
}

export function recordDelivery(d: WebhookDelivery): void {
  const store = getStore()
  const sub = store.subs.get(d.subscriptionId)
  if (sub) {
    sub.attempts += 1
    if (d.ok) sub.successes += 1
    else sub.failures += 1
    sub.lastDispatchAt = d.attemptedAt
    sub.lastError = d.error
    sub.lastStatus = d.status
  }
  store.deliveries.unshift(d)
  if (store.deliveries.length > MAX_DELIVERIES) {
    store.deliveries.length = MAX_DELIVERIES
  }
}

export function listDeliveries(limit = 50): WebhookDelivery[] {
  return getStore().deliveries.slice(0, limit)
}
