import type {
  WebhookEvent,
  CashInWebhookEvent,
  CashOutWebhookEvent,
  CashInEventType,
  CashOutEventType,
} from './types.js'

const CASH_IN_TYPES: ReadonlySet<string> = new Set([
  'QR_CODE_COPY_AND_PASTE_PAID',
  'QR_CODE_COPY_AND_PASTE_REFUNDED',
])

const CASH_OUT_TYPES: ReadonlySet<string> = new Set([
  'PIX_CASHOUT_SUCCESS',
  'PIX_CASHOUT_ERROR',
  'PIX_CASHOUT_REFUNDED',
])

/**
 * Utilitário para parsing e validação de eventos webhook da NXGATE.
 *
 * @example
 * ```ts
 * const event = NXGateWebhook.parse(req.body)
 *
 * if (NXGateWebhook.isCashIn(event)) {
 *   console.log('Pagamento recebido:', event.data.amount)
 * }
 *
 * if (NXGateWebhook.isCashOut(event)) {
 *   console.log('Saque realizado:', event.amount)
 * }
 * ```
 */
export class NXGateWebhook {
  private constructor() {}

  /**
   * Faz o parse e validação de um payload de webhook.
   *
   * @param payload - Corpo da requisição do webhook (string JSON ou objeto)
   * @returns Evento tipado do webhook
   * @throws {Error} Se o payload for inválido ou o tipo de evento desconhecido
   */
  static parse(payload: unknown): WebhookEvent {
    let data: Record<string, unknown>

    if (typeof payload === 'string') {
      try {
        data = JSON.parse(payload) as Record<string, unknown>
      } catch {
        throw new Error('Webhook payload is not valid JSON')
      }
    } else if (payload && typeof payload === 'object') {
      data = payload as Record<string, unknown>
    } else {
      throw new Error('Webhook payload must be a string or object')
    }

    const type = data.type as string | undefined

    if (!type) {
      throw new Error('Webhook payload is missing "type" field')
    }

    if (CASH_IN_TYPES.has(type)) {
      if (!data.data || typeof data.data !== 'object') {
        throw new Error('Cash-in webhook payload is missing "data" field')
      }
      return {
        type: type as CashInEventType,
        data: data.data,
      } as CashInWebhookEvent
    }

    if (CASH_OUT_TYPES.has(type)) {
      return data as unknown as CashOutWebhookEvent
    }

    throw new Error(`Unknown webhook event type: "${type}"`)
  }

  /**
   * Type guard: verifica se o evento é um evento de cash-in (pagamento recebido).
   */
  static isCashIn(event: WebhookEvent): event is CashInWebhookEvent {
    return CASH_IN_TYPES.has(event.type)
  }

  /**
   * Type guard: verifica se o evento é um evento de cash-out (saque).
   */
  static isCashOut(event: WebhookEvent): event is CashOutWebhookEvent {
    return CASH_OUT_TYPES.has(event.type)
  }

  /**
   * Type guard: verifica se o pagamento foi confirmado (cash-in pago).
   */
  static isPaid(event: WebhookEvent): event is CashInWebhookEvent {
    return event.type === 'QR_CODE_COPY_AND_PASTE_PAID'
  }

  /**
   * Type guard: verifica se houve reembolso (cash-in ou cash-out).
   */
  static isRefunded(event: WebhookEvent): boolean {
    return (
      event.type === 'QR_CODE_COPY_AND_PASTE_REFUNDED' ||
      event.type === 'PIX_CASHOUT_REFUNDED'
    )
  }

  /**
   * Type guard: verifica se o cash-out foi realizado com sucesso.
   */
  static isCashOutSuccess(event: WebhookEvent): event is CashOutWebhookEvent {
    return event.type === 'PIX_CASHOUT_SUCCESS'
  }

  /**
   * Type guard: verifica se o cash-out falhou.
   */
  static isCashOutError(event: WebhookEvent): event is CashOutWebhookEvent {
    return event.type === 'PIX_CASHOUT_ERROR'
  }
}
