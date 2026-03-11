# @nxgate/sdk

SDK oficial da NXGATE para integração PIX em Node.js/TypeScript.

## Recursos

- **TypeScript-first** com suporte completo a JavaScript
- **Zero dependências** - usa `fetch` e `crypto` nativos do Node.js 18+
- **Gerenciamento automático de tokens** - cache com renovação antes da expiração
- **Assinatura HMAC automática** - quando `hmacSecret` é fornecido
- **Parser de webhooks** com type guards tipados
- **Erros tipados** - `NXGateError` com código, título, descrição e status HTTP
- **Retry automático** em erros 503 com backoff exponencial
- **Dual build** - CJS + ESM

## Instalação

```bash
npm install @nxgate/sdk
```

## Requisitos

- Node.js 18 ou superior

## Uso

### Configuração

```typescript
import { NXGate } from '@nxgate/sdk'

const nx = new NXGate({
  clientId: 'nxgate_xxx',
  clientSecret: 'seu_secret',
  hmacSecret: 'seu_hmac_secret', // opcional
})
```

### Gerar Cobrança PIX (Cash-in)

```typescript
const cobranca = await nx.pixGenerate({
  valor: 100.00,
  nome_pagador: 'João da Silva',
  documento_pagador: '12345678901',
  descricao: 'Pagamento do pedido #123',
  webhook: 'https://meusite.com/webhook',
})

console.log(cobranca.paymentCode)       // Código PIX copia e cola
console.log(cobranca.paymentCodeBase64) // QR Code em base64
console.log(cobranca.idTransaction)     // ID da transação
```

### Saque PIX (Cash-out)

```typescript
const saque = await nx.pixWithdraw({
  valor: 50.00,
  chave_pix: 'joao@email.com',
  tipo_chave: 'EMAIL',
  webhook: 'https://meusite.com/webhook',
})

console.log(saque.internalreference) // Referência interna
```

### Consultar Saldo

```typescript
const saldo = await nx.getBalance()

console.log(saldo.balance)   // Saldo total
console.log(saldo.blocked)   // Saldo bloqueado
console.log(saldo.available) // Saldo disponível
```

### Consultar Transação

```typescript
const tx = await nx.getTransaction({
  type: 'cash-in',
  txid: 'px_xxx',
})

console.log(tx.status)     // Status da transação
console.log(tx.amount)     // Valor
console.log(tx.paidAt)     // Data do pagamento
console.log(tx.endToEnd)   // Identificador end-to-end
```

### Webhook

```typescript
import { NXGateWebhook } from '@nxgate/sdk'

// No handler do seu webhook (Express, Fastify, etc.)
app.post('/webhook', (req, res) => {
  const event = NXGateWebhook.parse(req.body)

  if (NXGateWebhook.isCashIn(event)) {
    // Evento de pagamento recebido (cash-in)
    if (NXGateWebhook.isPaid(event)) {
      console.log('Pagamento confirmado:', event.data.amount)
      console.log('Pagador:', event.data.debtor_name)
      console.log('End-to-end:', event.data.end_to_end)
    }

    if (NXGateWebhook.isRefunded(event)) {
      console.log('Pagamento estornado:', event.data.tx_id)
    }
  }

  if (NXGateWebhook.isCashOut(event)) {
    // Evento de saque (cash-out)
    if (NXGateWebhook.isCashOutSuccess(event)) {
      console.log('Saque realizado:', event.amount)
    }

    if (NXGateWebhook.isCashOutError(event)) {
      console.log('Erro no saque:', event.error)
    }
  }

  res.sendStatus(200)
})
```

### Tipos de Chave PIX

| Tipo     | Descrição                    |
|----------|------------------------------|
| `CPF`    | CPF do destinatário          |
| `CNPJ`   | CNPJ do destinatário         |
| `EMAIL`  | E-mail do destinatário       |
| `PHONE`  | Telefone do destinatário     |
| `RANDOM` | Chave aleatória              |

### Split de Pagamentos

```typescript
const cobranca = await nx.pixGenerate({
  valor: 100.00,
  nome_pagador: 'João da Silva',
  documento_pagador: '12345678901',
  split_users: [
    { username: 'loja1', percentage: 70 },
    { username: 'loja2', percentage: 30 },
  ],
})
```

## Tratamento de Erros

```typescript
import { NXGate, NXGateError } from '@nxgate/sdk'

try {
  await nx.pixGenerate({ ... })
} catch (err) {
  if (err instanceof NXGateError) {
    console.error('Código:', err.code)
    console.error('Título:', err.title)
    console.error('Descrição:', err.description)
    console.error('Status HTTP:', err.status)
  }
}
```

## Assinatura HMAC

Quando `hmacSecret` é fornecido na configuração, todas as requisições incluem automaticamente os headers de assinatura HMAC-SHA256:

- `X-Client-ID` - Identificador do cliente
- `X-HMAC-Signature` - Assinatura HMAC-SHA256 em base64
- `X-HMAC-Timestamp` - Timestamp ISO 8601
- `X-HMAC-Nonce` - Identificador único por requisição

A assinatura é gerada sobre o payload: `METHOD\nPATH\nTIMESTAMP\nNONCE\nBODY`

## Configuração Avançada

```typescript
const nx = new NXGate({
  clientId: 'nxgate_xxx',
  clientSecret: 'secret',
  hmacSecret: 'hmac_secret',       // opcional
  baseUrl: 'https://api.nxgate.com.br', // padrão
  timeout: 30000,                  // 30s, padrão
  maxRetries: 2,                   // tentativas em 503, padrão
})
```

## Eventos de Webhook

### Cash-in (Pagamento)

| Tipo                                | Descrição              |
|-------------------------------------|------------------------|
| `QR_CODE_COPY_AND_PASTE_PAID`      | Pagamento confirmado   |
| `QR_CODE_COPY_AND_PASTE_REFUNDED`  | Pagamento estornado    |

### Cash-out (Saque)

| Tipo                     | Descrição         |
|--------------------------|-------------------|
| `PIX_CASHOUT_SUCCESS`   | Saque realizado   |
| `PIX_CASHOUT_ERROR`     | Erro no saque     |
| `PIX_CASHOUT_REFUNDED`  | Saque estornado   |

## Licença

MIT
