import type { TokenResponse } from './types.js'
import { NXGateError } from './errors.js'

/**
 * Gerencia tokens OAuth2 com cache automático e renovação antes da expiração.
 *
 * O token é renovado automaticamente 60 segundos antes de expirar para
 * evitar erros de autenticação em requisições concorrentes.
 */
export class TokenManager {
  private readonly baseUrl: string
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly timeout: number

  private accessToken: string | null = null
  private expiresAt: number = 0
  private refreshPromise: Promise<string> | null = null

  /** Margem de segurança para renovação do token (60 segundos) */
  private static readonly REFRESH_MARGIN_MS = 60_000

  constructor(
    baseUrl: string,
    clientId: string,
    clientSecret: string,
    timeout: number,
  ) {
    this.baseUrl = baseUrl
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.timeout = timeout
  }

  /**
   * Retorna um token válido, buscando um novo se necessário.
   * Chamadas concorrentes reutilizam a mesma Promise de refresh.
   */
  async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAt) {
      return this.accessToken
    }

    // Evita múltiplas chamadas simultâneas de refresh
    if (this.refreshPromise) {
      return this.refreshPromise
    }

    this.refreshPromise = this.fetchToken().finally(() => {
      this.refreshPromise = null
    })

    return this.refreshPromise
  }

  /**
   * Invalida o token atual, forçando renovação na próxima chamada.
   */
  invalidate(): void {
    this.accessToken = null
    this.expiresAt = 0
  }

  private async fetchToken(): Promise<string> {
    const url = `${this.baseUrl}/oauth2/token`
    const body = JSON.stringify({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    })

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new NXGateError({
          status: 0,
          code: 'TIMEOUT',
          title: 'Request Timeout',
          description: `Token request timed out after ${this.timeout}ms`,
        })
      }
      throw err
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      let errorBody: unknown
      try {
        errorBody = await response.json()
      } catch {
        errorBody = await response.text()
      }
      throw NXGateError.fromResponse(response.status, errorBody)
    }

    const data = (await response.json()) as TokenResponse

    this.accessToken = data.access_token
    this.expiresAt =
      Date.now() + data.expires_in * 1000 - TokenManager.REFRESH_MARGIN_MS

    return this.accessToken
  }
}
