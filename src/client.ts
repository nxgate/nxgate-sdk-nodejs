import type {
  NXGateConfig,
  PixGenerateRequest,
  PixGenerateResponse,
  PixWithdrawRequest,
  PixWithdrawResponse,
  BalanceResponse,
  GetTransactionParams,
  TransactionResponse,
  RequestOptions,
} from './types.js'
import { TokenManager } from './auth.js'
import { HmacSigner } from './hmac.js'
import { NXGateError } from './errors.js'

const DEFAULT_BASE_URL = 'https://api.nxgate.com.br'
const DEFAULT_TIMEOUT = 30_000
const DEFAULT_MAX_RETRIES = 2

/**
 * Cliente principal do SDK NXGATE.
 *
 * @example
 * ```ts
 * const nx = new NXGate({
 *   clientId: 'nxgate_xxx',
 *   clientSecret: 'secret',
 *   hmacSecret: 'optional',
 * })
 *
 * const charge = await nx.pixGenerate({
 *   valor: 100.00,
 *   nome_pagador: 'João da Silva',
 *   documento_pagador: '12345678901',
 * })
 * ```
 */
export class NXGate {
  private readonly baseUrl: string
  private readonly timeout: number
  private readonly maxRetries: number
  private readonly tokenManager: TokenManager
  private readonly hmacSigner: HmacSigner | null

  constructor(config: NXGateConfig) {
    if (!config.clientId) throw new Error('clientId is required')
    if (!config.clientSecret) throw new Error('clientSecret is required')

    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES

    this.tokenManager = new TokenManager(
      this.baseUrl,
      config.clientId,
      config.clientSecret,
      this.timeout,
    )

    this.hmacSigner = config.hmacSecret
      ? new HmacSigner(config.clientId, config.hmacSecret)
      : null
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Gera uma cobrança PIX (cash-in) e retorna o QR Code.
   */
  async pixGenerate(params: PixGenerateRequest): Promise<PixGenerateResponse> {
    return this.request<PixGenerateResponse>({
      method: 'POST',
      path: '/pix/gerar',
      body: params as unknown as Record<string, unknown>,
      authenticate: true,
    })
  }

  /**
   * Realiza um saque PIX (cash-out).
   */
  async pixWithdraw(params: PixWithdrawRequest): Promise<PixWithdrawResponse> {
    return this.request<PixWithdrawResponse>({
      method: 'POST',
      path: '/pix/sacar',
      body: params as unknown as Record<string, unknown>,
      authenticate: true,
    })
  }

  /**
   * Consulta o saldo da conta.
   */
  async getBalance(): Promise<BalanceResponse> {
    return this.request<BalanceResponse>({
      method: 'GET',
      path: '/v1/balance',
      authenticate: true,
    })
  }

  /**
   * Consulta uma transação específica.
   */
  async getTransaction(
    params: GetTransactionParams,
  ): Promise<TransactionResponse> {
    return this.request<TransactionResponse>({
      method: 'GET',
      path: '/v1/transactions',
      query: { type: params.type, txid: params.txid },
      authenticate: true,
    })
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  private async request<T>(
    options: RequestOptions,
    isRetry: boolean = false,
  ): Promise<T> {
    const { method, path, body, query, authenticate } = options

    // Build URL
    let url = `${this.baseUrl}${path}`
    if (query) {
      const searchParams = new URLSearchParams(query)
      url += `?${searchParams.toString()}`
    }

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }

    // Auth
    if (authenticate) {
      const token = await this.tokenManager.getToken()
      headers['Authorization'] = `Bearer ${token}`
    }

    // HMAC signing
    const bodyStr = body ? JSON.stringify(body) : ''
    if (this.hmacSigner) {
      const hmacHeaders = this.hmacSigner.sign(method, path, bodyStr)
      Object.assign(headers, hmacHeaders)
    }

    // Execute with retry on 503
    const response = await this.executeWithRetry(url, {
      method,
      headers,
      body: body ? bodyStr : undefined,
    })

    // Invalidate token on 401 and retry the full request once
    if (response.status === 401 && !isRetry) {
      this.tokenManager.invalidate()
      return this.request<T>(options, true)
    }

    // Parse response
    let responseBody: unknown
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      responseBody = await response.json()
    } else {
      responseBody = await response.text()
    }

    if (!response.ok) {
      throw NXGateError.fromResponse(response.status, responseBody)
    }

    return responseBody as T
  }

  private async executeWithRetry(
    url: string,
    init: RequestInit,
    attempt: number = 0,
  ): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)

    let response: Response
    try {
      response = await fetch(url, {
        ...init,
        signal: controller.signal,
      })
    } catch (err) {
      clearTimeout(timer)
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new NXGateError({
          status: 0,
          code: 'TIMEOUT',
          title: 'Request Timeout',
          description: `Request timed out after ${this.timeout}ms`,
        })
      }
      throw err
    } finally {
      clearTimeout(timer)
    }

    // Retry on 503
    if (response.status === 503 && attempt < this.maxRetries) {
      const delay = Math.pow(2, attempt) * 500 // 500ms, 1000ms
      await this.sleep(delay)
      return this.executeWithRetry(url, init, attempt + 1)
    }

    return response
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
