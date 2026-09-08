/**
 * Auth actions for the my.lisaos.dev portal — every credential flow
 * (email/password, 2FA, passkey, register, forgot/reset) lives here and
 * talks to accounts through the gateway. Session cookies are set on
 * accounts' response and flow back through the same origin, so subsequent
 * /api/* calls are authenticated automatically; no bearer token juggling
 * in the browser.
 *
 * Each function returns a discriminated result so callers don't have to
 * guess at error shapes — the 2FA branch of login and the "must change
 * password" branch both carry enough context to navigate to the next step.
 */

type Json = Record<string, unknown>

async function postJSON(path: string, body: Json): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
}

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  try {
    const parsed = JSON.parse(text) as { error?: string; error_description?: string }
    return parsed.error_description || parsed.error || `Request failed (${res.status})`
  } catch {
    return text || `Request failed (${res.status})`
  }
}

export type LoginResult =
  | { status: 'ok'; redirectTo?: string }
  | { status: '2fa_required'; pendingToken: string; returnTo?: string }
  | { status: 'password_change_required'; resetToken: string }
  | { status: 'error'; message: string }

export async function login(email: string, password: string, returnTo?: string): Promise<LoginResult> {
  const res = await postJSON('/api/auth/login', { email, password, return_to: returnTo ?? '' })
  if (!res.ok) {
    return { status: 'error', message: await readError(res) }
  }
  const data = (await res.json()) as {
    requires_2fa?: boolean
    pending_token?: string
    must_change_password?: boolean
    reset_token?: string
    redirect_to?: string
    return_to?: string
  }
  if (data.requires_2fa && data.pending_token) {
    return { status: '2fa_required', pendingToken: data.pending_token, returnTo: data.return_to }
  }
  if (data.must_change_password && data.reset_token) {
    return { status: 'password_change_required', resetToken: data.reset_token }
  }
  return { status: 'ok', redirectTo: data.redirect_to }
}

export type TwoFactorResult =
  | { status: 'ok'; redirectTo?: string }
  | { status: 'error'; message: string }

export async function verifyTwoFactor(pendingToken: string, code: string, returnTo?: string): Promise<TwoFactorResult> {
  const res = await postJSON('/api/verify-2fa', { token: pendingToken, code, return_to: returnTo ?? '' })
  if (!res.ok) {
    return { status: 'error', message: await readError(res) }
  }
  const data = (await res.json()) as { redirect_to?: string }
  return { status: 'ok', redirectTo: data.redirect_to }
}

export type RegisterResult =
  | { status: 'ok'; redirectTo?: string }
  | { status: 'error'; message: string }

export async function registerUser(input: {
  first_name: string
  last_name: string
  username: string
  email: string
  password: string
  phone?: string
  return_to?: string
}): Promise<RegisterResult> {
  const res = await postJSON('/api/auth/register', input)
  if (!res.ok) {
    return { status: 'error', message: await readError(res) }
  }
  const data = (await res.json()) as { redirect_to?: string }
  return { status: 'ok', redirectTo: data.redirect_to }
}

export type PasswordResetRequestResult =
  | { status: 'ok' }
  | { status: 'error'; message: string }

export async function requestPasswordReset(email: string): Promise<PasswordResetRequestResult> {
  const res = await postJSON('/api/forgot-password', { email })
  if (!res.ok) {
    return { status: 'error', message: await readError(res) }
  }
  return { status: 'ok' }
}

export async function resetPassword(token: string, password: string, confirmPassword: string): Promise<PasswordResetRequestResult> {
  const res = await postJSON('/api/reset-password', { token, password, confirm_password: confirmPassword })
  if (!res.ok) {
    return { status: 'error', message: await readError(res) }
  }
  return { status: 'ok' }
}

// ─── Passkey (WebAuthn) login ────────────────────────────────────────────────
// Accounts returns a PublicKeyCredentialRequestOptions blob on /begin and
// accepts the signed assertion on /finish. The browser's navigator.credentials
// API handles the crypto; we just shuttle the structured data.

type Base64URL = string

function base64urlToBuffer(b64url: Base64URL): ArrayBuffer {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4)
  const b64 = (b64url + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const buf = new ArrayBuffer(bin.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i)
  return buf
}

function bufferToBase64url(buf: ArrayBuffer | Uint8Array): Base64URL {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let str = ''
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i])
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export type PasskeyLoginResult =
  | { status: 'ok' }
  | { status: 'error'; message: string }

export async function loginWithPasskey(): Promise<PasskeyLoginResult> {
  if (!window.PublicKeyCredential) {
    return { status: 'error', message: 'Passkeys are not supported in this browser.' }
  }

  const begin = await postJSON('/api/passkey/login/begin', {})
  if (!begin.ok) return { status: 'error', message: await readError(begin) }
  // Accounts returns the PublicKeyCredentialRequestOptions blob AND a
  // challengeKey — the server stores the challenge keyed by that string
  // (no session cookie during discoverable login). We must hand it back
  // on finish via ?challenge_key=… or accounts answers "Challenge expired".
  const options = (await begin.json()) as {
    publicKey: {
      challenge: Base64URL
      rpId: string
      allowCredentials?: { id: Base64URL; type: string; transports?: string[] }[]
      userVerification?: string
      timeout?: number
    }
    challengeKey?: string
  }
  if (!options.challengeKey) {
    return { status: 'error', message: 'Missing challenge key from server.' }
  }

  let assertion: PublicKeyCredential | null
  try {
    assertion = (await navigator.credentials.get({
      publicKey: {
        ...options.publicKey,
        challenge: base64urlToBuffer(options.publicKey.challenge),
        userVerification: options.publicKey.userVerification as UserVerificationRequirement | undefined,
        allowCredentials: options.publicKey.allowCredentials?.map((c) => ({
          id: base64urlToBuffer(c.id),
          type: c.type as PublicKeyCredentialType,
          transports: c.transports as AuthenticatorTransport[] | undefined,
        })),
      },
    })) as PublicKeyCredential | null
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Passkey prompt cancelled.' }
  }
  if (!assertion) return { status: 'error', message: 'Passkey prompt returned no credential.' }

  const response = assertion.response as AuthenticatorAssertionResponse
  const finishUrl = `/api/passkey/login/finish?challenge_key=${encodeURIComponent(options.challengeKey)}`
  const finish = await postJSON(finishUrl, {
    id: assertion.id,
    rawId: bufferToBase64url(assertion.rawId),
    type: assertion.type,
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      authenticatorData: bufferToBase64url(response.authenticatorData),
      signature: bufferToBase64url(response.signature),
      userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : null,
    },
  })
  if (!finish.ok) return { status: 'error', message: await readError(finish) }
  return { status: 'ok' }
}

// ─── Sign out ────────────────────────────────────────────────────────────────
export async function signOut(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
}
