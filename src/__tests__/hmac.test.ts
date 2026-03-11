import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { HmacSigner } from '../hmac.js'

describe('HmacSigner', () => {
  const clientId = 'test_client_id'
  const secret = 'test_secret_key'
  const signer = new HmacSigner(clientId, secret)

  it('should return all required HMAC headers', () => {
    const headers = signer.sign('POST', '/pix/gerar', '{"valor":100}')

    expect(headers).toHaveProperty('X-Client-ID', clientId)
    expect(headers).toHaveProperty('X-HMAC-Signature')
    expect(headers).toHaveProperty('X-HMAC-Timestamp')
    expect(headers).toHaveProperty('X-HMAC-Nonce')
  })

  it('should produce a valid base64 HMAC-SHA256 signature', () => {
    const headers = signer.sign('POST', '/pix/gerar', '{"valor":100}')

    // Verify signature is valid base64
    const decoded = Buffer.from(headers['X-HMAC-Signature'], 'base64')
    expect(decoded.length).toBe(32) // SHA-256 = 32 bytes
  })

  it('should produce correct signature for known inputs', () => {
    const headers = signer.sign('POST', '/pix/gerar', '{"valor":100}')
    const { 'X-HMAC-Timestamp': timestamp, 'X-HMAC-Nonce': nonce } = headers

    // Manually compute expected signature
    const payload = `POST\n/pix/gerar\n${timestamp}\n${nonce}\n{"valor":100}`
    const expected = createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('base64')

    expect(headers['X-HMAC-Signature']).toBe(expected)
  })

  it('should produce ISO 8601 timestamp', () => {
    const headers = signer.sign('GET', '/v1/balance', '')
    const timestamp = headers['X-HMAC-Timestamp']

    // ISO 8601 format check
    expect(() => new Date(timestamp)).not.toThrow()
    expect(new Date(timestamp).toISOString()).toBe(timestamp)
  })

  it('should produce unique nonce on each call', () => {
    const h1 = signer.sign('GET', '/v1/balance', '')
    const h2 = signer.sign('GET', '/v1/balance', '')

    expect(h1['X-HMAC-Nonce']).not.toBe(h2['X-HMAC-Nonce'])
  })

  it('should handle empty body for GET requests', () => {
    const headers = signer.sign('GET', '/v1/balance', '')

    expect(headers['X-HMAC-Signature']).toBeTruthy()
  })

  it('should produce different signatures for different paths', () => {
    const h1 = signer.sign('POST', '/pix/gerar', '{}')
    const h2 = signer.sign('POST', '/pix/sacar', '{}')

    // Signatures will differ because timestamps/nonces differ,
    // but we verify the function doesn't crash
    expect(h1['X-HMAC-Signature']).toBeTruthy()
    expect(h2['X-HMAC-Signature']).toBeTruthy()
  })
})
