import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"

import { getDb } from "@/lib/db/client"
import { account, session, user, verification } from "@/lib/db/auth-schema"

// Server-side Better Auth instance. Email/password on the existing Railway
// Postgres via the Drizzle adapter. Email verification is OFF until a
// transactional email sender is wired up (see sendResetPassword note below).
export const auth = betterAuth({
  appName: "Storm Sentry",
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    // TODO: once an email provider (e.g. Resend) is configured, implement
    // sendResetPassword / sendVerificationEmail to enable password reset +
    // email verification. Without it those flows can't deliver mail.
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh the cookie at most once per day
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  // nextCookies() must be the last plugin — it forwards Set-Cookie headers
  // from server actions / route handlers.
  plugins: [nextCookies()],
})
