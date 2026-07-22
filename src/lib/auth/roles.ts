// Admin gate. Better Auth's user model here has no role column; admins are
// designated by email through ADMIN_EMAILS (comma-separated, case-insensitive).
// Fits the current team size — swap for a proper role column if that changes.

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminUser(user: { email: string } | null | undefined): boolean {
  if (!user?.email) return false
  return adminEmails().includes(user.email.toLowerCase())
}

/** Route-handler gate: session user must be an admin. */
export async function requireAdminSession() {
  const { getServerSession } = await import("./session")
  const session = await getServerSession()
  if (!session || !isAdminUser(session.user)) return null
  return session
}
