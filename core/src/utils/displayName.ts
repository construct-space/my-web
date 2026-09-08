/**
 * displayName — pick a user-facing label from a session user object.
 *
 * Priority:
 *   1. Composed `first_name + last_name` (trimmed; either side may be missing)
 *   2. The pre-composed `name` if present
 *   3. `username`
 *   4. `email`
 *   5. fallback (default: "there")
 *
 * Centralized so the welcome line, the avatar tooltip, and the menu header
 * stay in sync — the accounts service serializes the raw User columns on
 * /me/scope, so callers can't blindly read `user.name`.
 */
export interface UserLike {
  name?: string
  first_name?: string
  last_name?: string
  username?: string
  email?: string
}

export function displayName(user: UserLike | null | undefined, fallback = 'there'): string {
  if (!user) return fallback
  const fullName = [user.first_name, user.last_name].map((s) => (s || '').trim()).filter(Boolean).join(' ')
  if (fullName) return fullName
  if (user.name && user.name.trim()) return user.name.trim()
  if (user.username && user.username.trim()) return user.username.trim()
  if (user.email && user.email.trim()) return user.email.trim()
  return fallback
}
