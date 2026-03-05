// worker/dashscope.ts
// Dashscope Singapore — Brain, Image, Video
// Auth: Bearer token only, no AWS Signature

import { buildBrainPrompts } from './brain'
import type { Env, Credentials } from './index'

const DASHSCOPE_BASE = 'https://dashscope-intl.aliyuncs.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-AWS-Access-Key-Id, X-AWS-Secret-Access-Key, X-Brain-Region, X-Image-Region, X-Dashscope-Api-Key',
}

// ─── BRAIN (Qwen text generation) ─────────────────────────────────
export const QWEN_BRAIN_MODELS = [
  { id: 'qwen3-max', label: 'Qwen3 Max', tag: 'Qwen', desc: 'Best quality + reasoning', badge: '⭐ Best' },
  { id: 'qwen-plus', label: 'Qwen Plus', tag: 'Qwen', desc: 'Balanced quality + speed', badge: '⚡ Recommended' },
  { id: 'qwen-flash', label: 'Qwen Flash', tag: 'Qwen', desc: 'Fast & efficient', badge: '🚀 Fast' },
  { id: 'qwen-turbo', label: 'Qwen Turbo', tag: 'Qwen', desc: 'Cheapest option', badge: '💰 Budget' },
  { id: 'qwq-plus', label: 'QwQ Plus', tag: 'Qwen', desc: 'Deep reasoning model', badge: '🧠 Reasoning' },
]

export async function handleDashscopeBrain(
  request: Request,
  _env: Env,
  creds: Credentials
): Promise<Response> {
  const apiKey = creds.dashscopeApiKey
  if (!apiKey) {
    return Response.json(
      { error: 'Dashscope API key not configured. Add it in Settings.' },
      { status: 401, headers: corsHeaders }
    )
  }

  const body = await request.json() as Record<string, unknown>
  const model = (body.brain_model as string) || 'qwen-plus'
  // Map brain_model names from frontend (underscores → dashes)
  const modelMap: Record<string, string> = {
    'qwen3_max':  'qwen3-max',
    'qwen_plus':  'qwen-plus',
    'qwen_flash': 'qwen-flash',
    'qwen_turbo': 'qwen-turbo',
    'qwq_plus':   'qwq-plus',
  }
  const actualModel = modelMap[model] || model

  const endpoint = `${DASHSCOPE_BASE}/compatible-mode/v1/chat/completions`

  const { systemPrompt, userPrompt } = buildBrainPrompts(body)

  const payload = JSON.stringify({
    model: actualModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 4000,
    temperature: 0.7,
  })

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: payload,
  })

  if (!res.ok) {
    const err = await res.text()
    return Response.json(
      { error: `Qwen Brain failed: ${err}` },
      { status: res.status, headers: corsHeaders }
    )
  }

  const data = await res.json() as { choices: [{ message: { content: string } }] }
  const content = data.choices[0].message.content.trim()
    .replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/```$/, '').trim()

  try {
    const parsed = JSON.parse(content)
    return Response.json(parsed, { headers: corsHeaders })
  } catch {
    return Response.json({ error: 'Failed to parse Qwen JSON', raw: content }, { status: 500, headers: corsHeaders })
  }
}

// ─── IMAGE GENERATION (Wanx / Wan models) ─────────────────────────
export const QWEN_IMAGE_MODELS = [
  { id: 'wanx2.1-t2i-turbo', label: 'Wanx 2.1 Turbo', tag: 'Qwen', desc: 'Fast generation',  badge: '⚡ Fast' },
  { id: 'wanx2.1-t2i-plus',  label: 'Wanx 2.1 Plus',  tag: 'Qwen', desc: 'Best quality',      badge: '⭐ Best' },
  { id: 'wan2.6-image',       label: 'Wan 2.6',         tag: 'Qwen', desc: 'Latest model',      badge: '🆕 Latest' },
]

function getWanxSize(aspectRatio: string): string {
  const map: Record<string, string> = {
    '9_16': '768*1280',
    '16_9': '1280*768',
    '1_1':  '1024*1024',
    '4_5':  '864*1080',
  }
  return map[aspectRatio] || '768*1280'
}

export async function handleDashscopeImageStart(
  request: Request,
  _env: Env,
  creds: Credentials
): Promise<Response> {
  const apiKey = creds.dashscopeApiKey
  if (!apiKey) {
    return Response.json({ error: 'Dashscope API key missing' }, { status: 401, headers: corsHeaders })
  }

  const body = await request.json() as {
    prompt: string
    image_model: string
    aspect_ratio: string
    scene_number: number
    project_id: string
    negative_prompt?: string
  }

  const endpoint = `${DASHSCOPE_BASE}/api/v1/services/aigc/text2image/image-synthesis`
  const size = getWanxSize(body.aspect_ratio)
  const isWan26 = (body.image_model || '') === 'wan2.6-image'

  const inputPayload = isWan26
    ? { messages: [{ role: 'user', content: [{ text: body.prompt }] }] }
    : { prompt: body.prompt }

  const payload = JSON.stringify({
    model: body.image_model || 'wanx2.1-t2i-turbo',
    input: inputPayload,
    parameters: {
      size,
      n: 1,
      negative_prompt: body.negative_prompt || 'blurry, low quality, distorted, watermark, text, ugly, deformed',
      prompt_extend: true,
      watermark: false,
    },
  })

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-DashScope-Async': 'enable',
    },
    body: payload,
  })

  if (!res.ok) {
    const err = await res.text()
    return Response.json({ error: `Image task failed: ${err}` }, { status: res.status, headers: corsHeaders })
  }

  const data = await res.json() as { output: { task_id: string; task_status: string } }
  return Response.json({
    task_id: data.output.task_id,
    status: 'processing',
    provider: 'dashscope',
  }, { headers: corsHeaders })
}

// ─── TASK STATUS POLL (shared for image and video) ─────────────────
export async function handleDashscopeTaskStatus(
  _request: Request,
  env: Env,
  taskId: string,
  creds: Credentials
): Promise<Response> {
  const apiKey = creds.dashscopeApiKey
  if (!apiKey) {
    return Response.json({ error: 'Dashscope API key missing' }, { status: 401, headers: corsHeaders })
  }

  const endpoint = `${DASHSCOPE_BASE}/api/v1/tasks/${taskId}`

  const res = await fetch(endpoint, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })

  if (!res.ok) {
    return Response.json({ status: 'error', message: `Poll failed: ${res.status}` }, { headers: corsHeaders })
  }

  const data = await res.json() as {
    output: {
      task_status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'
      results?: Array<{ url: string }>
      video_url?: string
      message?: string
    }
  }

  const status = data.output.task_status

  if (status === 'PENDING' || status === 'RUNNING') {
    return Response.json({ status: 'processing' }, { headers: corsHeaders })
  }

  if (status === 'FAILED') {
    return Response.json({
      status: 'error',
      message: data.output.message || 'Task failed',
    }, { headers: corsHeaders })
  }

  // SUCCEEDED — extract URL
  const imageUrl = data.output.results?.[0]?.url
  const videoUrl = data.output.video_url || imageUrl

  if (!imageUrl && !videoUrl) {
    return Response.json({ status: 'error', message: 'No output URL' }, { headers: corsHeaders })
  }

  const outputUrl = imageUrl || videoUrl!
  const isVideo = !!data.output.video_url || outputUrl.includes('.mp4')
  const ext = isVideo ? 'mp4' : 'jpg'

  try {
    const r2Url = await downloadAndUploadToR2(outputUrl, ext, env)
    return Response.json({
      status: 'done',
      url: r2Url,
      type: isVideo ? 'video' : 'image',
    }, { headers: corsHeaders })
  } catch (err) {
    // Fallback: return the original Dashscope URL if R2 upload fails
    return Response.json({
      status: 'done',
      url: outputUrl,
      type: isVideo ? 'video' : 'image',
    }, { headers: corsHeaders })
  }
}

async function downloadAndUploadToR2(sourceUrl: string, ext: string, env: Env): Promise<string> {
  const res = await fetch(sourceUrl)
  if (!res.ok) throw new Error(`Failed to download from Dashscope: ${res.status}`)

  const buffer = await res.arrayBuffer()
  const fileName = `dashscope/${Date.now()}_output.${ext}`
  const contentType = ext === 'mp4' ? 'video/mp4' : 'image/jpeg'
  const bucket = env.R2_BUCKET_NAME || 'igome-story-storage'
  const r2Endpoint = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}/${fileName}`

  const { signRequest } = await import('./lib/aws-signature')
  const r2Headers = await signRequest({
    method: 'PUT',
    url: r2Endpoint,
    region: 'auto',
    service: 's3',
    accessKeyId: env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: env.R2_SECRET_ACCESS_KEY || '',
    body: buffer,
    headers: { 'Content-Type': contentType },
  })

  const r2Res = await fetch(r2Endpoint, { method: 'PUT', headers: r2Headers, body: buffer })
  if (!r2Res.ok) throw new Error('R2 upload failed')

  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}/${fileName}`
}

// ─── VIDEO GENERATION (Wan2.1 i2v / t2v) ──────────────────────────
export const QWEN_VIDEO_MODELS = [
  { id: 'wan2.1-i2v-plus',  label: 'Wan2.1 I2V Plus',  tag: 'Qwen', desc: 'Image→Video best quality', badge: '⭐ Best' },
  { id: 'wan2.1-i2v-turbo', label: 'Wan2.1 I2V Turbo', tag: 'Qwen', desc: 'Image→Video fast',         badge: '⚡ Fast' },
  { id: 'wan2.1-t2v-plus',  label: 'Wan2.1 T2V Plus',  tag: 'Qwen', desc: 'Text→Video best quality',  badge: '📝 Text→Video' },
  { id: 'wan2.1-t2v-turbo', label: 'Wan2.1 T2V Turbo', tag: 'Qwen', desc: 'Text→Video fast',          badge: '📝⚡ T2V Fast' },
]

function getWanVideoSize(aspectRatio: string): string {
  const map: Record<string, string> = {
    '9_16': '720*1280',
    '16_9': '1280*720',
    '1_1':  '960*960',
    '4_5':  '864*1080',
  }
  return map[aspectRatio] || '720*1280'
}

export async function handleDashscopeVideoStart(
  request: Request,
  _env: Env,
  creds: Credentials
): Promise<Response> {
  const apiKey = creds.dashscopeApiKey
  if (!apiKey) {
    return Response.json({ error: 'Dashscope API key missing' }, { status: 401, headers: corsHeaders })
  }

  const body = await request.json() as {
    prompt: string
    image_url?: string
    video_model: string
    aspect_ratio: string
    duration_seconds: number
    scene_number: number
    project_id: string
    prompt_extend?: boolean
  }

  const isImageToVideo = (body.video_model || '').includes('i2v')
  const endpoint = `${DASHSCOPE_BASE}/api/v1/services/aigc/video-generation/video-synthesis`
  const size = getWanVideoSize(body.aspect_ratio)
  const duration = Math.max(3, Math.min(5, body.duration_seconds || 5)) // Wan supports 3-5s

  const input: Record<string, unknown> = {
    prompt: body.prompt,
  }

  if (isImageToVideo && body.image_url && body.image_url.trim() !== '') {
    input.img_url = body.image_url
  }

  const payload = JSON.stringify({
    model: body.video_model || 'wan2.1-i2v-plus',
    input,
    parameters: {
      size,
      duration,
      prompt_extend: body.prompt_extend !== false,
    },
  })

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-DashScope-Async': 'enable',
    },
    body: payload,
  })

  if (!res.ok) {
    const err = await res.text()
    return Response.json({ error: `Video task failed: ${err}` }, { status: res.status, headers: corsHeaders })
  }

  const data = await res.json() as { output: { task_id: string } }
  return Response.json({
    task_id: data.output.task_id,
    job_id: data.output.task_id,
    status: 'processing',
    provider: 'dashscope',
  }, { headers: corsHeaders })
}
