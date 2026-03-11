import type { NXGateErrorPayload } from './types.js'

/**
 * Erro tipado da NXGATE API.
 *
 * Contém informações estruturadas sobre o erro retornado pela API,
 * incluindo código, título, descrição e status HTTP.
 */
export class NXGateError extends Error {
  /** Código de erro da API */
  public readonly code: string
  /** Título do erro */
  public readonly title: string
  /** Descrição detalhada do erro */
  public readonly description: string
  /** Status HTTP da resposta */
  public readonly status: number

  constructor(
    payload: NXGateErrorPayload & { status: number; message?: string },
  ) {
    const description =
      payload.description ?? payload.message ?? 'Erro desconhecido'
    const title = payload.title ?? 'NXGateError'
    const code = payload.code ?? 'UNKNOWN_ERROR'

    super(`[${code}] ${title}: ${description}`)

    this.name = 'NXGateError'
    this.code = code
    this.title = title
    this.description = description
    this.status = payload.status
  }

  /**
   * Cria um NXGateError a partir do body de resposta da API.
   */
  static fromResponse(status: number, body: unknown): NXGateError {
    if (body && typeof body === 'object' && 'error' in body) {
      const err = (body as Record<string, unknown>).error

      if (typeof err === 'string') {
        return new NXGateError({
          status,
          code: 'API_ERROR',
          title: 'API Error',
          description: err,
        })
      }

      if (err && typeof err === 'object') {
        const errorObj = err as Record<string, unknown>
        return new NXGateError({
          status,
          code: (errorObj.code as string) ?? 'API_ERROR',
          title: (errorObj.title as string) ?? 'API Error',
          description: (errorObj.description as string) ?? 'Erro desconhecido',
        })
      }
    }

    return new NXGateError({
      status,
      code: 'UNKNOWN_ERROR',
      title: 'Unknown Error',
      description:
        typeof body === 'string' ? body : 'Erro inesperado na resposta da API',
    })
  }
}
