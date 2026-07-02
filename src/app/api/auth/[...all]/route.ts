import { toNextJsHandler } from "better-auth/next-js"

import { auth } from "@/lib/auth/auth"

// Better Auth mounts all its endpoints (sign-up, sign-in, session, sign-out, …)
// under /api/auth/* via this catch-all route handler.
export const { GET, POST } = toNextJsHandler(auth)
