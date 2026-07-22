// Transactional email via Resend's REST API (no SDK needed). Self-enables
// when RESEND_API_KEY is present, mirroring how the GHL notifier gates itself;
// until then sends log a "would send" line and return { sent: false }.

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

const FROM = () =>
  process.env.EMAIL_FROM ?? "Storm Sentry <onboarding@resend.dev>"

export async function sendEmail(input: {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
}): Promise<{ sent: boolean; id?: string; error?: string }> {
  const to = Array.isArray(input.to) ? input.to : [input.to]
  if (!isEmailConfigured()) {
    console.log(`[email] not configured — would send "${input.subject}" to ${to.join(", ")}`)
    return { sent: false, error: "email not configured" }
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM(),
        to,
        subject: input.subject,
        html: input.html,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    })
    if (!res.ok) {
      const detail = await res.text()
      console.error(`[email] send failed (${res.status})`, detail.slice(0, 300))
      return { sent: false, error: `resend ${res.status}` }
    }
    const body = (await res.json()) as { id?: string }
    return { sent: true, id: body.id }
  } catch (err) {
    console.error("[email] send crashed", err)
    return { sent: false, error: "network error" }
  }
}
