// worker/glm.ts
// ZhipuAI GLM — Image (CogView-4) and Video (CogVideoX-2)
// API docs: https://open.bigmodel.cn/api/paas/v4
// Auth: Bearer token (same API key as GLM brain)

import type { Env, Credentials } from './index'

const GLM_BASE = 'https://open.bigmodel.cn/api/paas/v4'

const cors = { 'Access-Control-Allow-Origin': '*' }

function getGlmImageSize(aspectRatio: string): string {
  const map: Record<string, string> = {
    '9_16': '768x1344',
    '16_9': '1344x768',
    '1_1':  '1024x1024',
    '4_5':  '864x1152',
  }
  return map[aspectRatio] || '768x1344'
}

function getGlmVideoSize(aspectRatio: string): string {
  const map: Record<string, string> = {
    '9_16': '720x1280',
    '16_9': '1280x720',
    '1_1':  '960x960',
    '4_5':  '864x1152',
  }
  return map[aspectRatio] || '720x1280'
}

// ─── IMAGE GENERATION (CogView-4 — synchronous) ─────────────────────────────
// POST /images/generations → { data: [{ url, revised_prompt }] }

export async function handleGlmImageGenerate(
  request: Request,
  env: Env,
  creds: Credentials
): Promise<Response> {
  const apiKey = creds.glmApiKey
  if (!apiKey) {
    return Response.json(
      { error: 'GLM API key required. Add it in Settings.' },
      { status: 401, headers: cors }
    )
  }

  const body = await request.json() as {
    prompt: string
    image_model: string
    aspect_ratio: string
    scene_number: number
    project_id: string
  }

  const size = getGlmImageSize(body.aspect_ratio)
  const model = body.image_model || 'cogview-4'

  const res = await fetch(`${GLM_BASE}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, prompt: body.prompt, size }),
  })

  if (!res.ok) {
    const err = await res.text()
    return Response.json(
      { error: `CogView error: ${err.slice(0, 200)}` },
      { status: res.status, headers: cors }
    )
  }

  const data = await res.json() as { data: Array<{ url: string; revised_prompt?: string }> }
  const imageUrl = data.data?.[0]?.url
  if (!imageUrl) {
    return Response.json({ error: 'No image URL returned from CogView' }, { status: 502, headers: cors })
  }

  // Download and re-upload to R2 (GLM URLs expire)
  try {
    const r2Url = await downloadAndUploadToR2(imageUrl, 'jpg', env)
    return Response.json({ image_url: r2Url }, { headers: cors })
  } catch {
    // Fallback: return direct GLM URL
    return Response.json({ image_url: imageUrl }, { headers: cors })
  }
}

// ─── VIDEO GENERATION (CogVideoX-2 — async) ─────────────────────────────────
// POST /videos/generations → { id, task_status: "PROCESSING" }

export async function handleGlmVideoStart(
  request: Request,
  _env: Env,
  creds: Credentials
): Promise<Response> {
  const apiKey = creds.glmApiKey
  if (!apiKey) {
    return Response.json(
      { error: 'GLM API key required. Add it in Settings.' },
      { status: 401, headers: cors }
    )
  }

  const body = await request.json() as {
    prompt: string
    image_url?: string
    video_model: string
    aspect_ratio: string
    duration_seconds: number
    scene_number: number
    project_id: string
  }

  const model = body.video_model || 'cogvideox-2'
  const size = getGlmVideoSize(body.aspect_ratio)
  // CogVideoX-2 supports 5 or 10 seconds
  const duration = body.duration_seconds >= 8 ? 10 : 5

  const payload: Record<string, unknown> = {
    model,
    prompt: body.prompt,
    size,
    duration,
  }
  // Only add image_url for i2v requests
  if (body.image_url && body.image_url.trim()) {
    payload.image_url = body.image_url.trim()
  }

  const res = await fetch(`${GLM_BASE}/videos/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.text()
    return Response.json(
      { error: `CogVideoX error: ${err.slice(0, 200)}` },
      { status: res.status, headers: cors }
    )
  }

  const data = await res.json() as { id: string; task_status: string }
  return Response.json({
    task_id: data.id,
    status: 'processing',
    provider: 'glm',
  }, { headers: cors })
}

// ─── VIDEO STATUS POLL ────────────────────────────────────────────────────────
// GET /async-result/{task_id}
// → { task_status: "SUCCESS"|"PROCESSING"|"FAIL", video_result: [{ url, cover_image_url }] }

export async function handleGlmVideoStatus(
  _request: Request,
  env: Env,
  taskId: string,
  creds: Credentials
): Promise<Response> {
  const apiKey = creds.glmApiKey
  if (!apiKey) {
    return Response.json({ error: 'GLM API key required' }, { status: 401, headers: cors })
  }

  const res = await fetch(`${GLM_BASE}/async-result/${taskId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })

  if (!res.ok) {
    return Response.json(
      { status: 'error', message: `Poll failed: ${res.status}` },
      { headers: cors }
    )
  }

  const data = await res.json() as {
    id: string
    task_status: 'SUCCESS' | 'PROCESSING' | 'FAIL'
    video_result?: Array<{ url: string; cover_image_url?: string }>
  }

  if (data.task_status === 'PROCESSING') {
    return Response.json({ status: 'processing' }, { headers: cors })
  }

  if (data.task_status === 'FAIL') {
    return Response.json({ status: 'error', message: 'CogVideoX task failed' }, { headers: cors })
  }

  // SUCCESS
  const videoUrl = data.video_result?.[0]?.url
  if (!videoUrl) {
    return Response.json({ status: 'error', message: 'No video URL in result' }, { headers: cors })
  }

  try {
    const r2Url = await downloadAndUploadToR2(videoUrl, 'mp4', env)
    return Response.json({ status: 'done', url: r2Url, type: 'video' }, { headers: cors })
  } catch {
    // Fallback: return direct GLM URL
    return Response.json({ status: 'done', url: videoUrl, type: 'video' }, { headers: cors })
  }
}

// ─── Shared R2 upload helper ─────────────────────────────────────────────────

const WORKER_URL = 'https://fuzzy-vid-worker.officialdian21.workers.dev'

async function downloadAndUploadToR2(sourceUrl: string, ext: string, env: Env): Promise<string> {
  const res = await fetch(sourceUrl)
  if (!res.ok) throw new Error(`Failed to download from GLM: ${res.status}`)

  const fileName = `glm/${Date.now()}_output.${ext}`
  const contentType = ext === 'mp4' ? 'video/mp4' : 'image/jpeg'

  await env.STORY_STORAGE.put(fileName, res.body, {
    httpMetadata: { contentType },
  })

  return `${WORKER_URL}/api/storage/file/${fileName}`
}
