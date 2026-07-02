"use client"

import { createAuthClient } from "better-auth/react"

// Client-side Better Auth. Same-origin, so no baseURL needed — it calls the
// /api/auth/* handlers mounted in this app.
export const authClient = createAuthClient()

export const { signIn, signUp, signOut, useSession } = authClient
