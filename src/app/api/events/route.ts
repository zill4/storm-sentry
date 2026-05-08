import { type BusEvent, subscribe } from "@/lib/bus"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null
  let heartbeat: NodeJS.Timeout | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: BusEvent) => {
        try {
          const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
          controller.enqueue(encoder.encode(payload))
        } catch {
          // Stream closed before flush; ignore.
        }
      }

      // Hello frame so client knows it's connected.
      controller.enqueue(
        encoder.encode(
          `event: hello\ndata: ${JSON.stringify({ type: "hello", at: new Date().toISOString() })}\n\n`,
        ),
      )

      unsubscribe = subscribe(send)

      // Keep proxies + browsers from idling out the connection.
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch {
          /* closed */
        }
      }, 25_000)

      const cleanup = () => {
        unsubscribe?.()
        unsubscribe = null
        if (heartbeat) clearInterval(heartbeat)
        heartbeat = null
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }

      req.signal.addEventListener("abort", cleanup)
    },
    cancel() {
      unsubscribe?.()
      unsubscribe = null
      if (heartbeat) clearInterval(heartbeat)
      heartbeat = null
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
