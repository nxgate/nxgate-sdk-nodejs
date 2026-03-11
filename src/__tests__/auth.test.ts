import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TokenManager } from '../auth.js'
import { NXGateError } from '../errors.js'

describe('TokenManager', () => {
  const baseUrl = 'https://api.nxgate.com.br'
  const clientId = 'test_id'
  const clientSecret = 'test_secret'
  const timeout = 5000

  let manager: TokenManager

  beforeEach(() => {
    manager = new TokenManager(baseUrl, clientId, clientSecret, timeout)
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should fetch a new token on first call', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        access_token: 'token_abc',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    const token = await manager.getToken()

    expect(token).toBe('token_abc')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/oauth2/token`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
      }),
    )
  })

  it('should return cached token on subsequent calls', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        access_token: 'token_cached',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    const token1 = await manager.getToken()
    const token2 = await manager.getToken()

    expect(token1).toBe('token_cached')
    expect(token2).toBe('token_cached')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('should refresh token when expired', async () => {
    const mockResponse1 = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        access_token: 'token_1',
        token_type: 'Bearer',
        expires_in: 0, // Expires immediately (minus 60s margin -> already expired)
      }),
    }
    const mockResponse2 = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        access_token: 'token_2',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(mockResponse1).mockResolvedValueOnce(mockResponse2),
    )

    const token1 = await manager.getToken()
    const token2 = await manager.getToken()

    expect(token1).toBe('token_1')
    expect(token2).toBe('token_2')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('should throw NXGateError on auth failure', async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({
        error: {
          title: 'Unauthorized',
          code: 'AUTH_FAILED',
          description: 'Invalid credentials',
        },
      }),
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    await expect(manager.getToken()).rejects.toThrow(NXGateError)
    await expect(manager.getToken()).rejects.toMatchObject({
      code: 'AUTH_FAILED',
      status: 401,
    })
  })

  it('should deduplicate concurrent token requests', async () => {
    let resolveCount = 0
    const mockResponse = {
      ok: true,
      json: vi.fn().mockImplementation(() => {
        resolveCount++
        return Promise.resolve({
          access_token: `token_${resolveCount}`,
          token_type: 'Bearer',
          expires_in: 3600,
        })
      }),
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    const [t1, t2, t3] = await Promise.all([
      manager.getToken(),
      manager.getToken(),
      manager.getToken(),
    ])

    expect(t1).toBe(t2)
    expect(t2).toBe(t3)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('should invalidate cached token', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        access_token: 'token_fresh',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    await manager.getToken()
    manager.invalidate()
    await manager.getToken()

    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('should handle non-JSON error response', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error('not json')),
      text: vi.fn().mockResolvedValue('Internal Server Error'),
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    await expect(manager.getToken()).rejects.toThrow(NXGateError)
  })
})
