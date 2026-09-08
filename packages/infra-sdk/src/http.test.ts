import { describe, expect, test } from 'bun:test'
import { InfraError, request } from './http'

describe('request', () => {
  test('rejects successful non-json responses', async () => {
    const fetch = async () => new Response('<!doctype html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })

    await expect(request({
      getToken: () => ({}),
      fetch: fetch as typeof globalThis.fetch,
    }, '/api/accounts/me/scope')).rejects.toThrow(InfraError)
  })
})
