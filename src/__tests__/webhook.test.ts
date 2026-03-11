import { describe, it, expect } from 'vitest'
import { NXGateWebhook } from '../webhook.js'

describe('NXGateWebhook', () => {
  const cashInPayload = {
    type: 'QR_CODE_COPY_AND_PASTE_PAID',
    data: {
      amount: 100.0,
      status: 'PAID',
      worked: true,
      tx_id: 'tx_123',
      end_to_end: 'e2e_456',
      payment_date: '2026-01-01T12:00:00Z',
      debtor_name: 'João da Silva',
      debtor_document: '12345678901',
      type_document: 'CPF',
      magic_id: 'magic_789',
      fee: 0.5,
    },
  }

  const cashOutPayload = {
    type: 'PIX_CASHOUT_SUCCESS',
    worked: true,
    status: 'COMPLETED',
    idTransaction: 'tx_abc',
    amount: 50.0,
    key: 'joao@email.com',
    end_to_end: 'e2e_def',
    payment_date: '2026-01-01T13:00:00Z',
    magic_id: 'magic_xyz',
    fee: 1.0,
  }

  describe('parse', () => {
    it('should parse cash-in webhook from object', () => {
      const event = NXGateWebhook.parse(cashInPayload)

      expect(event.type).toBe('QR_CODE_COPY_AND_PASTE_PAID')
      expect(NXGateWebhook.isCashIn(event)).toBe(true)
      if (NXGateWebhook.isCashIn(event)) {
        expect(event.data.amount).toBe(100.0)
        expect(event.data.tx_id).toBe('tx_123')
      }
    })

    it('should parse cash-in webhook from JSON string', () => {
      const event = NXGateWebhook.parse(JSON.stringify(cashInPayload))

      expect(event.type).toBe('QR_CODE_COPY_AND_PASTE_PAID')
      expect(NXGateWebhook.isCashIn(event)).toBe(true)
    })

    it('should parse cash-out webhook', () => {
      const event = NXGateWebhook.parse(cashOutPayload)

      expect(event.type).toBe('PIX_CASHOUT_SUCCESS')
      expect(NXGateWebhook.isCashOut(event)).toBe(true)
      if (NXGateWebhook.isCashOut(event)) {
        expect(event.amount).toBe(50.0)
        expect(event.key).toBe('joao@email.com')
      }
    })

    it('should parse cash-in refunded event', () => {
      const payload = {
        ...cashInPayload,
        type: 'QR_CODE_COPY_AND_PASTE_REFUNDED',
      }
      const event = NXGateWebhook.parse(payload)

      expect(event.type).toBe('QR_CODE_COPY_AND_PASTE_REFUNDED')
      expect(NXGateWebhook.isRefunded(event)).toBe(true)
      expect(NXGateWebhook.isCashIn(event)).toBe(true)
    })

    it('should parse cash-out error event', () => {
      const payload = {
        ...cashOutPayload,
        type: 'PIX_CASHOUT_ERROR',
        error: 'Insufficient funds',
      }
      const event = NXGateWebhook.parse(payload)

      expect(event.type).toBe('PIX_CASHOUT_ERROR')
      expect(NXGateWebhook.isCashOutError(event)).toBe(true)
      expect(NXGateWebhook.isCashOut(event)).toBe(true)
    })

    it('should parse cash-out refunded event', () => {
      const payload = { ...cashOutPayload, type: 'PIX_CASHOUT_REFUNDED' }
      const event = NXGateWebhook.parse(payload)

      expect(event.type).toBe('PIX_CASHOUT_REFUNDED')
      expect(NXGateWebhook.isRefunded(event)).toBe(true)
    })

    it('should throw on invalid JSON string', () => {
      expect(() => NXGateWebhook.parse('not json')).toThrow(
        'not valid JSON',
      )
    })

    it('should throw on missing type field', () => {
      expect(() => NXGateWebhook.parse({ data: {} })).toThrow(
        'missing "type"',
      )
    })

    it('should throw on unknown event type', () => {
      expect(() =>
        NXGateWebhook.parse({ type: 'UNKNOWN_EVENT' }),
      ).toThrow('Unknown webhook event type')
    })

    it('should throw on null payload', () => {
      expect(() => NXGateWebhook.parse(null)).toThrow(
        'must be a string or object',
      )
    })

    it('should throw on cash-in without data field', () => {
      expect(() =>
        NXGateWebhook.parse({ type: 'QR_CODE_COPY_AND_PASTE_PAID' }),
      ).toThrow('missing "data"')
    })
  })

  describe('type guards', () => {
    it('isPaid should return true for paid events', () => {
      const event = NXGateWebhook.parse(cashInPayload)
      expect(NXGateWebhook.isPaid(event)).toBe(true)
    })

    it('isPaid should return false for non-paid events', () => {
      const event = NXGateWebhook.parse(cashOutPayload)
      expect(NXGateWebhook.isPaid(event)).toBe(false)
    })

    it('isCashOutSuccess should return true for success events', () => {
      const event = NXGateWebhook.parse(cashOutPayload)
      expect(NXGateWebhook.isCashOutSuccess(event)).toBe(true)
    })

    it('isCashIn and isCashOut should be mutually exclusive', () => {
      const cashIn = NXGateWebhook.parse(cashInPayload)
      const cashOut = NXGateWebhook.parse(cashOutPayload)

      expect(NXGateWebhook.isCashIn(cashIn)).toBe(true)
      expect(NXGateWebhook.isCashOut(cashIn)).toBe(false)
      expect(NXGateWebhook.isCashIn(cashOut)).toBe(false)
      expect(NXGateWebhook.isCashOut(cashOut)).toBe(true)
    })
  })
})
