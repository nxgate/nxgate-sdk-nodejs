import { createHmac, randomUUID } from 'node:crypto'

export interface HmacHeaders {
  'X-Client-ID': string
  'X-HMAC-Signature': string
  'X-HMAC-Timestamp': string
  'X-HMAC-Nonce': string
}

/**
 * Responsável por gerar assinaturas HMAC-SHA256 para requisições à API NXGATE.
 *
 * Quando um hmacSecret é configurado, todas as requisições devem incluir
 * os headers HMAC para autenticação.
 */
export class HmacSigner {
  private readonly secret: string
  private readonly clientId: string

  constructor(clientId: string, secret: string) {
    this.clientId = clientId
    this.secret = secret
  }

  /**
   * Gera os headers HMAC para uma requisição.
   *
   * @param method - Método HTTP (GET, POST, etc.)
   * @param path - Caminho da requisição (ex: /pix/gerar)
   * @param body - Corpo da requisição serializado como string (vazio para GET)
   * @returns Objeto com os 4 headers HMAC necessários
   */
  sign(method: string, path: string, body: string): HmacHeaders {
    const timestamp = new Date().toISOString()
    const nonce = randomUUID()

    const payload = `${method}\n${path}\n${timestamp}\n${nonce}\n${body}`

    const signature = createHmac('sha256', this.secret)
      .update(payload, 'utf8')
      .digest('base64')

    return {
      'X-Client-ID': this.clientId,
      'X-HMAC-Signature': signature,
      'X-HMAC-Timestamp': timestamp,
      'X-HMAC-Nonce': nonce,
    }
  }
}
