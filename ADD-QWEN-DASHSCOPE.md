# Add Qwen Dashscope Singapore — Brain + Image + Video

# Read CLAUDE.md first. YOLO mode.

# After ALL tasks: npm run build && wrangler deploy && git push

-----

## ARCHITECTURE OVERVIEW

Dashscope Singapore endpoint: dashscope-intl.aliyuncs.com
Auth: Bearer token ONLY — NO AWS Signature needed!
Worker secret key: DASHSCOPE_API_KEY

All 3 services use same API key, no region confusion.

Brain  → POST /compatible-mode/v1/chat/completions (OpenAI-compatible)
Image  → POST /api/v1/services/aigc/text2image/image-synthesis (async, poll task_id)
Video  → POST /api/v1/services/aigc/video-generation/video-synthesis (async, poll task_id)
Poll   → GET  /api/v1/tasks/{task_id}

-----

## TASK 1 — Add DASHSCOPE_API_KEY to Worker Secrets

Run in terminal:
wrangler secret put DASHSCOPE_API_KEY

# Paste your Dashscope Singapore API key when prompted

Verify: wrangler secret list

# Must show DASHSCOPE_API_KEY in list

-----

## TASK 2 — Add Dashscope credential to worker/index.ts

In the creds extraction section, add:
const dashscopeKey = request.headers.get(‘X-Dashscope-Api-Key’) || env.DASHSCOPE_API_KEY || ‘’

Add to creds object:
const creds = {
awsAccessKeyId: …,
awsSecretAccessKey: …,
brainRegion: …,
imageRegion: …,
dashscopeApiKey: dashscopeKey,  // ADD THIS
}

Add dashscopeApiKey to Credentials type in worker/types.ts (or wherever Credentials is defined).

-----

## TASK 3 — Add DASHSCOPE_API_KEY to src/lib/api.ts getApiHeaders()

In getApiHeaders(), read from settings and add header:
const settings = JSON.parse(localStorage.getItem(‘fuzzy_short_settings’) || ‘{}’)

return {
‘X-AWS-Access-Key-Id’: settings.awsAccessKeyId || ‘’,
‘X-AWS-Secret-Access-Key’: settings.awsSecretAccessKey || ‘’,
‘X-Brain-Region’: settings.brainRegion || ‘us-east-1’,
‘X-Image-Region’: settings.imageRegion || ‘us-east-1’,
‘X-Dashscope-Api-Key’: settings.dashscopeApiKey || ‘’,  // ADD THIS
}

-----

## TASK 4 — Add Dashscope API key field to Settings page

In src/pages/Settings.tsx, add a new field in the API Keys section:

Label: “Dashscope API Key (Singapore)”
Placeholder: “sk-…”
Type: password (toggle show/hide like other keys)
Storage key: ‘dashscopeApiKey’ in fuzzy_short_settings localStorage

Add help text below field:
“Alibaba Cloud Model Studio • Singapore Region
Get your key at: alibabacloud.com/help/en/model-studio/get-api-key”

-----

## TASK 5 — Create worker/dashscope.ts (new file)

Create this complete new file:

```typescript
// worker/dashscope.ts
// Dashscope Singapore — Brain, Image, Video
// Auth: Bearer token only, no AWS Signature

const DASHSCOPE_BASE = 'https://dashscope-intl.aliyuncs.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-AWS-Access-Key-Id, X-AWS-Secret-Access-Key, X-Brain-Region, X-Image-Region, X-Dashscope-Api-Key',
}

// ─── BRAIN (Qwen text generation) ─────────────────────────────────
// Models available via Dashscope Singapore OpenAI-compatible API:
export const QWEN_BRAIN_MODELS = [
  { id: 'qwen3-max', label: 'Qwen3 Max', tag: 'Qwen', desc: 'Best quality + reasoning', badge: '⭐ Best' },
  { id: 'qwen-plus', label: 'Qwen Plus', tag: 'Qwen', desc: 'Balanced quality + speed', badge: '⚡ Recommended' },
  { id: 'qwen-flash', label: 'Qwen Flash', tag: 'Qwen', desc: 'Fast & efficient', badge: '🚀 Fast' },
  { id: 'qwen-turbo', label: 'Qwen Turbo', tag: 'Qwen', desc: 'Cheapest option', badge: '💰 Budget' },
  { id: 'qwq-plus', label: 'QwQ Plus', tag: 'Qwen', desc: 'Deep reasoning model', badge: '🧠 Reasoning' },
]

export async function handleDashscopeBrain(
  request: Request,
  env: Env,
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
  // Map brain_model names from frontend
  const modelMap: Record<string, string> = {
    'qwen3_max': 'qwen3-max',
    'qwen_plus': 'qwen-plus',
    'qwen_flash': 'qwen-flash',
    'qwen_turbo': 'qwen-turbo',
    'qwq_plus': 'qwq-plus',
  }
  const actualModel = modelMap[model] || model

  // Build same brain prompt as worker/brain.ts
  // Read the system prompt and user prompt building logic from worker/brain.ts
  // and copy/import it here for Qwen models
  // The JSON output format is identical

  const endpoint = `${DASHSCOPE_BASE}/compatible-mode/v1/chat/completions`

  // Get the prompts from brain.ts helper (extract buildBrainPrompts to a shared util)
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
// All image models available via Dashscope Singapore:
export const QWEN_IMAGE_MODELS = [
  { id: 'wanx2.1-t2i-plus', label: 'Wanx 2.1 Plus', tag: 'Qwen', desc: 'Best quality image', badge: '⭐ Best' },
  { id: 'wanx2.1-t2i-turbo', label: 'Wanx 2.1 Turbo', tag: 'Qwen', desc: 'Fast generation', badge: '⚡ Fast' },
  { id: 'wan2.6-image', label: 'Wan 2.6', tag: 'Qwen', desc: 'Latest model, image+edit', badge: '🆕 Latest' },
  { id: 'wanx-v1', label: 'Wanx v1', tag: 'Qwen', desc: 'Classic stable model', badge: '🎨 Classic' },
]

function getWanxSize(aspectRatio: string): string {
  const map: Record<string, string> = {
    '9_16': '768*1280',
    '16_9': '1280*768',
    '1_1': '1024*1024',
    '4_5': '864*1080',
  }
  return map[aspectRatio] || '768*1280'
}

export async function handleDashscopeImageStart(
  request: Request,
  env: Env,
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

  const payload = JSON.stringify({
    model: body.image_model || 'wanx2.1-t2i-plus',
    input: {
      prompt: body.prompt,
      negative_prompt: body.negative_prompt || 'blurry, low quality, distorted, watermark, text, ugly, deformed',
    },
    parameters: {
      size,
      n: 1,
      prompt_extend: true,   // auto-enhance prompt
      watermark: false,
    },
  })

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-DashScope-Async': 'enable',  // async task
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

// Poll image/video task status — shared for both image and video
export async function handleDashscopeTaskStatus(
  request: Request,
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

  // Upload to R2 for permanent storage (Dashscope URLs expire in 24h)
  const outputUrl = imageUrl || videoUrl!
  const isVideo = !!data.output.video_url || outputUrl.includes('.mp4')
  const ext = isVideo ? 'mp4' : 'jpg'
  const r2Url = await downloadAndUploadToR2(outputUrl, ext, env)

  return Response.json({
    status: 'done',
    url: r2Url,
    type: isVideo ? 'video' : 'image',
  }, { headers: corsHeaders })
}

async function downloadAndUploadToR2(sourceUrl: string, ext: string, env: Env): Promise<string> {
  const res = await fetch(sourceUrl)
  if (!res.ok) throw new Error(`Failed to download from Dashscope: ${res.status}`)

  const buffer = await res.arrayBuffer()
  const fileName = `dashscope/${Date.now()}_output.${ext}`
  const contentType = ext === 'mp4' ? 'video/mp4' : 'image/jpeg'

  const r2Endpoint = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME || 'igome-story-storage'}/${fileName}`

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

  return `${env.R2_PUBLIC_URL || ''}/${fileName}`
}

// ─── VIDEO GENERATION (Wan2.1 i2v) ────────────────────────────────
// All video models available via Dashscope Singapore:
export const QWEN_VIDEO_MODELS = [
  { id: 'wan2.1-i2v-plus', label: 'Wan2.1 I2V Plus', tag: 'Qwen', desc: 'Image-to-video, best quality', badge: '⭐ Best' },
  { id: 'wan2.1-i2v-turbo', label: 'Wan2.1 I2V Turbo', tag: 'Qwen', desc: 'Image-to-video, fast', badge: '⚡ Fast' },
  { id: 'wan2.1-t2v-plus', label: 'Wan2.1 T2V Plus', tag: 'Qwen', desc: 'Text-to-video, best quality', badge: '📝 Text→Video' },
  { id: 'wan2.1-t2v-turbo', label: 'Wan2.1 T2V Turbo', tag: 'Qwen', desc: 'Text-to-video, fast', badge: '📝⚡ T2V Fast' },
]

function getWanVideoSize(aspectRatio: string): string {
  const map: Record<string, string> = {
    '9_16': '720*1280',
    '16_9': '1280*720',
    '1_1': '960*960',
    '4_5': '864*1080',
  }
  return map[aspectRatio] || '720*1280'
}

export async function handleDashscopeVideoStart(
  request: Request,
  env: Env,
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
  }

  const isImageToVideo = (body.video_model || '').includes('i2v')
  const endpoint = `${DASHSCOPE_BASE}/api/v1/services/aigc/video-generation/video-synthesis`
  const size = getWanVideoSize(body.aspect_ratio)
  const duration = Math.max(3, Math.min(5, body.duration_seconds || 5)) // Wan supports 3-5s

  const input: Record<string, unknown> = {
    prompt: body.prompt,
  }

  // Add image for i2v models
  if (isImageToVideo && body.image_url) {
    input.img_url = body.image_url
  }

  const payload = JSON.stringify({
    model: body.video_model || 'wan2.1-i2v-plus',
    input,
    parameters: {
      size,
      duration: duration,
      prompt_extend: true,
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
    job_id: data.output.task_id, // alias for compatibility with existing polling
    status: 'processing',
    provider: 'dashscope',
  }, { headers: corsHeaders })
}
```

-----

## TASK 6 — Add routes to worker/index.ts

Add these routes in the fetch handler:

```typescript
// Dashscope Brain
if (path === '/api/dashscope/brain') {
  const { handleDashscopeBrain } = await import('./dashscope')
  return handleDashscopeBrain(request, env, creds)
}

// Dashscope Image start (async task)
if (path === '/api/dashscope/image/start') {
  const { handleDashscopeImageStart } = await import('./dashscope')
  return handleDashscopeImageStart(request, env, creds)
}

// Dashscope Video start (async task)
if (path === '/api/dashscope/video/start') {
  const { handleDashscopeVideoStart } = await import('./dashscope')
  return handleDashscopeVideoStart(request, env, creds)
}

// Dashscope task status poll (shared for image + video)
if (path.startsWith('/api/dashscope/task/')) {
  const taskId = path.replace('/api/dashscope/task/', '')
  const { handleDashscopeTaskStatus } = await import('./dashscope')
  return handleDashscopeTaskStatus(request, env, taskId, creds)
}
```

-----

## TASK 7 — Extract buildBrainPrompts to shared util

In worker/brain.ts, extract the system prompt and user prompt building code
into an exported function:

```typescript
export function buildBrainPrompts(body: Record<string, unknown>): {
  systemPrompt: string
  userPrompt: string
} {
  // Move existing system prompt and prompt building code here
  // Return { systemPrompt, userPrompt }
}
```

Then in worker/brain.ts handleBrainRequest, call:
const { systemPrompt, userPrompt } = buildBrainPrompts(body)

And in worker/dashscope.ts, import and use:
import { buildBrainPrompts } from ‘./brain’

-----

## TASK 8 — Add Qwen brain models to Home.tsx brain model dropdown

In src/pages/Home.tsx, find the brain model selector.
Add Qwen models WITH tag label:

```typescript
const BRAIN_MODELS = [
  // Existing AWS Bedrock models
  { id: 'claude_sonnet', label: 'Claude Sonnet 4.6', tag: 'AWS', provider: 'bedrock' },
  { id: 'llama4_maverick', label: 'Llama 4 Maverick', tag: 'AWS', provider: 'bedrock' },
  
  // Qwen Dashscope models — show tag "Qwen" in badge
  { id: 'qwen3_max', label: 'Qwen3 Max', tag: 'Qwen', provider: 'dashscope', badge: '⭐' },
  { id: 'qwen_plus', label: 'Qwen Plus', tag: 'Qwen', provider: 'dashscope', badge: '⚡' },
  { id: 'qwen_flash', label: 'Qwen Flash', tag: 'Qwen', provider: 'dashscope', badge: '🚀' },
  { id: 'qwen_turbo', label: 'Qwen Turbo', tag: 'Qwen', provider: 'dashscope', badge: '💰' },
  { id: 'qwq_plus', label: 'QwQ Plus', tag: 'Qwen', provider: 'dashscope', badge: '🧠' },
]
```

Style the Qwen tag badge:

- Background: rgba(255, 140, 0, 0.15) (orange)
- Border: rgba(255, 140, 0, 0.3)
- Color: #ff8c00
- Text: “Qwen” with model badge emoji

In handleSubmit, detect provider and route accordingly:

```typescript
const selectedModel = BRAIN_MODELS.find(m => m.id === brainModel)
const endpoint = selectedModel?.provider === 'dashscope'
  ? `${WORKER_URL}/api/dashscope/brain`
  : `${WORKER_URL}/api/brain/generate`
```

-----

## TASK 9 — Add Qwen image models to Storyboard.tsx image selector

In the image model selector per scene card, add Qwen models:

```typescript
const IMAGE_MODELS = [
  // AWS Bedrock
  { id: 'nova_canvas', label: 'Nova Canvas', tag: 'AWS', desc: 'Fast cinematic', cost: '$0.06', provider: 'bedrock' },
  { id: 'sd35', label: 'SD 3.5 Large', tag: 'AWS', desc: 'Best quality', cost: '$0.04', provider: 'bedrock' },
  
  // Qwen Dashscope
  { id: 'wanx2.1-t2i-plus', label: 'Wanx 2.1 Plus', tag: 'Qwen', desc: 'Best quality', cost: '¥', provider: 'dashscope', badge: '⭐' },
  { id: 'wanx2.1-t2i-turbo', label: 'Wanx 2.1 Turbo', tag: 'Qwen', desc: 'Fast', cost: '¥', provider: 'dashscope', badge: '⚡' },
  { id: 'wan2.6-image', label: 'Wan 2.6', tag: 'Qwen', desc: 'Latest model', cost: '¥', provider: 'dashscope', badge: '🆕' },
  { id: 'wanx-v1', label: 'Wanx v1', tag: 'Qwen', desc: 'Classic stable', cost: '¥', provider: 'dashscope', badge: '🎨' },
]
```

In handleGenerateImage:

```typescript
const selectedModel = IMAGE_MODELS.find(m => m.id === (imageModel[sceneNum] || 'nova_canvas'))

if (selectedModel?.provider === 'dashscope') {
  // Start async task
  const startRes = await fetch(`${WORKER_URL}/api/dashscope/image/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getApiHeaders() },
    body: JSON.stringify({
      prompt: enhanced_prompt,
      image_model: selectedModel.id,
      aspect_ratio: aspectRatio,
      scene_number: sceneNum,
      project_id: projectId,
    })
  })
  const startData = await startRes.json()
  
  // Save task_id to localStorage and start polling
  // Poll /api/dashscope/task/{task_id} every 5 seconds
  // On done: set imageUrl from result.url
  // On error: set imageError
  startDashscopePolling(sceneNum, startData.task_id, 'image', projectId)
} else {
  // Existing AWS Bedrock flow
  const result = await generateImage({ ... })
}
```

Add startDashscopePolling function (similar to startPolling for video):

- Poll every 5 seconds (image is faster than video)
- Timeout after 5 minutes
- Update imageStatus: ‘generating’ → ‘done’/‘error’
- Show elapsed time same as video

-----

## TASK 10 — Add Qwen video models to Storyboard.tsx video selector

Add video model selector per scene (same as image selector above):

```typescript
const VIDEO_MODELS = [
  // AWS Bedrock
  { id: 'nova_reel', label: 'Nova Reel', tag: 'AWS', desc: 'Up to 6s', provider: 'bedrock' },
  
  // Qwen Dashscope
  { id: 'wan2.1-i2v-plus', label: 'Wan2.1 I2V Plus', tag: 'Qwen', desc: 'Image→Video best', provider: 'dashscope', badge: '⭐' },
  { id: 'wan2.1-i2v-turbo', label: 'Wan2.1 I2V Turbo', tag: 'Qwen', desc: 'Image→Video fast', provider: 'dashscope', badge: '⚡' },
  { id: 'wan2.1-t2v-plus', label: 'Wan2.1 T2V Plus', tag: 'Qwen', desc: 'Text→Video best', provider: 'dashscope', badge: '📝⭐' },
  { id: 'wan2.1-t2v-turbo', label: 'Wan2.1 T2V Turbo', tag: 'Qwen', desc: 'Text→Video fast', provider: 'dashscope', badge: '📝⚡' },
]
```

Add videoModel state: const [videoModel, setVideoModel] = useState({})

In handleGenerateVideo:

```typescript
const selectedVideoModel = VIDEO_MODELS.find(m => m.id === (videoModel[sceneNum] || 'nova_reel'))

if (selectedVideoModel?.provider === 'dashscope') {
  const startRes = await fetch(`${WORKER_URL}/api/dashscope/video/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getApiHeaders() },
    body: JSON.stringify({
      prompt: scene.image_prompt,
      image_url: sceneAsset.imageUrl,
      video_model: selectedVideoModel.id,
      aspect_ratio: aspectRatio,
      duration_seconds: sceneDurations[sceneNum] || 4,
      scene_number: sceneNum,
      project_id: projectId,
    })
  })
  const startData = await startRes.json()
  startDashscopePolling(sceneNum, startData.task_id, 'video', projectId)
} else {
  // Existing Nova Reel flow
}
```

-----

## TASK 11 — Build, Deploy, Test

npx tsc –noEmit 2>&1 | head -20
npm run build 2>&1 | tail -20

wrangler deploy

# Test Dashscope Brain (Qwen Plus)

curl -X POST https://fuzzy-vid-worker.officialdian21.workers.dev/api/dashscope/brain   
-H “Content-Type: application/json”   
-H “X-Dashscope-Api-Key: YOUR_DASHSCOPE_KEY”   
-d ‘{“title”:“Test”,“story”:“Short story”,“platform”:“youtube_shorts”,“brain_model”:“qwen_plus”,“language”:“id”,“art_style”:“cinematic_realistic”,“total_scenes”:2}’   
2>&1 | head -5

# Expected: { “title”: “…”, “scenes”: […] }

# Test Dashscope Image start

curl -X POST https://fuzzy-vid-worker.officialdian21.workers.dev/api/dashscope/image/start   
-H “Content-Type: application/json”   
-H “X-Dashscope-Api-Key: YOUR_DASHSCOPE_KEY”   
-d ‘{“prompt”:“Cinematic ancient market”,“image_model”:“wanx2.1-t2i-plus”,“aspect_ratio”:“9_16”,“scene_number”:1,“project_id”:“test”}’   
2>&1 | head -5

# Expected: { “task_id”: “xxx”, “status”: “processing” }

# Test task status poll

curl https://fuzzy-vid-worker.officialdian21.workers.dev/api/dashscope/task/TASK_ID_FROM_ABOVE   
-H “X-Dashscope-Api-Key: YOUR_DASHSCOPE_KEY”   
2>&1 | head -5

# Expected: { “status”: “processing” } or { “status”: “done”, “url”: “…” }

git add .
git commit -m “feat: Qwen Dashscope Singapore — brain + image (wanx) + video (Wan2.1) integration”
git push origin main

-----

## Model Summary Table

BRAIN MODELS:
qwen3-max     → Best quality reasoning          [Qwen]
qwen-plus     → Balanced ⭐ Recommended         [Qwen]
qwen-flash    → Fast & efficient               [Qwen]
qwen-turbo    → Cheapest option                [Qwen]
qwq-plus      → Deep reasoning                 [Qwen]
claude-sonnet → AWS Bedrock                    [AWS]
llama4-maverick → AWS Bedrock                  [AWS]

IMAGE MODELS:
wanx2.1-t2i-plus  → Best Qwen image quality    [Qwen]
wanx2.1-t2i-turbo → Fast Qwen image            [Qwen]
wan2.6-image      → Latest Qwen image model    [Qwen]
wanx-v1           → Classic stable             [Qwen]
nova_canvas       → AWS Bedrock                [AWS]
sd35              → Stability AI via AWS       [AWS]

VIDEO MODELS:
wan2.1-i2v-plus   → Image→Video best quality   [Qwen]
wan2.1-i2v-turbo  → Image→Video fast           [Qwen]
wan2.1-t2v-plus   → Text→Video best quality    [Qwen]
wan2.1-t2v-turbo  → Text→Video fast            [Qwen]
nova_reel         → AWS Bedrock (6s max)       [AWS]

ENDPOINTS (Singapore):
Brain: dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions
Image: dashscope-intl.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis
Video: dashscope-intl.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis
Poll:  dashscope-intl.aliyuncs.com/api/v1/tasks/{task_id}
Auth:  Authorization: Bearer YOUR_KEY (NO AWS Signature!)