import { afterEach, describe, expect, test } from 'bun:test'
import { resetPassword } from './useAuth'

describe('resetPassword', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('sends confirm_password for the Go reset-password contract', async () => {
    let sentBody = ''
    globalThis.fetch = (async (_url, init) => {
      sentBody = String(init?.body ?? '')
      return new Response(JSON.stringify({ message: 'ok' }), { status: 200 })
    }) as typeof fetch

    await resetPassword('reset-token', 'new-password-123', 'new-password-123')

    expect(JSON.parse(sentBody)).toEqual({
      token: 'reset-token',
      password: 'new-password-123',
      confirm_password: 'new-password-123',
    })
  })
})
