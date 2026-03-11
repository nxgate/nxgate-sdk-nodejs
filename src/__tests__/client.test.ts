import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NXGate } from '../client.js'
import { NXGateError } from '../errors.js'

function mockFetchSequence(...responses: Array<Partial<Response> & { ok: boolean }>) {
  const fn = vi.fn()
  for (const resp of responses) {
    fn.mockResolvedValueOnce({
      headers: new Headers({ 'content-type': 'application/json' }),
      ...resp,
    })
  }
  vi.stubGlobal('fetch', fn)
  return fn
}

function tokenResponse(token = 'test_token') {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({
      access_token: token,
      token_type: 'Bearer',
      expires_in: 3600,
    }),
  }
}

function jsonResponse(data: unknown) {
  return {
    ok: true,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: vi.fn().mockResolvedValue(data),
  }
}

function errorResponse(status: number, body: unknown) {
  return {
    ok: false,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: vi.fn().mockResolvedValue(body),
  }
}

describe('NXGate Client', () => {
  let client: NXGate

  beforeEach(() => {
    client = new NXGate({
      clientId: 'test_id',
      clientSecret: 'test_secret',
    })
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should throw if clientId is missing', () => {
    expect(() => new NXGate({ clientId: '', clientSecret: 'secret' })).toThrow(
      'clientId is required',
    )
  })

  it('should throw if clientSecret is missing', () => {
    expect(() => new NXGate({ clientId: 'id', clientSecret: '' })).toThrow(
      'clientSecret is required',
    )
  })

  describe('pixGenerate', () => {
    it('should generate a PIX charge', async () => {
      const responseData = {
        status: 'success',
        message: 'Cobrança gerada',
        paymentCode: 'pix_code_123',
        idTransaction: 'tx_123',
        paymentCodeBase64: 'base64data',
      }

      mockFetchSequence(tokenResponse(), jsonResponse(responseData))

      const result = await client.pixGenerate({
        valor: 100.0,
        nome_pagador: 'João',
        documento_pagador: '12345678901',
        webhook: 'https://example.com/webhook',
      })

      expect(result).toEqual(responseData)
      expect(fetch).toHaveBeenCalledTimes(2)

      // Verify second call is POST /pix/gerar with auth header
      const secondCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[1]
      expect(secondCall[0]).toContain('/pix/gerar')
      expect(secondCall[1].method).toBe('POST')
      expect(secondCall[1].headers.Authorization).toBe('Bearer test_token')
    })
  })

  describe('pixWithdraw', () => {
    it('should make a PIX withdrawal', async () => {
      const responseData = {
        status: 'success',
        message: 'Saque iniciado',
        internalreference: 'ref_abc',
      }

      mockFetchSequence(tokenResponse(), jsonResponse(responseData))

      const result = await client.pixWithdraw({
        valor: 50,
        chave_pix: 'joao@email.com',
        tipo_chave: 'EMAIL',
      })

      expect(result).toEqual(responseData)

      const secondCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[1]
      expect(secondCall[0]).toContain('/pix/sacar')
      const body = JSON.parse(secondCall[1].body)
      expect(body.valor).toBe(50)
      expect(body.chave_pix).toBe('joao@email.com')
      expect(body.tipo_chave).toBe('EMAIL')
    })
  })

  describe('getBalance', () => {
    it('should return account balance', async () => {
      const responseData = {
        balance: 1000,
        blocked: 50,
        available: 950,
      }

      mockFetchSequence(tokenResponse(), jsonResponse(responseData))

      const result = await client.getBalance()

      expect(result).toEqual(responseData)

      const secondCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[1]
      expect(secondCall[0]).toContain('/v1/balance')
      expect(secondCall[1].method).toBe('GET')
    })
  })

  describe('getTransaction', () => {
    it('should query a transaction', async () => {
      const responseData = {
        idTransaction: 'tx_123',
        status: 'PAID',
        amount: 100,
        paidAt: '2026-01-01T12:00:00Z',
        endToEnd: 'e2e_456',
      }

      mockFetchSequence(tokenResponse(), jsonResponse(responseData))

      const result = await client.getTransaction({
        type: 'cash-in',
        txid: 'tx_123',
      })

      expect(result).toEqual(responseData)

      const secondCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[1]
      expect(secondCall[0]).toContain('/v1/transactions')
      expect(secondCall[0]).toContain('type=cash-in')
      expect(secondCall[0]).toContain('txid=tx_123')
    })
  })

  describe('error handling', () => {
    it('should throw NXGateError on API error', async () => {
      mockFetchSequence(
        tokenResponse(),
        errorResponse(400, {
          error: { title: 'Bad Request', code: 'INVALID', description: 'Invalid valor' },
        }),
      )

      await expect(
        client.pixGenerate({
          valor: -1,
          nome_pagador: 'Test',
          documento_pagador: '123',
        }),
      ).rejects.toThrow(NXGateError)
    })
  })

  describe('retry on 503', () => {
    it('should retry on 503 and succeed', async () => {
      const responseData = {
        balance: 1000,
        blocked: 0,
        available: 1000,
      }

      mockFetchSequence(
        tokenResponse(),
        {
          ok: false,
          status: 503,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: vi.fn().mockResolvedValue({ error: 'Service unavailable' }),
        },
        jsonResponse(responseData),
      )

      const result = await client.getBalance()

      expect(result).toEqual(responseData)
      expect(fetch).toHaveBeenCalledTimes(3) // token + 503 + success
    })

    it('should throw after max retries on 503', async () => {
      const error503 = {
        ok: false,
        status: 503,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: vi.fn().mockResolvedValue({ error: 'Service unavailable' }),
      }

      mockFetchSequence(tokenResponse(), error503, error503, error503)

      await expect(client.getBalance()).rejects.toThrow(NXGateError)
    })
  })

  describe('HMAC signing', () => {
    it('should include HMAC headers when hmacSecret is provided', async () => {
      const hmacClient = new NXGate({
        clientId: 'test_id',
        clientSecret: 'test_secret',
        hmacSecret: 'hmac_secret_key',
      })

      const responseData = { balance: 100, blocked: 0, available: 100 }
      mockFetchSequence(tokenResponse(), jsonResponse(responseData))

      await hmacClient.getBalance()

      const secondCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[1]
      const headers = secondCall[1].headers

      expect(headers['X-Client-ID']).toBe('test_id')
      expect(headers['X-HMAC-Signature']).toBeTruthy()
      expect(headers['X-HMAC-Timestamp']).toBeTruthy()
      expect(headers['X-HMAC-Nonce']).toBeTruthy()
    })

    it('should NOT include HMAC headers when hmacSecret is not provided', async () => {
      const responseData = { balance: 100, blocked: 0, available: 100 }
      mockFetchSequence(tokenResponse(), jsonResponse(responseData))

      await client.getBalance()

      const secondCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[1]
      const headers = secondCall[1].headers

      expect(headers['X-Client-ID']).toBeUndefined()
      expect(headers['X-HMAC-Signature']).toBeUndefined()
    })
  })

  describe('token refresh on 401', () => {
    it('should invalidate token and retry on 401', async () => {
      const responseData = { balance: 500, blocked: 0, available: 500 }

      mockFetchSequence(
        tokenResponse('old_token'),
        {
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: vi.fn().mockResolvedValue({ error: 'Token expired' }),
        },
        tokenResponse('new_token'),
        jsonResponse(responseData),
      )

      const result = await client.getBalance()

      expect(result).toEqual(responseData)
      // token fetch #1 + 401 + token fetch #2 + success
      expect(fetch).toHaveBeenCalledTimes(4)
    })
  })
})
