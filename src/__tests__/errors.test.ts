import { describe, it, expect } from 'vitest'
import { NXGateError } from '../errors.js'

describe('NXGateError', () => {
  it('should create error with all fields', () => {
    const error = new NXGateError({
      status: 400,
      code: 'INVALID_REQUEST',
      title: 'Bad Request',
      description: 'Missing required field',
    })

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(NXGateError)
    expect(error.name).toBe('NXGateError')
    expect(error.code).toBe('INVALID_REQUEST')
    expect(error.title).toBe('Bad Request')
    expect(error.description).toBe('Missing required field')
    expect(error.status).toBe(400)
    expect(error.message).toBe(
      '[INVALID_REQUEST] Bad Request: Missing required field',
    )
  })

  it('should use defaults for missing fields', () => {
    const error = new NXGateError({ status: 500 })

    expect(error.code).toBe('UNKNOWN_ERROR')
    expect(error.title).toBe('NXGateError')
    expect(error.description).toBe('Erro desconhecido')
    expect(error.status).toBe(500)
  })

  describe('fromResponse', () => {
    it('should parse structured error object', () => {
      const body = {
        error: {
          title: 'Unauthorized',
          code: 'AUTH_FAILED',
          description: 'Invalid credentials',
        },
      }

      const error = NXGateError.fromResponse(401, body)

      expect(error.code).toBe('AUTH_FAILED')
      expect(error.title).toBe('Unauthorized')
      expect(error.description).toBe('Invalid credentials')
      expect(error.status).toBe(401)
    })

    it('should parse string error', () => {
      const body = { error: 'Token expired' }

      const error = NXGateError.fromResponse(401, body)

      expect(error.code).toBe('API_ERROR')
      expect(error.description).toBe('Token expired')
      expect(error.status).toBe(401)
    })

    it('should handle unknown body shape', () => {
      const error = NXGateError.fromResponse(500, { unexpected: true })

      expect(error.code).toBe('UNKNOWN_ERROR')
      expect(error.status).toBe(500)
    })

    it('should handle string body', () => {
      const error = NXGateError.fromResponse(500, 'Internal Server Error')

      expect(error.description).toBe('Internal Server Error')
      expect(error.status).toBe(500)
    })

    it('should handle null body', () => {
      const error = NXGateError.fromResponse(500, null)

      expect(error.code).toBe('UNKNOWN_ERROR')
      expect(error.status).toBe(500)
    })
  })
})
