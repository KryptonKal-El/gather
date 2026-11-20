/**
 * Sign in with Apple token revocation.
 *
 * Apple asks apps to revoke a user's Sign in with Apple tokens when their
 * account is deleted. The app supplies a fresh authorization code; it is
 * exchanged for a refresh token, which is then revoked.
 */

const APPLE_ID_HOST = 'https://appleid.apple.com'
const CLIENT_ID = 'com.gatherlists'
const CLIENT_SECRET_LIFETIME_SECONDS = 300

function base64UrlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToDer(pem: string): Uint8Array {
  const base64 = pem.split('\n').filter(line => !line.startsWith('-----')).join('')
  return Uint8Array.from(atob(base64), char => char.charCodeAt(0))
}

function buildClientSecretClaims(teamId: string, nowSeconds: number) {
  return {
    iss: teamId,
    iat: nowSeconds,
    exp: nowSeconds + CLIENT_SECRET_LIFETIME_SECONDS,
    aud: APPLE_ID_HOST,
    sub: CLIENT_ID,
  }
}

/**
 * Signs a client secret with the Sign in with Apple key. A dedicated key is
 * used when configured; otherwise the push key, which works only if Sign in
 * with Apple is enabled on it in the developer portal.
 */
async function createClientSecret(): Promise<string> {
  const keyId = Deno.env.get('APPLE_SIGNIN_KEY_ID') ?? Deno.env.get('APNS_KEY_ID')
  const privateKeyBase64 = Deno.env.get('APPLE_SIGNIN_PRIVATE_KEY') ?? Deno.env.get('APNS_PRIVATE_KEY')
  const teamId = Deno.env.get('APNS_TEAM_ID')
  if (!keyId || !privateKeyBase64 || !teamId) {
    throw new Error('Sign in with Apple revocation is not configured: missing key id, private key or team id')
  }

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(atob(privateKeyBase64)),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  const encode = (value: unknown) => base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)))
  const claims = buildClientSecretClaims(teamId, Math.floor(Date.now() / 1000))
  const signingInput = `${encode({ alg: 'ES256', kid: keyId })}.${encode(claims)}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput)
  )
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`
}

async function postForm(path: string, fields: Record<string, string>): Promise<Response> {
  return await fetch(`${APPLE_ID_HOST}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  })
}

/**
 * Revokes the Sign in with Apple tokens behind an authorization code.
 * @param authorizationCode - A fresh code from ASAuthorizationAppleIDCredential
 * @throws {Error} When Apple rejects the client secret, the code or the revocation
 */
export async function revokeAppleSignIn(authorizationCode: string): Promise<void> {
  const clientSecret = await createClientSecret()

  const tokenResponse = await postForm('/auth/token', {
    client_id: CLIENT_ID,
    client_secret: clientSecret,
    code: authorizationCode,
    grant_type: 'authorization_code',
  })
  const tokenBody = await tokenResponse.json().catch(() => ({}))
  if (!tokenResponse.ok || !tokenBody.refresh_token) {
    throw new Error(`Apple refused the authorization code: ${tokenResponse.status} ${tokenBody.error ?? 'no refresh token'}`)
  }

  const revokeResponse = await postForm('/auth/revoke', {
    client_id: CLIENT_ID,
    client_secret: clientSecret,
    token: tokenBody.refresh_token,
    token_type_hint: 'refresh_token',
  })
  if (!revokeResponse.ok) {
    throw new Error(`Apple refused the revocation: ${revokeResponse.status}`)
  }
}
