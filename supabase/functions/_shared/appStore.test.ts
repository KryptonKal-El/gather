import { assertEquals, assertThrows } from 'jsr:@std/assert@1'
import { buildSubscriptionRow, decodeJwsPayload, type TransactionInfo } from './appStore.ts'

const toJws = (payload: unknown) => {
  const encode = (value: unknown) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${encode({ alg: 'ES256' })}.${encode(payload)}.sig`
}

const transaction: TransactionInfo = {
  originalTransactionId: '2000000123456789',
  bundleId: 'com.gatherlists',
  productId: 'gather_pro_annual',
  expiresDate: Date.UTC(2027, 0, 1),
  inAppOwnershipType: 'PURCHASED',
  environment: 'Sandbox',
}

Deno.test('decodeJwsPayload reads a base64url payload', () => {
  assertEquals(decodeJwsPayload(toJws({ name: 'Crème brûlée ??>>' })), { name: 'Crème brûlée ??>>' })
})

Deno.test('decodeJwsPayload rejects strings that are not a JWS', () => {
  assertThrows(() => decodeJwsPayload('not-a-jws'), Error, 'Malformed JWS')
  assertThrows(() => decodeJwsPayload('a.%%%.c'), Error, 'Malformed JWS')
})

Deno.test('buildSubscriptionRow maps an active subscription', () => {
  const row = buildSubscriptionRow(1, transaction, { autoRenewStatus: 1 })

  assertEquals(row.status, 'active')
  assertEquals(row.external_id, '2000000123456789')
  assertEquals(row.product_id, 'gather_pro_annual')
  assertEquals(row.expires_at, '2027-01-01T00:00:00.000Z')
  assertEquals(row.revoked_at, null)
  assertEquals(row.auto_renew, true)
  assertEquals(row.environment, 'Sandbox')
})

Deno.test('buildSubscriptionRow extends access through a billing grace period', () => {
  const row = buildSubscriptionRow(4, transaction, {
    autoRenewStatus: 1,
    gracePeriodExpiresDate: Date.UTC(2027, 0, 17),
  })

  assertEquals(row.status, 'grace_period')
  assertEquals(row.expires_at, '2027-01-17T00:00:00.000Z')
})

Deno.test('buildSubscriptionRow records a refund as revoked', () => {
  const row = buildSubscriptionRow(5, { ...transaction, revocationDate: Date.UTC(2026, 11, 1) }, null)

  assertEquals(row.status, 'revoked')
  assertEquals(row.revoked_at, '2026-12-01T00:00:00.000Z')
  assertEquals(row.auto_renew, null)
})

Deno.test('buildSubscriptionRow rejects an unknown status code', () => {
  assertThrows(() => buildSubscriptionRow(9, transaction, null), Error, 'Unknown App Store subscription status 9')
})
