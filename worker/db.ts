import type { ClerkUser } from './lib/auth'

export const CREDIT_COSTS = {
  brain: 20,
  image: 10,
  video: 50,
  audio: 5,
  enhance: 2,
} as const

// ─── Encryption helpers ────────────────────────────────────────────────────

async function deriveKey(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function encryptValue(value: string, secret: string): Promise<{ encrypted: string; iv: string }> {
  const key = await deriveKey(secret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(value)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const toB64 = (buf: ArrayBuffer | Uint8Array) =>
    btoa(String.fromCharCode(...new Uint8Array(buf instanceof ArrayBuffer ? buf : buf)))
  return { encrypted: toB64(ciphertext), iv: toB64(iv) }
}

export async function decryptValue(encrypted: string, iv: string, secret: string): Promise<string> {
  const key = await deriveKey(secret)
  const fromB64 = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(iv) },
    key,
    fromB64(encrypted)
  )
  return new TextDecoder().decode(decrypted)
}

// ─── Credits ──────────────────────────────────────────────────────────────

export async function deductCredits(
  db: D1Database,
  userId: string,
  service: keyof typeof CREDIT_COSTS,
  storyboardId?: string,
  model?: string
): Promise<{ ok: boolean; remaining?: number; error?: string }> {
  const cost = CREDIT_COSTS[service]
  const user = await db.prepare('SELECT credits FROM users WHERE id = ?').bind(userId).first<{ credits: number }>()
  if (!user) return { ok: false, error: 'User not found' }
  if (user.credits < cost) return { ok: false, error: 'Insufficient credits', remaining: user.credits }

  await db.batch([
    db.prepare('UPDATE users SET credits = credits - ? WHERE id = ?').bind(cost, userId),
    db.prepare(
      'INSERT INTO usage_log (user_id, service, model, storyboard_id, credits_used) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, service, model || null, storyboardId || null, cost),
  ])

  const updated = await db.prepare('SELECT credits FROM users WHERE id = ?').bind(userId).first<{ credits: number }>()
  return { ok: true, remaining: updated?.credits ?? 0 }
}

// ─── User profile ─────────────────────────────────────────────────────────

export async function handleGetProfile(db: D1Database, user: ClerkUser): Promise<Response> {
  const row = await db.prepare(
    'SELECT id, email, first_name, last_name, credits, preferences, created_at FROM users WHERE id = ?'
  ).bind(user.id).first()
  if (!row) return Response.json({ error: 'User not found' }, { status: 404 })
  return Response.json(row)
}

export async function handleUpdatePreferences(
  db: D1Database,
  user: ClerkUser,
  request: Request
): Promise<Response> {
  const body = await request.json() as Record<string, unknown>
  await db.prepare(
    'UPDATE users SET preferences = ? WHERE id = ?'
  ).bind(JSON.stringify(body), user.id).run()
  return Response.json({ ok: true })
}

// ─── API Keys ─────────────────────────────────────────────────────────────

export async function handleSaveApiKeys(
  db: D1Database,
  user: ClerkUser,
  request: Request,
  secret: string
): Promise<Response> {
  const body = await request.json() as Record<string, unknown>
  const { encrypted, iv } = await encryptValue(JSON.stringify(body), secret)
  await db.prepare(
    `INSERT INTO api_keys (user_id, encrypted_data, iv, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       encrypted_data = excluded.encrypted_data,
       iv = excluded.iv,
       updated_at = datetime('now')`
  ).bind(user.id, encrypted, iv).run()
  return Response.json({ ok: true })
}

export async function handleGetDecryptedApiKeys(
  db: D1Database,
  user: ClerkUser,
  secret: string
): Promise<Response> {
  const row = await db.prepare('SELECT encrypted_data, iv FROM api_keys WHERE user_id = ?')
    .bind(user.id).first<{ encrypted_data: string; iv: string }>()
  if (!row) return Response.json({})
  try {
    const decrypted = await decryptValue(row.encrypted_data, row.iv, secret)
    return Response.json(JSON.parse(decrypted))
  } catch {
    return Response.json({ error: 'Failed to decrypt' }, { status: 500 })
  }
}

// ─── Storyboards ──────────────────────────────────────────────────────────

export async function handleListStoryboards(db: D1Database, user: ClerkUser): Promise<Response> {
  const rows = await db.prepare(
    `SELECT id, title, platform, language, art_style, aspect_ratio, total_scenes,
            brain_model, image_model, video_model, status, created_at, updated_at
     FROM storyboards WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50`
  ).bind(user.id).all()
  return Response.json(rows.results)
}

export async function handleSaveStoryboard(
  db: D1Database,
  user: ClerkUser,
  request: Request
): Promise<Response> {
  const body = await request.json() as Record<string, unknown>
  const id = body.id as string
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  await db.prepare(
    `INSERT INTO storyboards (id, user_id, title, story, platform, language, art_style,
       aspect_ratio, total_scenes, brain_model, image_model, video_model, scenes_data, status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       story = excluded.story,
       status = excluded.status,
       scenes_data = excluded.scenes_data,
       updated_at = datetime('now')`
  ).bind(
    id, user.id,
    (body.title as string) || 'Untitled',
    (body.story as string) || null,
    (body.platform as string) || null,
    (body.language as string) || 'id',
    (body.art_style as string) || null,
    (body.aspect_ratio as string) || '9_16',
    (body.total_scenes as number) || 5,
    (body.brain_model as string) || null,
    (body.image_model as string) || null,
    (body.video_model as string) || null,
    body.scenes_data ? JSON.stringify(body.scenes_data) : null,
    (body.status as string) || 'draft',
  ).run()

  return Response.json({ ok: true, id })
}

export async function handleGetStoryboard(
  db: D1Database,
  user: ClerkUser,
  id: string
): Promise<Response> {
  const row = await db.prepare(
    'SELECT * FROM storyboards WHERE id = ? AND user_id = ?'
  ).bind(id, user.id).first()
  if (!row) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(row)
}

export async function handleDeleteStoryboard(
  db: D1Database,
  user: ClerkUser,
  id: string
): Promise<Response> {
  await db.prepare('DELETE FROM storyboards WHERE id = ? AND user_id = ?').bind(id, user.id).run()
  return Response.json({ ok: true })
}

// ─── Scene Assets ─────────────────────────────────────────────────────────

export async function handleSaveSceneAsset(
  db: D1Database,
  user: ClerkUser,
  request: Request
): Promise<Response> {
  const body = await request.json() as Record<string, unknown>
  const storyboardId = body.storyboard_id as string
  const sceneNumber = body.scene_number as number
  if (!storyboardId || sceneNumber == null) {
    return Response.json({ error: 'storyboard_id and scene_number required' }, { status: 400 })
  }

  await db.prepare(
    `INSERT INTO scene_assets
       (user_id, storyboard_id, scene_number,
        image_url, image_model, enhanced_prompt,
        video_url, video_model, video_prompt, custom_video_prompt,
        audio_url, audio_voice, custom_vo, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(storyboard_id, scene_number) DO UPDATE SET
       image_url         = COALESCE(excluded.image_url, image_url),
       image_model       = COALESCE(excluded.image_model, image_model),
       enhanced_prompt   = COALESCE(excluded.enhanced_prompt, enhanced_prompt),
       video_url         = COALESCE(excluded.video_url, video_url),
       video_model       = COALESCE(excluded.video_model, video_model),
       video_prompt      = COALESCE(excluded.video_prompt, video_prompt),
       custom_video_prompt = COALESCE(excluded.custom_video_prompt, custom_video_prompt),
       audio_url         = COALESCE(excluded.audio_url, audio_url),
       audio_voice       = COALESCE(excluded.audio_voice, audio_voice),
       custom_vo         = COALESCE(excluded.custom_vo, custom_vo),
       updated_at        = datetime('now')`
  ).bind(
    user.id, storyboardId, sceneNumber,
    (body.image_url as string) || null,
    (body.image_model as string) || null,
    (body.enhanced_prompt as string) || null,
    (body.video_url as string) || null,
    (body.video_model as string) || null,
    body.video_prompt ? JSON.stringify(body.video_prompt) : null,
    (body.custom_video_prompt as string) || null,
    (body.audio_url as string) || null,
    (body.audio_voice as string) || null,
    (body.custom_vo as string) || null,
  ).run()

  return Response.json({ ok: true })
}

// ─── Usage ────────────────────────────────────────────────────────────────

export async function handleGetUsage(db: D1Database, user: ClerkUser): Promise<Response> {
  const [userRow, usageSummary, recentLog] = await Promise.all([
    db.prepare('SELECT credits FROM users WHERE id = ?').bind(user.id).first<{ credits: number }>(),
    db.prepare(
      `SELECT service, SUM(credits_used) as total FROM usage_log WHERE user_id = ? GROUP BY service`
    ).bind(user.id).all(),
    db.prepare(
      `SELECT service, model, credits_used, created_at FROM usage_log
       WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`
    ).bind(user.id).all(),
  ])
  return Response.json({
    credits: userRow?.credits ?? 0,
    summary: usageSummary.results,
    recent: recentLog.results,
  })
}
