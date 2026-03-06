export interface ClerkUser {
  id: string
  email: string
  firstName?: string
  lastName?: string
}

interface JWKKey {
  kid: string
  kty: string
  alg: string
  use: string
  n: string
  e: string
}

// Cache JWKS for 1 hour using a module-level variable (warm CF edge)
let jwksCache: { keys: JWKKey[]; fetchedAt: number } | null = null
const JWKS_TTL_MS = 60 * 60 * 1000

async function fetchJWKS(jwksUrl: string): Promise<JWKKey[]> {
  const now = Date.now()
  if (jwksCache && now - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys
  }
  const res = await fetch(jwksUrl, { cf: { cacheEverything: true, cacheTtl: 3600 } } as RequestInit)
  if (!res.ok) throw new Error(`Failed to fetch JWKS: ${res.status}`)
  const data = await res.json() as { keys: JWKKey[] }
  jwksCache = { keys: data.keys, fetchedAt: now }
  return data.keys
}

function base64UrlDecode(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, c => c.charCodeAt(0))
}

function parseJwtParts(token: string): { header: Record<string, string>; payload: Record<string, unknown>; signingInput: string; signature: Uint8Array } {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT format')
  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])))
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])))
  const signingInput = `${parts[0]}.${parts[1]}`
  const signature = base64UrlDecode(parts[2])
  return { header, payload, signingInput, signature }
}

export async function verifyClerkJWT(request: Request, env: { CLERK_JWKS_URL: string }): Promise<ClerkUser | null> {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return null
    const token = authHeader.slice(7)

    const { header, payload, signingInput, signature } = parseJwtParts(token)
    const kid = header.kid as string
    if (!kid) return null

    const keys = await fetchJWKS(env.CLERK_JWKS_URL)
    const jwk = keys.find(k => k.kid === kid)
    if (!jwk) return null

    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', use: 'sig' },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const data = new TextEncoder().encode(signingInput)
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, data)
    if (!valid) return null

    const now = Math.floor(Date.now() / 1000)
    if (typeof payload.exp === 'number' && payload.exp < now) return null

    const userId = payload.sub as string
    const email = (payload.email as string) || ''
    const firstName = payload.first_name as string | undefined
    const lastName = payload.last_name as string | undefined

    return { id: userId, email, firstName, lastName }
  } catch {
    return null
  }
}

export async function ensureUser(db: D1Database, clerk: ClerkUser): Promise<void> {
  await db.prepare(
    `INSERT INTO users (id, email, first_name, last_name, credits, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, 500, datetime('now'), datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       email = excluded.email,
       last_seen_at = datetime('now')`
  ).bind(clerk.id, clerk.email, clerk.firstName || null, clerk.lastName || null).run()
}
