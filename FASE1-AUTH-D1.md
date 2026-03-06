# Fase 1 — Auth & Cloud Sync (Clerk + Cloudflare D1)

# Patch: v3.0

# Read CLAUDE.md first. YOLO mode.

# After ALL tasks: npm run build && wrangler deploy && git push

-----

## ARCHITECTURE OVERVIEW

```
Browser (React)
  │── Clerk <SignIn> / <UserButton>   ← Email OTP + Google OAuth
  │── useAuth() → JWT token
  │
  ▼
Cloudflare Worker
  │── verifyClerkJWT(request)         ← validate token on every request
  │── extract userId from JWT
  │
  ▼
Cloudflare D1 (SQLite)
  ├── users            ← profile + preferences
  ├── api_keys         ← encrypted AWS/Dashscope keys
  ├── storyboards      ← saved projects
  ├── scenes           ← scene data + asset URLs
  └── usage_log        ← credit history
```

-----

## TASK 1 — Setup Clerk.dev

### 1A — Create Clerk application

Go to clerk.dev → Create application
Name: “Fuzzy Short”
Enable: Email (OTP) + Google OAuth
Disable: passwords (use OTP only)

From Clerk Dashboard, copy:

- Publishable Key: pk_live_xxx  → VITE_CLERK_PUBLISHABLE_KEY
- Secret Key: sk_live_xxx       → CLERK_SECRET_KEY (for Worker)
- JWT Public Key (JWKS URL)     → save for Worker verification

### 1B — Install Clerk in frontend

```bash
cd ~/Fuzzy-vid
npm install @clerk/clerk-react
```

### 1C — Add env vars

Create/update .env.local:

```
VITE_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_KEY_HERE
VITE_WORKER_URL=https://fuzzy-vid-worker.officialdian21.workers.dev
```

Add to .gitignore if not already:

```
.env.local
.env
```

### 1D — Add CLERK_SECRET_KEY to Worker

```bash
wrangler secret put CLERK_SECRET_KEY
# paste sk_live_xxx

wrangler secret put CLERK_JWKS_URL
# paste https://YOUR_CLERK_DOMAIN.clerk.accounts.dev/.well-known/jwks.json
```

-----

## TASK 2 — Setup Cloudflare D1

### 2A — Create D1 database

```bash
wrangler d1 create fuzzy-short-db
# Note the database_id from output
```

### 2B — Update wrangler.toml

Add D1 binding:

```toml
[[d1_databases]]
binding = "DB"
database_name = "fuzzy-short-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

### 2C — Create D1 schema

Create file: worker/migrations/001_init.sql

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,              -- Clerk user ID (user_xxx)
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  credits INTEGER NOT NULL DEFAULT 100,
  plan TEXT NOT NULL DEFAULT 'free', -- free | pro | enterprise
  preferences TEXT NOT NULL DEFAULT '{}', -- JSON: {language, art_style, default_image_model, default_video_model, default_brain_model}
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- API Keys table (encrypted)
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,   -- 'aws' | 'dashscope' | 'elevenlabs'
  key_name TEXT NOT NULL,   -- 'aws_access_key_id' | 'aws_secret_access_key' | 'dashscope_api_key' | etc
  encrypted_value TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, provider, key_name)
);

-- Storyboards table
CREATE TABLE IF NOT EXISTS storyboards (
  id TEXT PRIMARY KEY,              -- nanoid(8)
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  story TEXT,
  platform TEXT,
  language TEXT NOT NULL DEFAULT 'id',
  art_style TEXT,
  aspect_ratio TEXT NOT NULL DEFAULT '9_16',
  total_scenes INTEGER NOT NULL DEFAULT 5,
  brain_model TEXT,
  image_model TEXT,
  video_model TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | generating | complete
  is_public INTEGER NOT NULL DEFAULT 0,
  share_id TEXT UNIQUE,               -- for public sharing (future)
  scenes_data TEXT NOT NULL DEFAULT '[]', -- JSON array of scene objects from brain
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Scene Assets table
CREATE TABLE IF NOT EXISTS scene_assets (
  id TEXT PRIMARY KEY,
  storyboard_id TEXT NOT NULL REFERENCES storyboards(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  scene_number INTEGER NOT NULL,
  image_url TEXT,
  image_model TEXT,
  enhanced_prompt TEXT,
  video_url TEXT,
  video_model TEXT,
  video_prompt TEXT,          -- JSON: VideoPromptData
  custom_video_prompt TEXT,
  audio_url TEXT,
  audio_voice TEXT,
  audio_engine TEXT,
  custom_vo TEXT,
  duration_seconds INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(storyboard_id, scene_number)
);

-- Usage log table
CREATE TABLE IF NOT EXISTS usage_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storyboard_id TEXT,
  service TEXT NOT NULL,    -- 'image' | 'video' | 'audio' | 'brain' | 'enhance'
  model TEXT,
  credits_used INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success', -- success | error
  metadata TEXT,            -- JSON: {scene_number, aspect_ratio, duration, etc}
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_storyboards_user ON storyboards(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scene_assets_storyboard ON scene_assets(storyboard_id);
CREATE INDEX IF NOT EXISTS idx_usage_log_user ON usage_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
```

### 2D — Run migration

```bash
# Local development
wrangler d1 execute fuzzy-short-db --local --file=worker/migrations/001_init.sql

# Production
wrangler d1 execute fuzzy-short-db --file=worker/migrations/001_init.sql

# Verify tables created
wrangler d1 execute fuzzy-short-db --command="SELECT name FROM sqlite_master WHERE type='table'"
```

-----

## TASK 3 — Worker JWT Verification (worker/lib/auth.ts)

Create new file worker/lib/auth.ts:

```typescript
// worker/lib/auth.ts
// Verify Clerk JWT on every protected request

export interface ClerkUser {
  userId: string
  email: string
  sessionId: string
}

export async function verifyClerkJWT(
  request: Request,
  env: Env
): Promise<ClerkUser | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.slice(7)

  try {
    // Fetch JWKS (cached)
    const jwksUrl = env.CLERK_JWKS_URL
    const jwksRes = await fetch(jwksUrl, {
      cf: { cacheTtl: 3600 } // cache JWKS for 1 hour
    })
    const jwks = await jwksRes.json() as { keys: JsonWebKey[] }

    // Decode JWT header to get kid
    const [headerB64] = token.split('.')
    const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')))

    // Find matching key
    const jwk = jwks.keys.find((k: any) => k.kid === header.kid)
    if (!jwk) return null

    // Import key and verify
    const key = await crypto.subtle.importKey(
      'jwk', jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['verify']
    )

    const [, payloadB64, sigB64] = token.split('.')
    const sigBuffer = Uint8Array.from(
      atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    )
    const dataBuffer = new TextEncoder().encode(`${headerB64}.${payloadB64}`)

    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5', key, sigBuffer, dataBuffer
    )
    if (!valid) return null

    // Decode payload
    const payload = JSON.parse(
      atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    )

    // Check expiry
    if (payload.exp && payload.exp < Date.now() / 1000) return null

    return {
      userId: payload.sub,
      email: payload.email || '',
      sessionId: payload.sid || '',
    }
  } catch (e) {
    console.error('JWT verify error:', e)
    return null
  }
}

// Ensure user exists in D1, create if not
export async function ensureUser(
  db: D1Database,
  clerk: ClerkUser
): Promise<void> {
  await db.prepare(`
    INSERT INTO users (id, email, credits)
    VALUES (?, ?, 100)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      updated_at = unixepoch()
  `).bind(clerk.userId, clerk.email).run()
}
```

-----

## TASK 4 — Worker D1 Routes (worker/db.ts)

Create new file worker/db.ts:

```typescript
// worker/db.ts — all D1 database operations

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-AWS-Access-Key-Id, X-AWS-Secret-Access-Key, X-Brain-Region, X-Image-Region, X-Dashscope-Api-Key',
}

// ─── CREDIT COSTS ─────────────────────────────────────────────────
export const CREDIT_COSTS = {
  brain: 20,
  image: 10,
  video: 50,
  audio: 5,
  enhance: 2,
}

async function deductCredits(
  db: D1Database, userId: string,
  service: keyof typeof CREDIT_COSTS,
  storyboardId?: string,
  model?: string
): Promise<{ ok: boolean; remaining: number }> {
  const cost = CREDIT_COSTS[service]

  // Check balance
  const user = await db.prepare(
    'SELECT credits FROM users WHERE id = ?'
  ).bind(userId).first() as { credits: number } | null

  if (!user || user.credits < cost) {
    return { ok: false, remaining: user?.credits || 0 }
  }

  // Deduct + log in transaction
  await db.batch([
    db.prepare('UPDATE users SET credits = credits - ? WHERE id = ?')
      .bind(cost, userId),
    db.prepare(`INSERT INTO usage_log (id, user_id, storyboard_id, service, model, credits_used)
                VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), userId, storyboardId || null, service, model || null, cost),
  ])

  return { ok: true, remaining: user.credits - cost }
}

// ─── USER PROFILE ─────────────────────────────────────────────────
export async function handleGetProfile(userId: string, db: D1Database): Promise<Response> {
  const user = await db.prepare(
    'SELECT id, email, display_name, credits, plan, preferences, created_at FROM users WHERE id = ?'
  ).bind(userId).first()

  if (!user) return Response.json({ error: 'User not found' }, { status: 404, headers: corsHeaders })

  return Response.json({
    ...user,
    preferences: JSON.parse((user as any).preferences || '{}'),
  }, { headers: corsHeaders })
}

export async function handleUpdatePreferences(
  userId: string, db: D1Database, request: Request
): Promise<Response> {
  const body = await request.json() as Record<string, unknown>
  await db.prepare(
    'UPDATE users SET preferences = ?, updated_at = unixepoch() WHERE id = ?'
  ).bind(JSON.stringify(body), userId).run()
  return Response.json({ ok: true }, { headers: corsHeaders })
}

// ─── API KEYS (encrypted) ─────────────────────────────────────────
// Simple XOR encryption with CLERK_SECRET_KEY as seed
// In production consider using Cloudflare KV with encryption
async function encryptValue(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret.slice(0, 32).padEnd(32, '0')),
    { name: 'AES-GCM' }, false, ['encrypt']
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(value)
  )
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)
  return btoa(String.fromCharCode(...combined))
}

async function decryptValue(encrypted: string, secret: string): Promise<string> {
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret.slice(0, 32).padEnd(32, '0')),
    { name: 'AES-GCM' }, false, ['decrypt']
  )
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(decrypted)
}

export async function handleSaveApiKeys(
  userId: string, db: D1Database, request: Request, env: Env
): Promise<Response> {
  const body = await request.json() as Record<string, string>
  // body: { aws_access_key_id, aws_secret_access_key, dashscope_api_key, elevenlabs_api_key }

  const secret = env.CLERK_SECRET_KEY || 'fallback-secret-key-32-chars-pad'
  const ops = []

  for (const [keyName, value] of Object.entries(body)) {
    if (!value || value.trim() === '') continue
    const provider = keyName.startsWith('aws') ? 'aws'
      : keyName.startsWith('dashscope') ? 'dashscope'
      : keyName.startsWith('elevenlabs') ? 'elevenlabs' : 'other'

    const encrypted = await encryptValue(value, secret)
    ops.push(
      db.prepare(`
        INSERT INTO api_keys (id, user_id, provider, key_name, encrypted_value)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, provider, key_name) DO UPDATE SET
          encrypted_value = excluded.encrypted_value,
          updated_at = unixepoch()
      `).bind(crypto.randomUUID(), userId, provider, keyName, encrypted)
    )
  }

  if (ops.length > 0) await db.batch(ops)
  return Response.json({ ok: true, saved: ops.length }, { headers: corsHeaders })
}

export async function handleGetDecryptedApiKeys(
  userId: string, db: D1Database, env: Env
): Promise<Record<string, string>> {
  const rows = await db.prepare(
    'SELECT key_name, encrypted_value FROM api_keys WHERE user_id = ?'
  ).bind(userId).all()

  const secret = env.CLERK_SECRET_KEY || 'fallback-secret-key-32-chars-pad'
  const keys: Record<string, string> = {}

  for (const row of (rows.results || [])) {
    try {
      keys[(row as any).key_name] = await decryptValue(
        (row as any).encrypted_value, secret
      )
    } catch { /* skip corrupt key */ }
  }
  return keys
}

// ─── STORYBOARDS ──────────────────────────────────────────────────
export async function handleListStoryboards(
  userId: string, db: D1Database
): Promise<Response> {
  const rows = await db.prepare(`
    SELECT id, title, platform, language, art_style, aspect_ratio,
           total_scenes, status, created_at, updated_at
    FROM storyboards
    WHERE user_id = ?
    ORDER BY updated_at DESC
    LIMIT 50
  `).bind(userId).all()

  return Response.json({ storyboards: rows.results }, { headers: corsHeaders })
}

export async function handleSaveStoryboard(
  userId: string, db: D1Database, request: Request
): Promise<Response> {
  const body = await request.json() as {
    id?: string
    title: string
    story?: string
    platform?: string
    language?: string
    art_style?: string
    aspect_ratio?: string
    total_scenes?: number
    brain_model?: string
    image_model?: string
    video_model?: string
    scenes_data?: unknown[]
    status?: string
  }

  const id = body.id || crypto.randomUUID().slice(0, 8)

  await db.prepare(`
    INSERT INTO storyboards (
      id, user_id, title, story, platform, language, art_style, aspect_ratio,
      total_scenes, brain_model, image_model, video_model, scenes_data, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      scenes_data = excluded.scenes_data,
      status = excluded.status,
      image_model = excluded.image_model,
      video_model = excluded.video_model,
      updated_at = unixepoch()
  `).bind(
    id, userId,
    body.title, body.story || null,
    body.platform || null, body.language || 'id',
    body.art_style || null, body.aspect_ratio || '9_16',
    body.total_scenes || 5,
    body.brain_model || null, body.image_model || null, body.video_model || null,
    JSON.stringify(body.scenes_data || []),
    body.status || 'draft'
  ).run()

  return Response.json({ ok: true, id }, { headers: corsHeaders })
}

export async function handleGetStoryboard(
  userId: string, db: D1Database, storyboardId: string
): Promise<Response> {
  const row = await db.prepare(
    'SELECT * FROM storyboards WHERE id = ? AND user_id = ?'
  ).bind(storyboardId, userId).first()

  if (!row) return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders })

  const assets = await db.prepare(
    'SELECT * FROM scene_assets WHERE storyboard_id = ? ORDER BY scene_number'
  ).bind(storyboardId).all()

  return Response.json({
    ...(row as any),
    scenes_data: JSON.parse((row as any).scenes_data || '[]'),
    assets: assets.results,
  }, { headers: corsHeaders })
}

export async function handleDeleteStoryboard(
  userId: string, db: D1Database, storyboardId: string
): Promise<Response> {
  await db.prepare(
    'DELETE FROM storyboards WHERE id = ? AND user_id = ?'
  ).bind(storyboardId, userId).run()
  return Response.json({ ok: true }, { headers: corsHeaders })
}

// ─── SCENE ASSETS ─────────────────────────────────────────────────
export async function handleSaveSceneAsset(
  userId: string, db: D1Database, request: Request
): Promise<Response> {
  const body = await request.json() as {
    storyboard_id: string
    scene_number: number
    image_url?: string
    image_model?: string
    enhanced_prompt?: string
    video_url?: string
    video_model?: string
    video_prompt?: unknown
    custom_video_prompt?: string
    audio_url?: string
    audio_voice?: string
    audio_engine?: string
    custom_vo?: string
    duration_seconds?: number
  }

  await db.prepare(`
    INSERT INTO scene_assets (
      id, storyboard_id, user_id, scene_number,
      image_url, image_model, enhanced_prompt,
      video_url, video_model, video_prompt, custom_video_prompt,
      audio_url, audio_voice, audio_engine, custom_vo, duration_seconds
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(storyboard_id, scene_number) DO UPDATE SET
      image_url = COALESCE(excluded.image_url, image_url),
      image_model = COALESCE(excluded.image_model, image_model),
      enhanced_prompt = COALESCE(excluded.enhanced_prompt, enhanced_prompt),
      video_url = COALESCE(excluded.video_url, video_url),
      video_model = COALESCE(excluded.video_model, video_model),
      video_prompt = COALESCE(excluded.video_prompt, video_prompt),
      custom_video_prompt = COALESCE(excluded.custom_video_prompt, custom_video_prompt),
      audio_url = COALESCE(excluded.audio_url, audio_url),
      audio_voice = COALESCE(excluded.audio_voice, audio_voice),
      custom_vo = COALESCE(excluded.custom_vo, custom_vo),
      duration_seconds = COALESCE(excluded.duration_seconds, duration_seconds),
      updated_at = unixepoch()
  `).bind(
    crypto.randomUUID(), body.storyboard_id, userId, body.scene_number,
    body.image_url || null, body.image_model || null, body.enhanced_prompt || null,
    body.video_url || null, body.video_model || null,
    body.video_prompt ? JSON.stringify(body.video_prompt) : null,
    body.custom_video_prompt || null,
    body.audio_url || null, body.audio_voice || null,
    body.audio_engine || null, body.custom_vo || null,
    body.duration_seconds || null
  ).run()

  return Response.json({ ok: true }, { headers: corsHeaders })
}

// ─── USAGE & CREDITS ──────────────────────────────────────────────
export async function handleGetUsage(
  userId: string, db: D1Database
): Promise<Response> {
  const user = await db.prepare(
    'SELECT credits, plan FROM users WHERE id = ?'
  ).bind(userId).first() as { credits: number; plan: string } | null

  const history = await db.prepare(`
    SELECT service, model, credits_used, status, created_at
    FROM usage_log WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 50
  `).bind(userId).all()

  return Response.json({
    credits: user?.credits || 0,
    plan: user?.plan || 'free',
    history: history.results,
    costs: CREDIT_COSTS,
  }, { headers: corsHeaders })
}

export { deductCredits }
```

-----

## TASK 5 — Add D1 Routes to worker/index.ts

Read worker/index.ts completely.

Add Env type fields:

```typescript
// In the Env interface, add:
DB: D1Database
CLERK_SECRET_KEY: string
CLERK_JWKS_URL: string
```

Add auth middleware and D1 routes in the fetch handler:

```typescript
import { verifyClerkJWT, ensureUser } from './lib/auth'
import {
  handleGetProfile, handleUpdatePreferences,
  handleSaveApiKeys, handleGetDecryptedApiKeys,
  handleListStoryboards, handleSaveStoryboard,
  handleGetStoryboard, handleDeleteStoryboard,
  handleSaveSceneAsset, handleGetUsage,
  deductCredits, CREDIT_COSTS,
} from './db'

// Add auth check for /api/user/* and /api/storyboards/* routes
const isProtectedRoute = path.startsWith('/api/user') || path.startsWith('/api/storyboards')

let clerkUser = null
if (isProtectedRoute) {
  clerkUser = await verifyClerkJWT(request, env)
  if (!clerkUser) {
    return Response.json({ error: 'Unauthorized' }, {
      status: 401,
      headers: { 'Access-Control-Allow-Origin': '*' }
    })
  }
  await ensureUser(env.DB, clerkUser)
}

// User profile
if (path === '/api/user/profile' && method === 'GET') {
  return handleGetProfile(clerkUser!.userId, env.DB)
}
if (path === '/api/user/preferences' && method === 'POST') {
  return handleUpdatePreferences(clerkUser!.userId, env.DB, request)
}

// API Keys
if (path === '/api/user/keys' && method === 'POST') {
  return handleSaveApiKeys(clerkUser!.userId, env.DB, request, env)
}
if (path === '/api/user/keys' && method === 'GET') {
  const keys = await handleGetDecryptedApiKeys(clerkUser!.userId, env.DB, env)
  return Response.json(keys, { headers: { 'Access-Control-Allow-Origin': '*' } })
}

// Storyboards CRUD
if (path === '/api/storyboards' && method === 'GET') {
  return handleListStoryboards(clerkUser!.userId, env.DB)
}
if (path === '/api/storyboards' && method === 'POST') {
  return handleSaveStoryboard(clerkUser!.userId, env.DB, request)
}
if (path.match(/^\/api\/storyboards\/[\w-]+$/) && method === 'GET') {
  const id = path.split('/').pop()!
  return handleGetStoryboard(clerkUser!.userId, env.DB, id)
}
if (path.match(/^\/api\/storyboards\/[\w-]+$/) && method === 'DELETE') {
  const id = path.split('/').pop()!
  return handleDeleteStoryboard(clerkUser!.userId, env.DB, id)
}

// Scene assets
if (path === '/api/storyboards/assets' && method === 'POST') {
  return handleSaveSceneAsset(clerkUser!.userId, env.DB, request)
}

// Credits & usage
if (path === '/api/user/usage' && method === 'GET') {
  return handleGetUsage(clerkUser!.userId, env.DB)
}
```

Also: for generation routes (/api/brain/generate, /api/image/generate, etc.)
check if user is authenticated and deduct credits:

```typescript
// In /api/brain/generate handler, AFTER successful generation:
if (clerkUser && env.DB) {
  const { ok } = await deductCredits(env.DB, clerkUser.userId, 'brain', body.project_id)
  if (!ok) return Response.json({ error: 'Insufficient credits' }, { status: 402 })
}
```

-----

## TASK 6 — Update CORS allowlist in worker/index.ts

Add Authorization to allowed headers:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': [
    'Content-Type',
    'Authorization',                  // ← ADD for Clerk JWT
    'X-AWS-Access-Key-Id',
    'X-AWS-Secret-Access-Key',
    'X-Brain-Region',
    'X-Image-Region',
    'X-Dashscope-Api-Key',
  ].join(', '),
}
```

-----

## TASK 7 — Frontend: Add Clerk Provider to main.tsx

Read src/main.tsx.

```typescript
import { ClerkProvider } from '@clerk/clerk-react'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  </React.StrictMode>
)
```

-----

## TASK 8 — Create src/pages/Auth.tsx (Sign In page)

```typescript
// src/pages/Auth.tsx
import { SignIn, SignUp } from '@clerk/clerk-react'
import { useState } from 'react'

export default function Auth() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(145deg, #f2f2f7 0%, #e5e5ea 50%, #f2f2f7 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      {/* Logo + tagline */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎬</div>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#1d1d1f', margin: 0 }}>
          Fuzzy Short
        </h1>
        <p style={{ color: 'rgba(60,60,67,0.6)', fontSize: '14px', marginTop: '6px' }}>
          AI-powered short video storyboard creator
        </p>
      </div>

      {/* Clerk component — auto-styled */}
      <div style={{
        background: 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(40px)',
        borderRadius: '24px',
        padding: '4px',
        border: '0.5px solid rgba(255,255,255,0.9)',
        boxShadow: '0 4px 40px rgba(0,0,0,0.08)',
      }}>
        {mode === 'sign-in' ? (
          <SignIn
            appearance={{ variables: { colorPrimary: '#ff6b35' } }}
            afterSignInUrl="/"
          />
        ) : (
          <SignUp
            appearance={{ variables: { colorPrimary: '#ff6b35' } }}
            afterSignUpUrl="/"
          />
        )}
      </div>

      {/* Toggle */}
      <button
        onClick={() => setMode(m => m === 'sign-in' ? 'sign-up' : 'sign-in')}
        style={{
          marginTop: '16px', background: 'none', border: 'none',
          color: '#007aff', fontSize: '14px', cursor: 'pointer',
        }}
      >
        {mode === 'sign-in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
      </button>
    </div>
  )
}
```

-----

## TASK 9 — Add Auth Guard to App.tsx

Read src/App.tsx.

```typescript
import { useAuth, useUser } from '@clerk/clerk-react'
import Auth from './pages/Auth'

function App() {
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()

  // Loading state
  if (!isLoaded) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(145deg, #f2f2f7 0%, #e5e5ea 50%, #f2f2f7 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎬</div>
          <div style={{ color: 'rgba(60,60,67,0.5)', fontSize: '13px' }}>Loading...</div>
        </div>
      </div>
    )
  }

  // Not signed in → show auth page
  if (!isSignedIn) {
    return <Auth />
  }

  // Signed in → show app
  return (
    // existing Router/Routes JSX
    <Router>
      <Routes>
        {/* existing routes */}
      </Routes>
    </Router>
  )
}
```

-----

## TASK 10 — Create src/lib/userApi.ts (D1 API calls)

```typescript
// src/lib/userApi.ts
import { useAuth } from '@clerk/clerk-react'

const WORKER_URL = import.meta.env.VITE_WORKER_URL

async function authFetch(token: string, path: string, options?: RequestInit) {
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`)
  return res.json()
}

export function useUserApi() {
  const { getToken } = useAuth()

  const getAuthToken = async () => {
    const token = await getToken()
    if (!token) throw new Error('Not authenticated')
    return token
  }

  return {
    // Profile
    getProfile: async () => authFetch(await getAuthToken(), '/api/user/profile'),
    updatePreferences: async (prefs: Record<string, unknown>) =>
      authFetch(await getAuthToken(), '/api/user/preferences', {
        method: 'POST', body: JSON.stringify(prefs)
      }),

    // API Keys
    saveApiKeys: async (keys: Record<string, string>) =>
      authFetch(await getAuthToken(), '/api/user/keys', {
        method: 'POST', body: JSON.stringify(keys)
      }),
    getApiKeys: async () => authFetch(await getAuthToken(), '/api/user/keys'),

    // Storyboards
    listStoryboards: async () => authFetch(await getAuthToken(), '/api/storyboards'),
    saveStoryboard: async (data: Record<string, unknown>) =>
      authFetch(await getAuthToken(), '/api/storyboards', {
        method: 'POST', body: JSON.stringify(data)
      }),
    getStoryboard: async (id: string) =>
      authFetch(await getAuthToken(), `/api/storyboards/${id}`),
    deleteStoryboard: async (id: string) =>
      authFetch(await getAuthToken(), `/api/storyboards/${id}`, { method: 'DELETE' }),
    saveSceneAsset: async (data: Record<string, unknown>) =>
      authFetch(await getAuthToken(), '/api/storyboards/assets', {
        method: 'POST', body: JSON.stringify(data)
      }),

    // Usage
    getUsage: async () => authFetch(await getAuthToken(), '/api/user/usage'),
  }
}
```

-----

## TASK 11 — Update Settings.tsx — API Keys from D1

In src/pages/Settings.tsx:

```typescript
import { useUserApi } from '../lib/userApi'
import { useUser } from '@clerk/clerk-react'

const { user } = useUser()
const { saveApiKeys, getApiKeys, updatePreferences } = useUserApi()

// On mount: load keys from D1 (not localStorage)
useEffect(() => {
  getApiKeys().then(keys => {
    setSettings(prev => ({ ...prev, ...keys }))
  }).catch(() => {
    // Fallback to localStorage for unauthenticated
    const saved = localStorage.getItem('fuzzy_short_settings')
    if (saved) setSettings(JSON.parse(saved))
  })
}, [])

// On save: save to D1 AND localStorage (for offline)
const handleSave = async () => {
  try {
    await saveApiKeys({
      aws_access_key_id: settings.awsAccessKeyId,
      aws_secret_access_key: settings.awsSecretAccessKey,
      dashscope_api_key: settings.dashscopeApiKey,
      elevenlabs_api_key: settings.elevenLabsApiKey || '',
    })
    await updatePreferences({
      language: settings.language,
      art_style: settings.artStyle,
      default_image_model: settings.defaultImageModel,
      default_video_model: settings.defaultVideoModel,
    })
    localStorage.setItem('fuzzy_short_settings', JSON.stringify(settings))
    showToast('Settings saved to cloud ☁️')
  } catch (e) {
    localStorage.setItem('fuzzy_short_settings', JSON.stringify(settings))
    showToast('Saved locally (offline mode)')
  }
}
```

Add UserButton from Clerk in header:

```typescript
import { UserButton } from '@clerk/clerk-react'

// In Settings header or top nav:
<UserButton afterSignOutUrl="/auth" />
```

-----

## TASK 12 — Auto-save Storyboard to D1 after brain generation

In src/pages/Home.tsx, after successful brain generation:

```typescript
import { useUserApi } from '../lib/userApi'
const { saveStoryboard } = useUserApi()

// After brain response:
const storyboardId = result.id || crypto.randomUUID().slice(0, 8)
const enriched = {
  ...result,
  id: storyboardId,
  selected_image_model: imageModel,
  selected_video_model: videoModel,
}
sessionStorage.setItem('storyboard_result', JSON.stringify(enriched))

// Auto-save to D1 (non-blocking)
saveStoryboard({
  id: storyboardId,
  title,
  story,
  platform,
  language,
  art_style: artStyle,
  aspect_ratio: aspectRatio,
  total_scenes: scenes,
  brain_model: brainModel,
  image_model: imageModel,
  video_model: videoModel,
  scenes_data: result.scenes,
  status: 'draft',
}).catch(console.error) // non-blocking, don't block navigation

navigate(`/storyboard?id=${storyboardId}`)
```

-----

## TASK 13 — Auto-save Asset to D1 after each generation

In Storyboard.tsx, after each successful asset generation,
call saveSceneAsset (non-blocking):

```typescript
import { useUserApi } from '../lib/userApi'
const { saveSceneAsset } = useUserApi()

// After image generated:
saveSceneAsset({
  storyboard_id: projectId,
  scene_number: sceneNum,
  image_url: result.image_url,
  image_model: currentImageModel,
  enhanced_prompt: enhanced_prompt,
}).catch(console.error)

// After video generated:
saveSceneAsset({
  storyboard_id: projectId,
  scene_number: sceneNum,
  video_url: result.video_url,
  video_model: currentVideoModel,
  video_prompt: assets[sceneNum]?.videoPrompt,
  custom_video_prompt: assets[sceneNum]?.customVideoPrompt,
}).catch(console.error)

// After audio generated:
saveSceneAsset({
  storyboard_id: projectId,
  scene_number: sceneNum,
  audio_url: result.audio_url,
  audio_voice: selectedVoice,
  custom_vo: customVO[sceneNum],
}).catch(console.error)
```

-----

## TASK 14 — Create src/pages/Dashboard.tsx (saved projects)

Simple dashboard showing saved storyboards:

```typescript
// src/pages/Dashboard.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserApi } from '../lib/userApi'
import { UserButton } from '@clerk/clerk-react'

export default function Dashboard() {
  const { listStoryboards, getUsage, deleteStoryboard } = useUserApi()
  const navigate = useNavigate()
  const [storyboards, setStoryboards] = useState<any[]>([])
  const [usage, setUsage] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([listStoryboards(), getUsage()])
      .then(([sb, u]) => {
        setStoryboards(sb.storyboards || [])
        setUsage(u)
      })
      .finally(() => setLoading(false))
  }, [])

  // Glass card style
  const card = {
    background: 'rgba(255,255,255,0.75)',
    backdropFilter: 'blur(40px)',
    WebkitBackdropFilter: 'blur(40px)',
    border: '0.5px solid rgba(255,255,255,0.9)',
    borderRadius: '18px',
    padding: '16px',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(145deg, #f2f2f7 0%, #e5e5ea 50%, #f2f2f7 100%)',
      padding: '20px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#1d1d1f' }}>My Projects</h1>
          <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'rgba(60,60,67,0.5)' }}>
            {storyboards.length} storyboards saved
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Credits badge */}
          {usage && (
            <div style={{
              background: 'rgba(52,199,89,0.1)', border: '0.5px solid rgba(52,199,89,0.3)',
              borderRadius: '10px', padding: '6px 12px',
              color: '#34c759', fontSize: '12px', fontWeight: 700,
            }}>
              ⚡ {usage.credits} credits
            </div>
          )}
          <UserButton afterSignOutUrl="/auth" />
        </div>
      </div>

      {/* New project button */}
      <button
        onClick={() => navigate('/')}
        style={{
          width: '100%', padding: '14px',
          background: 'linear-gradient(135deg, #ff6b35, #ff4500)',
          border: 'none', borderRadius: '16px',
          color: 'white', fontSize: '15px', fontWeight: 700,
          cursor: 'pointer', marginBottom: '16px',
          boxShadow: '0 4px 20px rgba(255,107,53,0.35)',
        }}
      >
        + New Storyboard
      </button>

      {/* Storyboard list */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'rgba(60,60,67,0.4)', padding: '40px' }}>
          Loading projects...
        </div>
      ) : storyboards.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎬</div>
          <p style={{ color: 'rgba(60,60,67,0.5)', margin: 0 }}>No projects yet. Create your first storyboard!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {storyboards.map((sb: any) => (
            <div key={sb.id} style={{ ...card, display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: 'rgba(255,107,53,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <span style={{ fontSize: '20px' }}>🎬</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }} onClick={() => navigate(`/storyboard?id=${sb.id}`)}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#1d1d1f' }}>{sb.title}</div>
                <div style={{ fontSize: '11px', color: 'rgba(60,60,67,0.5)', marginTop: '2px' }}>
                  {sb.total_scenes} scenes · {sb.platform} · {sb.language === 'id' ? '🇮🇩' : '🇺🇸'}
                  {' · '}{new Date((sb.updated_at as number) * 1000).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => deleteStoryboard(sb.id).then(() =>
                  setStoryboards(prev => prev.filter(s => s.id !== sb.id))
                )}
                style={{
                  padding: '6px 10px', borderRadius: '10px',
                  border: '0.5px solid rgba(255,59,48,0.3)',
                  background: 'rgba(255,59,48,0.08)',
                  color: '#ff3b30', fontSize: '11px', cursor: 'pointer',
                }}
              >🗑️</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

Add route in App.tsx:

```typescript
<Route path="/dashboard" element={<Dashboard />} />
<Route path="/auth" element={<Auth />} />
```

-----

## TASK 15 — Update PATCHLOG.md + CLAUDE.md + GEMINI.md

Add to PATCHLOG.md:

```markdown
## v3.0 — 2026-03-06

**Feat: Auth & Cloud Sync (Clerk + Cloudflare D1)**

- Clerk.dev: Email OTP + Google OAuth
- D1 tables: users, api_keys (AES-GCM encrypted), storyboards, scene_assets, usage_log
- JWT verification via JWKS in Cloudflare Worker edge
- Auto-save storyboard to D1 after brain generation
- Auto-save assets after image/video/audio generation
- API keys encrypted at rest (AES-GCM, 32-byte key from CLERK_SECRET_KEY)
- Dashboard page: list saved projects, credits balance, delete
- useUserApi() hook for all D1 operations
- Credit system: brain 20, image 10, video 50, audio 5, enhance 2
- Preferences synced to cloud (language, art style, default models)
- New Worker secrets: CLERK_SECRET_KEY, CLERK_JWKS_URL
- New routes: /api/user/*, /api/storyboards/*, /api/storyboards/assets
```

Add to CLAUDE.md WORKER ROUTES:

```
GET  /api/user/profile
POST /api/user/preferences
GET  /api/user/keys            ← returns decrypted keys
POST /api/user/keys            ← saves encrypted keys
GET  /api/user/usage
GET  /api/storyboards
POST /api/storyboards
GET  /api/storyboards/:id
DELETE /api/storyboards/:id
POST /api/storyboards/assets
```

Add to CLAUDE.md WORKER SECRETS:

```
CLERK_SECRET_KEY    ← from Clerk dashboard
CLERK_JWKS_URL      ← https://YOUR_DOMAIN.clerk.accounts.dev/.well-known/jwks.json
```

-----

## TASK 16 — Build, Deploy, Test

```bash
npx tsc --noEmit 2>&1 | head -20
npm run build 2>&1 | tail -20

wrangler deploy

# Test auth protection
curl https://fuzzy-vid-worker.officialdian21.workers.dev/api/user/profile
# Expected: {"error":"Unauthorized"} (401)

# Verify D1 tables
wrangler d1 execute fuzzy-short-db --command="SELECT name FROM sqlite_master WHERE type='table'"
# Expected: users, api_keys, storyboards, scene_assets, usage_log

git add .
git commit -m "feat(v3.0): Clerk auth + Cloudflare D1 cloud sync + dashboard"
git push origin main
```