// ─── Client Configuration ────────────────────────────────────────────────────

export interface NXGateConfig {
  /** Client ID fornecido pela NXGATE */
  clientId: string
  /** Client Secret fornecido pela NXGATE */
  clientSecret: string
  /** HMAC Secret para assinatura de requisições (opcional) */
  hmacSecret?: string
  /** URL base da API (padrão: https://api.nxgate.com.br) */
  baseUrl?: string
  /** Timeout em milissegundos (padrão: 30000) */
  timeout?: number
  /** Número máximo de retentativas em caso de erro 503 (padrão: 2) */
  maxRetries?: number
}

// ─── OAuth2 ──────────────────────────────────────────────────────────────────

export interface TokenRequest {
  grant_type: 'client_credentials'
  client_id: string
  client_secret: string
}

export interface TokenResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
}

// ─── PIX Gerar (Cash-in) ────────────────────────────────────────────────────

export interface SplitUser {
  username: string
  percentage: number
}

export interface PixGenerateRequest {
  /** Valor da cobrança em reais */
  valor: number
  /** Nome do pagador */
  nome_pagador: string
  /** CPF ou CNPJ do pagador */
  documento_pagador: string
  /** Forçar dados do pagador (opcional) */
  forcar_pagador?: boolean
  /** Email do pagador (opcional) */
  email_pagador?: string
  /** Celular do pagador (opcional) */
  celular?: string
  /** Descrição da cobrança (opcional) */
  descricao?: string
  /** URL do webhook para notificações (opcional) */
  webhook?: string
  /** ID mágico para identificação (opcional) */
  magic_id?: string
  /** Chave de API (opcional) */
  api_key?: string
  /** Divisão de valores entre usuários (opcional) */
  split_users?: SplitUser[]
}

export interface PixGenerateResponse {
  status: string
  message: string
  paymentCode: string
  idTransaction: string
  paymentCodeBase64: string
}

// ─── PIX Sacar (Cash-out) ───────────────────────────────────────────────────

export type TipoChave = 'CPF' | 'CNPJ' | 'PHONE' | 'EMAIL' | 'RANDOM'

export interface PixWithdrawRequest {
  /** Valor do saque em reais */
  valor: number
  /** Chave PIX de destino */
  chave_pix: string
  /** Tipo da chave PIX */
  tipo_chave: TipoChave
  /** CPF ou CNPJ do destinatário (opcional) */
  documento?: string
  /** URL do webhook para notificações (opcional) */
  webhook?: string
  /** ID mágico para identificação (opcional) */
  magic_id?: string
  /** Chave de API (opcional) */
  api_key?: string
}

export interface PixWithdrawResponse {
  status: string
  message: string
  internalreference: string
}

// ─── Balance ────────────────────────────────────────────────────────────────

export interface BalanceResponse {
  balance: number
  blocked: number
  available: number
}

// ─── Transactions ───────────────────────────────────────────────────────────

export interface GetTransactionParams {
  /** Tipo da transação */
  type: 'cash-in' | 'cash-out'
  /** ID da transação */
  txid: string
}

export interface TransactionResponse {
  idTransaction: string
  status: string
  amount: number
  paidAt?: string
  endToEnd?: string
  [key: string]: unknown
}

// ─── Webhook Events ─────────────────────────────────────────────────────────

export type CashInEventType =
  | 'QR_CODE_COPY_AND_PASTE_PAID'
  | 'QR_CODE_COPY_AND_PASTE_REFUNDED'

export type CashOutEventType =
  | 'PIX_CASHOUT_SUCCESS'
  | 'PIX_CASHOUT_ERROR'
  | 'PIX_CASHOUT_REFUNDED'

export type WebhookEventType = CashInEventType | CashOutEventType

export interface CashInWebhookData {
  amount: number
  status: string
  worked: boolean
  tag?: string
  tx_id: string
  end_to_end: string
  payment_date: string
  debtor_name: string
  debtor_document: string
  type_document: string
  magic_id?: string
  fee?: number
  [key: string]: unknown
}

export interface CashInWebhookEvent {
  type: CashInEventType
  data: CashInWebhookData
}

export interface CashOutWebhookEvent {
  type: CashOutEventType
  worked: boolean
  status: string
  idTransaction: string
  amount: number
  key: string
  end_to_end?: string
  payment_date?: string
  magic_id?: string
  fee?: number
  error?: string
  [key: string]: unknown
}

export type WebhookEvent = CashInWebhookEvent | CashOutWebhookEvent

// ─── Error ──────────────────────────────────────────────────────────────────

export interface NXGateErrorPayload {
  title?: string
  code?: string
  description?: string
}

// ─── Internal ───────────────────────────────────────────────────────────────

export interface RequestOptions {
  method: 'GET' | 'POST'
  path: string
  body?: Record<string, unknown>
  query?: Record<string, string>
  authenticate?: boolean
}
