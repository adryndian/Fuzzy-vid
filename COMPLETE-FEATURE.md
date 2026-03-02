# Fuzzy Short — Complete Feature Implementation

# Read CLAUDE.md first for full project context.

# Execute ALL tasks in order. Do NOT skip any task.

# After EVERY task: verify with npm run build (0 errors required)

# Final: wrangler deploy && git add . && git commit -m “feat: complete storyboard features” && git push

-----

## TASK 1 — Update Types in src/types/schema.ts

Add these new types:

```typescript
// Video Job (Nova Reel polling)
export interface VideoJob {
  jobId: string
  sceneNumber: number
  projectId: string
  startedAt: number // Date.now()
  status: 'processing' | 'done' | 'error'
  videoUrl?: string
  errorMessage?: string
  durationSeconds: number
}

export function videoJobKey(projectId: string, sceneNum: number): string {
  return `video_job_${projectId}_${sceneNum}`
}

export function saveVideoJob(job: VideoJob): void {
  localStorage.setItem(videoJobKey(job.projectId, job.sceneNumber), JSON.stringify(job))
}

export function loadVideoJob(projectId: string, sceneNum: number): VideoJob | null {
  try {
    const raw = localStorage.getItem(videoJobKey(projectId, sceneNum))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function clearVideoJob(projectId: string, sceneNum: number): void {
  localStorage.removeItem(videoJobKey(projectId, sceneNum))
}

// Duration
export interface SceneDuration {
  sceneNumber: number
  durationSeconds: number // 2-6 seconds
}

export function redistributeDurations(
  sceneCount: number,
  totalTarget: number
): SceneDuration[] {
  const perScene = Math.max(2, Math.min(6, Math.round(totalTarget / sceneCount)))
  return Array.from({ length: sceneCount }, (_, i) => ({
    sceneNumber: i + 1,
    durationSeconds: perScene,
  }))
}
```

-----

## TASK 2 — Add New Worker Endpoints in worker/index.ts

Add these routes inside the fetch handler:

```typescript
// Video polling endpoints
if (path === '/api/video/start') {
  const { handleVideoStart } = await import('./video')
  return handleVideoStart(request, env, url, ctx, creds)
}
if (path.startsWith('/api/video/status/')) {
  const jobId = decodeURIComponent(path.replace('/api/video/status/', ''))
  const { handleVideoStatus } = await import('./video')
  return handleVideoStatus(request, env, jobId, creds)
}

// Prompt enhancement
if (path === '/api/image/enhance-prompt') {
  const { handleEnhancePrompt } = await import('./image')
  return handleEnhancePrompt(request, env, creds)
}
```

-----

## TASK 3 — Update worker/video.ts (Nova Reel Async Polling)

Add/update these functions:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-AWS-Access-Key-Id, X-AWS-Secret-Access-Key, X-Brain-Region, X-Image-Region',
}

// Start async Nova Reel job
export async function handleVideoStart(
  request: Request,
  env: Env,
  url: URL,
  ctx: ExecutionContext,
  creds: Credentials
): Promise<Response> {
  const body = await request.json() as {
    prompt: string
    image_url: string
    scene_number: number
    project_id: string
    aspect_ratio: string
    duration_seconds: number
  }

  const region = 'us-east-1' // Nova Reel FIXED region
  const modelId = 'amazon.nova-reel-v1:0'
  const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/async-invoke`

  const dimension = body.aspect_ratio === '16_9' ? '1280x720' : '720x1280'
  const duration = Math.max(2, Math.min(6, body.duration_seconds || 6))

  // S3 output location for Nova Reel results
  const outputBucket = env.R2_BUCKET_NAME || 'igome-story-storage'
  const outputPrefix = `video-jobs/${body.project_id}/scene_${body.scene_number}`

  const payload = JSON.stringify({
    taskType: 'TEXT_VIDEO',
    textToVideoParams: {
      text: body.prompt,
      images: body.image_url ? [{
        format: 'jpeg',
        source: {
          s3Location: {
            uri: body.image_url,
            bucketOwner: env.R2_ACCOUNT_ID || ''
          }
        }
      }] : undefined
    },
    videoGenerationConfig: {
      durationSeconds: duration,
      fps: 24,
      dimension,
      seed: Math.floor(Math.random() * 2147483646)
    }
  })

  const { signRequest } = await import('./lib/aws-signature')
  const signedHeaders = await signRequest({
    method: 'POST',
    url: endpoint,
    region,
    service: 'bedrock',
    accessKeyId: creds.awsAccessKeyId,
    secretAccessKey: creds.awsSecretAccessKey,
    body: payload,
    headers: {
      'Content-Type': 'application/json',
      'X-Amzn-Bedrock-S3BucketOwner': env.R2_ACCOUNT_ID || ''
    }
  })

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: signedHeaders,
    body: payload
  })

  if (!res.ok) {
    const err = await res.text()
    return Response.json({
      error: 'Failed to start video job',
      message: err
    }, { status: 500, headers: corsHeaders })
  }

  const data = await res.json() as { invocationArn: string }

  return Response.json({
    job_id: data.invocationArn,
    scene_number: body.scene_number,
    status: 'processing'
  }, { headers: corsHeaders })
}

// Poll Nova Reel job status
export async function handleVideoStatus(
  request: Request,
  env: Env,
  jobId: string,
  creds: Credentials
): Promise<Response> {
  const region = 'us-east-1'
  const encodedJobId = encodeURIComponent(jobId)
  const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/async-invoke/${encodedJobId}`

  const { signRequest } = await import('./lib/aws-signature')
  const signedHeaders = await signRequest({
    method: 'GET',
    url: endpoint,
    region,
    service: 'bedrock',
    accessKeyId: creds.awsAccessKeyId,
    secretAccessKey: creds.awsSecretAccessKey,
    body: '',
    headers: {}
  })

  const res = await fetch(endpoint, {
    method: 'GET',
    headers: signedHeaders
  })

  if (!res.ok) {
    const err = await res.text()
    return Response.json({
      status: 'error',
      message: `Status check failed: ${err}`
    }, { status: 500, headers: corsHeaders })
  }

  const data = await res.json() as {
    status: 'InProgress' | 'Completed' | 'Failed'
    outputDataConfig?: { s3OutputDataConfig?: { s3Uri: string } }
    failureMessage?: string
  }

  if (data.status === 'InProgress') {
    return Response.json({ status: 'processing' }, { headers: corsHeaders })
  }

  if (data.status === 'Failed') {
    return Response.json({
      status: 'error',
      message: data.failureMessage || 'Video generation failed'
    }, { headers: corsHeaders })
  }

  // Completed — get S3 URL, upload to R2, return public URL
  const s3Uri = data.outputDataConfig?.s3OutputDataConfig?.s3Uri || ''
  // Upload from S3 to R2 and get public URL
  const videoUrl = await downloadFromS3AndUploadToR2(s3Uri, env, creds)

  return Response.json({
    status: 'done',
    video_url: videoUrl
  }, { headers: corsHeaders })
}

async function downloadFromS3AndUploadToR2(
  s3Uri: string,
  env: Env,
  creds: Credentials
): Promise<string> {
  // s3Uri format: s3://bucket/key
  const match = s3Uri.match(/s3:\/\/([^/]+)\/(.+)/)
  if (!match) throw new Error('Invalid S3 URI')

  const [, bucket, key] = match
  const region = 'us-east-1'
  const s3Endpoint = `https://${bucket}.s3.${region}.amazonaws.com/${key}`

  const { signRequest } = await import('./lib/aws-signature')
  const signedHeaders = await signRequest({
    method: 'GET',
    url: s3Endpoint,
    region,
    service: 's3',
    accessKeyId: creds.awsAccessKeyId,
    secretAccessKey: creds.awsSecretAccessKey,
    body: '',
    headers: {}
  })

  const videoRes = await fetch(s3Endpoint, { headers: signedHeaders })
  if (!videoRes.ok) throw new Error('Failed to download video from S3')

  const videoBuffer = await videoRes.arrayBuffer()
  const fileName = `videos/${Date.now()}_${key.split('/').pop()}`

  // Upload to R2
  const r2Endpoint = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME || 'igome-story-storage'}/${fileName}`

  const { signRequest: signR2 } = await import('./lib/aws-signature')
  const r2Headers = await signR2({
    method: 'PUT',
    url: r2Endpoint,
    region: 'auto',
    service: 's3',
    accessKeyId: env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: env.R2_SECRET_ACCESS_KEY || '',
    body: videoBuffer,
    headers: { 'Content-Type': 'video/mp4' }
  })

  const r2Res = await fetch(r2Endpoint, {
    method: 'PUT',
    headers: r2Headers,
    body: videoBuffer
  })

  if (!r2Res.ok) throw new Error('Failed to upload video to R2')

  return `${env.R2_PUBLIC_URL || ''}/${fileName}`
}
```

-----

## TASK 4 — Add handleEnhancePrompt in worker/image.ts

```typescript
export async function handleEnhancePrompt(
  request: Request,
  env: Env,
  creds: Credentials
): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-AWS-Access-Key-Id, X-AWS-Secret-Access-Key, X-Brain-Region',
  }

  const body = await request.json() as {
    raw_prompt: string
    art_style: string
    aspect_ratio: string
    mood?: string
  }

  const systemPrompt = `You are an expert AI image prompt engineer specializing in cinematic visual storytelling.
Your job is to enhance image prompts for maximum quality output from AI image generators like Amazon Nova Canvas.

Rules:
- Keep the original scene/subject intact
- Add professional photography and cinematography technical terms
- Add lighting specifications
- Add camera and lens details
- Add quality modifiers
- Keep the enhanced prompt under 400 characters
- Return ONLY the enhanced prompt text, nothing else`

  const userPrompt = `Enhance this image prompt for ${body.art_style} style, ${body.aspect_ratio} aspect ratio, mood: ${body.mood || 'neutral'}:

"${body.raw_prompt}"

Add these types of technical terms as appropriate:
- Photography: depth of field, bokeh, rule of thirds, golden ratio
- Lighting: volumetric lighting, god rays, golden hour, rim light, chiaroscuro
- Camera: 85mm lens, wide angle, dutch angle, bird's eye view
- Quality: 8k UHD, photorealistic, highly detailed, sharp focus
- Style-specific terms for ${body.art_style}`

  // Call Claude Sonnet via Bedrock
  const region = creds.brainRegion || 'us-east-1'
  const modelId = 'us.anthropic.claude-sonnet-4-6'
  const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/invoke`

  const payload = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  })

  const { signRequest } = await import('./lib/aws-signature')
  const signedHeaders = await signRequest({
    method: 'POST',
    url: endpoint,
    region,
    service: 'bedrock',
    accessKeyId: creds.awsAccessKeyId,
    secretAccessKey: creds.awsSecretAccessKey,
    body: payload,
    headers: { 'Content-Type': 'application/json' }
  })

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: signedHeaders,
    body: payload
  })

  if (!res.ok) {
    // Fallback: return original prompt with basic enhancement
    const basicEnhanced = `${body.raw_prompt}, ${body.art_style}, cinematic lighting, 8k UHD, highly detailed, sharp focus`
    return Response.json({ enhanced_prompt: basicEnhanced }, { headers: corsHeaders })
  }

  const data = await res.json() as { content: [{ text: string }] }
  const enhanced = data.content[0].text.trim()

  return Response.json({ enhanced_prompt: enhanced }, { headers: corsHeaders })
}
```

-----

## TASK 5 — Update src/lib/api.ts

Add new API functions:

```typescript
// Start Nova Reel video job (async)
export async function startVideoJob(params: {
  prompt: string
  image_url: string
  scene_number: number
  project_id: string
  aspect_ratio: string
  duration_seconds: number
}): Promise<{ job_id: string; scene_number: number; status: string }> {
  const res = await fetch(`${WORKER_URL}/api/video/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getApiHeaders() },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const err = await res.json() as Record<string, unknown>
    throw new Error((err.message as string) || `Failed to start video job`)
  }
  return res.json()
}

// Poll video job status
export async function pollVideoStatus(jobId: string): Promise<{
  status: 'processing' | 'done' | 'error'
  video_url?: string
  message?: string
}> {
  const encodedJobId = encodeURIComponent(jobId)
  const res = await fetch(
    `${WORKER_URL}/api/video/status/${encodedJobId}`,
    { headers: getApiHeaders() }
  )
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`)
  return res.json()
}

// Enhance image prompt via Claude
export async function enhancePrompt(params: {
  raw_prompt: string
  art_style: string
  aspect_ratio: string
  mood?: string
}): Promise<{ enhanced_prompt: string }> {
  const res = await fetch(`${WORKER_URL}/api/image/enhance-prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getApiHeaders() },
    body: JSON.stringify(params),
  })
  if (!res.ok) return { enhanced_prompt: params.raw_prompt }
  return res.json()
}
```

-----

## TASK 6 — Full Rewrite src/pages/Storyboard.tsx

Complete rewrite with ALL new features:

```typescript
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SceneAssets, SceneAssetsMap, GenerationStatus, VideoJob } from '../types/schema'
import {
  defaultSceneAssets, saveVideoJob, loadVideoJob,
  redistributeDurations, videoJobKey
} from '../types/schema'
import {
  generateImage, generateAudio,
  startVideoJob, pollVideoStatus, enhancePrompt
} from '../lib/api'

const POLL_INTERVAL = 10000 // 10 seconds
const VIDEO_TIMEOUT = 600000 // 10 minutes

export function Storyboard() {
  const navigate = useNavigate()
  const [storyboard, setStoryboard] = useState<Record<string, unknown> | null>(null)
  const [assets, setAssets] = useState<SceneAssetsMap>({})
  const [language, setLanguage] = useState('id')
  const [viewMode, setViewMode] = useState<'story' | 'json'>('story')
  const [copiedJson, setCopiedJson] = useState(false)
  const [totalDuration, setTotalDuration] = useState(60) // seconds
  const [sceneDurations, setSceneDurations] = useState<Record<number, number>>({})
  const [artStyle, setArtStyle] = useState('cinematic_realistic')
  const [aspectRatio, setAspectRatio] = useState('9_16')
  const pollTimers = useRef<Record<number, ReturnType<typeof setInterval>>>({})
  const pollStartTimes = useRef<Record<number, number>>({})

  // ─── Load storyboard + resume video jobs ──────────────────
  useEffect(() => {
    const raw = sessionStorage.getItem('storyboard_result')
    if (!raw) { navigate('/'); return }
    try {
      const data = JSON.parse(raw)
      setStoryboard(data)

      // Load settings
      const stored = localStorage.getItem('fuzzy_short_settings')
      if (stored) {
        const keys = JSON.parse(stored)
        if (keys.language) setLanguage(keys.language)
      }

      // Load art style and aspect ratio from storyboard
      if (data.art_style) setArtStyle(data.art_style as string)
      if (data.aspect_ratio) setAspectRatio(data.aspect_ratio as string)

      // Initialize scene durations evenly
      const scenes = (data.scenes as Record<string, unknown>[]) || []
      const initial: Record<number, number> = {}
      scenes.forEach((_, i) => { initial[i + 1] = Math.round(60 / scenes.length) })
      setSceneDurations(initial)

      // Auto-resume any processing video jobs
      const projectId = (data.project_id as string) || 'unknown'
      scenes.forEach((scene) => {
        const sceneNum = scene.scene_number as number
        const savedJob = loadVideoJob(projectId, sceneNum)
        if (savedJob && savedJob.status === 'processing') {
          setAssets(prev => ({
            ...prev,
            [sceneNum]: {
              ...(prev[sceneNum] || defaultSceneAssets()),
              videoStatus: 'generating'
            }
          }))
          startPolling(sceneNum, savedJob.jobId, projectId, savedJob.startedAt)
        } else if (savedJob && savedJob.status === 'done' && savedJob.videoUrl) {
          setAssets(prev => ({
            ...prev,
            [sceneNum]: {
              ...(prev[sceneNum] || defaultSceneAssets()),
              videoStatus: 'done',
              videoUrl: savedJob.videoUrl
            }
          }))
        }
      })
    } catch { navigate('/') }
  }, [navigate])

  // ─── Polling logic ─────────────────────────────────────────
  const startPolling = useCallback((
    sceneNum: number,
    jobId: string,
    projectId: string,
    startedAt?: number
  ) => {
    const startTime = startedAt || Date.now()
    pollStartTimes.current[sceneNum] = startTime

    const timer = setInterval(async () => {
      const elapsed = Date.now() - pollStartTimes.current[sceneNum]

      // Timeout after 10 minutes
      if (elapsed > VIDEO_TIMEOUT) {
        clearInterval(pollTimers.current[sceneNum])
        const job = loadVideoJob(projectId, sceneNum)
        if (job) {
          saveVideoJob({ ...job, status: 'error', errorMessage: 'Timeout — video took too long' })
        }
        updateAsset(sceneNum, {
          videoStatus: 'error',
          videoError: 'Timeout — video generation took too long. Please retry.'
        })
        return
      }

      try {
        const result = await pollVideoStatus(jobId)
        if (result.status === 'done' && result.video_url) {
          clearInterval(pollTimers.current[sceneNum])
          const job = loadVideoJob(projectId, sceneNum)
          if (job) saveVideoJob({ ...job, status: 'done', videoUrl: result.video_url })
          updateAsset(sceneNum, { videoStatus: 'done', videoUrl: result.video_url })
        } else if (result.status === 'error') {
          clearInterval(pollTimers.current[sceneNum])
          const job = loadVideoJob(projectId, sceneNum)
          if (job) saveVideoJob({ ...job, status: 'error', errorMessage: result.message })
          updateAsset(sceneNum, { videoStatus: 'error', videoError: result.message || 'Video failed' })
        }
        // 'processing' → keep polling
      } catch {
        // Network error — keep polling, don't give up
      }
    }, POLL_INTERVAL)

    pollTimers.current[sceneNum] = timer
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(pollTimers.current).forEach(clearInterval)
    }
  }, [])

  // ─── Elapsed time display ──────────────────────────────────
  const [elapsedTimes, setElapsedTimes] = useState<Record<number, number>>({})
  useEffect(() => {
    const timer = setInterval(() => {
      const updated: Record<number, number> = {}
      Object.entries(pollStartTimes.current).forEach(([sceneNum, startTime]) => {
        updated[Number(sceneNum)] = Math.floor((Date.now() - startTime) / 1000)
      })
      setElapsedTimes(updated)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // ─── Helpers ───────────────────────────────────────────────
  const updateAsset = (sceneNum: number, update: Partial<SceneAssets>) => {
    setAssets(prev => ({
      ...prev,
      [sceneNum]: { ...(prev[sceneNum] || defaultSceneAssets()), ...update }
    }))
  }

  const formatElapsed = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  // ─── Duration control ──────────────────────────────────────
  const handleTotalDurationChange = (total: number) => {
    setTotalDuration(total)
    const scenes = (storyboard?.scenes as Record<string, unknown>[]) || []
    const redistributed = redistributeDurations(scenes.length, total)
    const newDurations: Record<number, number> = {}
    redistributed.forEach(d => { newDurations[d.sceneNumber] = d.durationSeconds })
    setSceneDurations(newDurations)
  }

  const handleSceneDurationChange = (sceneNum: number, duration: number) => {
    setSceneDurations(prev => ({ ...prev, [sceneNum]: duration }))
  }

  const totalAllocated = Object.values(sceneDurations).reduce((a, b) => a + b, 0)

  // ─── Generation handlers ───────────────────────────────────
  const handleGenerateImage = async (scene: Record<string, unknown>) => {
    const sceneNum = scene.scene_number as number
    updateAsset(sceneNum, { imageStatus: 'generating', imageError: undefined })
    try {
      // Enhance prompt first
      const { enhanced_prompt } = await enhancePrompt({
        raw_prompt: scene.image_prompt as string,
        art_style: artStyle,
        aspect_ratio: aspectRatio,
        mood: scene.mood as string,
      })

      const data = storyboard as Record<string, unknown>
      const result = await generateImage({
        prompt: enhanced_prompt,
        scene_number: sceneNum,
        project_id: (data.project_id as string) || 'unknown',
        aspect_ratio: aspectRatio,
        art_style: artStyle,
      })
      updateAsset(sceneNum, {
        imageStatus: 'done',
        imageUrl: result.image_url,
        enhancedPrompt: enhanced_prompt
      })
    } catch (e: any) {
      updateAsset(sceneNum, { imageStatus: 'error', imageError: e.message })
    }
  }

  const handleGenerateVideo = async (scene: Record<string, unknown>) => {
    const sceneNum = scene.scene_number as number
    const sceneAsset = assets[sceneNum]
    if (!sceneAsset?.imageUrl) return

    updateAsset(sceneNum, { videoStatus: 'generating', videoError: undefined })
    const data = storyboard as Record<string, unknown>
    const projectId = (data.project_id as string) || 'unknown'

    try {
      const result = await startVideoJob({
        image_url: sceneAsset.imageUrl,
        prompt: scene.image_prompt as string,
        scene_number: sceneNum,
        project_id: projectId,
        aspect_ratio: aspectRatio,
        duration_seconds: sceneDurations[sceneNum] || 6,
      })

      // Save job to localStorage
      saveVideoJob({
        jobId: result.job_id,
        sceneNumber: sceneNum,
        projectId,
        startedAt: Date.now(),
        status: 'processing',
        durationSeconds: sceneDurations[sceneNum] || 6,
      })

      startPolling(sceneNum, result.job_id, projectId)
    } catch (e: any) {
      updateAsset(sceneNum, { videoStatus: 'error', videoError: e.message })
    }
  }

  const handleRetryVideo = async (scene: Record<string, unknown>) => {
    const sceneNum = scene.scene_number as number
    const data = storyboard as Record<string, unknown>
    const projectId = (data.project_id as string) || 'unknown'
    clearVideoJob(projectId, sceneNum)
    clearInterval(pollTimers.current[sceneNum])
    delete pollTimers.current[sceneNum]
    delete pollStartTimes.current[sceneNum]
    await handleGenerateVideo(scene)
  }

  const handleGenerateAudio = async (scene: Record<string, unknown>) => {
    const sceneNum = scene.scene_number as number
    const text = language === 'id'
      ? (scene.text_id as string) || (scene.text_en as string)
      : (scene.text_en as string) || (scene.text_id as string)
    if (!text) return
    updateAsset(sceneNum, { audioStatus: 'generating', audioError: undefined })
    try {
      const data = storyboard as Record<string, unknown>
      const result = await generateAudio({
        text,
        language,
        scene_number: sceneNum,
        project_id: (data.project_id as string) || 'unknown',
        engine: 'polly',
      })
      updateAsset(sceneNum, { audioStatus: 'done', audioUrl: result.audio_url })
    } catch (e: any) {
      updateAsset(sceneNum, { audioStatus: 'error', audioError: e.message })
    }
  }

  // ─── Export handlers ───────────────────────────────────────
  const downloadFile = async (url: string, filename: string) => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
      URL.revokeObjectURL(a.href)
    } catch { alert('Download failed. Try again.') }
  }

  const exportSceneAsZip = async (scene: Record<string, unknown>) => {
    const sceneNum = scene.scene_number as number
    const sceneAsset = assets[sceneNum]
    const title = ((storyboard?.title as string) || 'scene').replace(/\s+/g, '_')

    // Download each available asset
    const downloads: Promise<void>[] = []
    if (sceneAsset?.imageUrl) {
      downloads.push(downloadFile(sceneAsset.imageUrl, `${title}_scene_${sceneNum}.jpg`))
    }
    if (sceneAsset?.videoUrl) {
      downloads.push(downloadFile(sceneAsset.videoUrl, `${title}_scene_${sceneNum}.mp4`))
    }
    if (sceneAsset?.audioUrl) {
      downloads.push(downloadFile(sceneAsset.audioUrl, `${title}_scene_${sceneNum}.mp3`))
    }

    if (downloads.length === 0) {
      alert('No assets generated yet for this scene.')
      return
    }

    await Promise.all(downloads)
  }

  // ─── Styles ───────────────────────────────────────────────
  const page: React.CSSProperties = {
    minHeight: '100vh',
    width: '100%',
    background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1527 50%, #060d1a 100%)',
    fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
    paddingBottom: '60px',
  }

  const glassCard: React.CSSProperties = {
    background: 'rgba(255,255,255,0.07)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '20px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
    marginBottom: '16px',
    overflow: 'hidden',
  }

  const actionBtn = (
    label: string,
    onClick: () => void,
    status: GenerationStatus,
    disabled = false,
    color = '#F05A25'
  ) => (
    <button onClick={onClick}
      disabled={status === 'generating' || disabled}
      style={{
        padding: '9px 14px', borderRadius: '11px',
        border: `1px solid ${status === 'done' ? '#4ade8066' : disabled ? 'rgba(255,255,255,0.06)' : color + '55'}`,
        background: status === 'done' ? 'rgba(74,222,128,0.1)' :
                    disabled ? 'rgba(255,255,255,0.03)' : `${color}15`,
        color: status === 'done' ? '#4ade80' : disabled ? 'rgba(239,225,207,0.2)' : color,
        fontSize: '12px', fontWeight: 600,
        cursor: (status === 'generating' || disabled) ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
      }}>
      {status === 'done' ? '🔄 Re-generate' : label}
    </button>
  )

  const downloadBtn = (url: string | undefined, filename: string, emoji: string) => {
    if (!url) return null
    return (
      <button onClick={() => downloadFile(url, filename)}
        style={{
          padding: '7px 12px', borderRadius: '9px',
          border: '1px solid rgba(74,222,128,0.3)',
          background: 'rgba(74,222,128,0.08)',
          color: '#4ade80', fontSize: '11px', fontWeight: 600,
          cursor: 'pointer',
        }}>
        {emoji} Download
      </button>
    )
  }

  if (!storyboard) return null

  const scenes = (storyboard.scenes as Record<string, unknown>[]) || []
  const productionNotes = storyboard.production_notes as Record<string, unknown> | undefined

  return (
    <div style={page}>

      {/* Sticky Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(10,15,30,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '12px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <button onClick={() => navigate('/')} style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(239,225,207,0.15)',
            borderRadius: '10px', color: '#EFE1CF',
            padding: '7px 12px', cursor: 'pointer',
            fontSize: '12px', fontWeight: 600, flexShrink: 0,
          }}>← Back</button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#EFE1CF', fontSize: '14px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {storyboard.title as string}
            </div>
            <div style={{ color: 'rgba(239,225,207,0.4)', fontSize: '10px' }}>
              {scenes.length} scenes · {totalAllocated}s total
            </div>
          </div>

          <span style={{ fontSize: '18px', flexShrink: 0 }}>🎬</span>
        </div>

        {/* View Toggle + Duration */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* View Mode Toggle */}
          <div style={{
            display: 'flex', background: 'rgba(255,255,255,0.05)',
            borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)',
            padding: '3px', flexShrink: 0,
          }}>
            {(['story', 'json'] as const).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} style={{
                padding: '5px 10px', borderRadius: '7px',
                border: 'none', fontSize: '11px', fontWeight: 600,
                background: viewMode === mode ? '#F05A25' : 'transparent',
                color: viewMode === mode ? 'white' : 'rgba(239,225,207,0.4)',
                cursor: 'pointer',
              }}>
                {mode === 'story' ? '📋 Story' : '{ } JSON'}
              </button>
            ))}
          </div>

          {/* Total Duration */}
          <div style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px', padding: '6px 10px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: 'rgba(239,225,207,0.5)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Total Duration
              </span>
              <span style={{
                color: Math.abs(totalAllocated - totalDuration) <= 2 ? '#4ade80' : '#F05A25',
                fontSize: '9px', fontWeight: 600,
              }}>
                {totalAllocated}s / {totalDuration}s
              </span>
            </div>
            <input type="range" min={15} max={120} step={5}
              value={totalDuration}
              onChange={e => handleTotalDurationChange(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#F05A25', height: '3px' }}
            />
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        {/* JSON View */}
        {viewMode === 'json' && (
          <div style={{ ...glassCard, padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ color: '#EFE1CF', fontSize: '13px', fontWeight: 600 }}>{ } Raw JSON</span>
              <button onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(storyboard, null, 2))
                setCopiedJson(true)
                setTimeout(() => setCopiedJson(false), 2000)
              }} style={{
                padding: '5px 12px', borderRadius: '8px',
                border: '1px solid rgba(63,169,246,0.3)',
                background: 'rgba(63,169,246,0.1)',
                color: copiedJson ? '#4ade80' : '#3FA9F6',
                fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              }}>
                {copiedJson ? '✅ Copied!' : '📋 Copy'}
              </button>
            </div>
            <pre style={{
              color: '#4ade80', fontSize: '10px', lineHeight: '1.6',
              overflow: 'auto', maxHeight: '400px',
              background: 'rgba(0,0,0,0.4)', padding: '12px',
              borderRadius: '10px', margin: 0,
            }}>
              {JSON.stringify(storyboard, null, 2)}
            </pre>
          </div>
        )}

        {/* Story View */}
        {viewMode === 'story' && (
          <>
            {/* Production Notes */}
            {productionNotes && (
              <div style={{ ...glassCard, padding: '14px', marginBottom: '16px' }}>
                <p style={{ color: 'rgba(239,225,207,0.4)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                  Production Notes
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                  {(productionNotes.color_palette as string[] || []).map((c, i) => (
                    <span key={i} style={{
                      padding: '3px 10px', borderRadius: '20px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#EFE1CF', fontSize: '11px',
                    }}>{c}</span>
                  ))}
                </div>
                {productionNotes.music_tone && (
                  <p style={{ color: 'rgba(239,225,207,0.5)', fontSize: '11px' }}>
                    🎵 {productionNotes.music_tone as string}
                  </p>
                )}
              </div>
            )}

            {/* Scenes */}
            {scenes.map((scene) => {
              const sceneNum = scene.scene_number as number
              const sceneAsset = assets[sceneNum] || defaultSceneAssets()
              const narration = language === 'id'
                ? (scene.text_id as string) || (scene.text_en as string)
                : (scene.text_en as string) || (scene.text_id as string)
              const hasImage = sceneAsset.imageStatus === 'done' && !!sceneAsset.imageUrl
              const hasVideo = sceneAsset.videoStatus === 'done' && !!sceneAsset.videoUrl
              const hasAudio = sceneAsset.audioStatus === 'done' && !!sceneAsset.audioUrl
              const isVideoProcessing = sceneAsset.videoStatus === 'generating'
              const elapsed = elapsedTimes[sceneNum] || 0
              const sceneDur = sceneDurations[sceneNum] || 4
              const data = storyboard as Record<string, unknown>
              const projectId = (data.project_id as string) || 'unknown'
              const title = ((storyboard?.title as string) || 'scene').replace(/\s+/g, '_')

              return (
                <div key={sceneNum} style={glassCard}>

                  {/* Scene Header */}
                  <div style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', gap: '10px',
                  }}>
                    <div style={{
                      width: '30px', height: '30px', borderRadius: '9px',
                      background: 'rgba(240,90,37,0.2)',
                      border: '1px solid rgba(240,90,37,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#F05A25', fontSize: '12px', fontWeight: 700, flexShrink: 0,
                    }}>{sceneNum}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#EFE1CF', fontSize: '12px', fontWeight: 600 }}>
                        Scene {sceneNum}
                      </div>
                      <div style={{ color: '#3FA9F6', fontSize: '10px' }}>
                        {(scene.scene_type as string || '').replace(/_/g, ' ')}
                        {scene.mood && ` · ${scene.mood}`}
                      </div>
                    </div>

                    {/* Export Scene ZIP */}
                    {(hasImage || hasVideo || hasAudio) && (
                      <button onClick={() => exportSceneAsZip(scene)} style={{
                        padding: '5px 10px', borderRadius: '8px',
                        border: '1px solid rgba(168,85,247,0.35)',
                        background: 'rgba(168,85,247,0.1)',
                        color: '#A855F7', fontSize: '10px', fontWeight: 600,
                        cursor: 'pointer',
                      }}>
                        📦 Export
                      </button>
                    )}
                  </div>

                  <div style={{ padding: '14px' }}>

                    {/* Narration */}
                    <p style={{ color: '#EFE1CF', fontSize: '12px', lineHeight: '1.6', fontStyle: 'italic', marginBottom: '10px' }}>
                      "{narration}"
                    </p>

                    {/* Image Prompt */}
                    <div style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: '10px', padding: '8px 10px', marginBottom: '12px',
                    }}>
                      <p style={{ color: 'rgba(239,225,207,0.35)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                        Image Prompt {(sceneAsset as any).enhancedPrompt ? '✨ Enhanced' : ''}
                      </p>
                      <p style={{ color: 'rgba(239,225,207,0.6)', fontSize: '11px', lineHeight: '1.5' }}>
                        {(sceneAsset as any).enhancedPrompt || (scene.image_prompt as string)}
                      </p>
                    </div>

                    {/* Scene Duration Slider */}
                    <div style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '12px', padding: '10px 12px', marginBottom: '12px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ color: 'rgba(239,225,207,0.5)', fontSize: '10px' }}>⏱️ Scene Duration</span>
                        <span style={{ color: '#F05A25', fontSize: '10px', fontWeight: 700 }}>{sceneDur}s</span>
                      </div>
                      <input type="range" min={2} max={6} step={1}
                        value={sceneDur}
                        onChange={e => handleSceneDurationChange(sceneNum, Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#F05A25', height: '3px' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'rgba(239,225,207,0.25)', fontSize: '9px' }}>2s</span>
                        <span style={{ color: 'rgba(239,225,207,0.25)', fontSize: '9px' }}>6s</span>
                      </div>
                    </div>

                    {/* IMAGE Section */}
                    <div style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '14px', padding: '12px', marginBottom: '8px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ color: '#EFE1CF', fontSize: '12px', fontWeight: 600 }}>🖼️ Image</span>
                        {sceneAsset.imageStatus === 'generating' && (
                          <span style={{ color: '#F05A25', fontSize: '10px' }}>⏳ Generating...</span>
                        )}
                        {sceneAsset.imageStatus === 'error' && (
                          <span style={{ color: '#f87171', fontSize: '10px' }}>❌ Failed</span>
                        )}
                        {hasImage && (
                          <span style={{ color: '#4ade80', fontSize: '10px' }}>✅ Ready</span>
                        )}
                      </div>

                      {hasImage && (
                        <img src={sceneAsset.imageUrl} alt={`Scene ${sceneNum}`}
                          style={{ width: '100%', borderRadius: '10px', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                      )}

                      {sceneAsset.imageError && (
                        <p style={{ color: '#f87171', fontSize: '11px', marginBottom: '8px' }}>{sceneAsset.imageError}</p>
                      )}

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {actionBtn('🖼️ Generate Image', () => handleGenerateImage(scene), sceneAsset.imageStatus)}
                        {downloadBtn(sceneAsset.imageUrl, `${title}_scene_${sceneNum}.jpg`, '⬇️')}
                      </div>
                    </div>

                    {/* VIDEO Section */}
                    <div style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${hasImage ? 'rgba(63,169,246,0.2)' : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: '14px', padding: '12px', marginBottom: '8px',
                      opacity: hasImage ? 1 : 0.5,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ color: '#EFE1CF', fontSize: '12px', fontWeight: 600 }}>🎬 Video</span>
                        {!hasImage && <span style={{ color: 'rgba(239,225,207,0.3)', fontSize: '10px' }}>Generate image first</span>}
                        {isVideoProcessing && (
                          <span style={{ color: '#3FA9F6', fontSize: '10px' }}>
                            ⏳ {formatElapsed(elapsed)} elapsed
                          </span>
                        )}
                        {sceneAsset.videoStatus === 'error' && (
                          <span style={{ color: '#f87171', fontSize: '10px' }}>❌ Failed</span>
                        )}
                        {hasVideo && <span style={{ color: '#4ade80', fontSize: '10px' }}>✅ Ready</span>}
                      </div>

                      {hasVideo && (
                        <video src={sceneAsset.videoUrl} controls
                          style={{ width: '100%', borderRadius: '10px', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                      )}

                      {sceneAsset.videoError && (
                        <p style={{ color: '#f87171', fontSize: '11px', marginBottom: '8px' }}>{sceneAsset.videoError}</p>
                      )}

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {sceneAsset.videoStatus === 'error'
                          ? (
                            <button onClick={() => handleRetryVideo(scene)} style={{
                              padding: '9px 14px', borderRadius: '11px',
                              border: '1px solid rgba(248,113,113,0.4)',
                              background: 'rgba(248,113,113,0.1)',
                              color: '#f87171', fontSize: '12px', fontWeight: 600,
                              cursor: 'pointer',
                            }}>🔄 Retry</button>
                          )
                          : actionBtn(
                              `🎬 Generate Video (${sceneDur}s)`,
                              () => handleGenerateVideo(scene),
                              sceneAsset.videoStatus,
                              !hasImage,
                              '#3FA9F6'
                            )
                        }
                        {downloadBtn(sceneAsset.videoUrl, `${title}_scene_${sceneNum}.mp4`, '⬇️')}
                      </div>
                    </div>

                    {/* AUDIO Section */}
                    <div style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(168,85,247,0.2)',
                      borderRadius: '14px', padding: '12px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#EFE1CF', fontSize: '12px', fontWeight: 600 }}>🎵 Audio VO</span>
                          <span style={{ color: 'rgba(239,225,207,0.3)', fontSize: '9px' }}>AWS Polly</span>
                        </div>
                        {sceneAsset.audioStatus === 'generating' && <span style={{ color: '#A855F7', fontSize: '10px' }}>⏳ Generating...</span>}
                        {sceneAsset.audioStatus === 'error' && <span style={{ color: '#f87171', fontSize: '10px' }}>❌ Failed</span>}
                        {hasAudio && <span style={{ color: '#4ade80', fontSize: '10px' }}>✅ Ready</span>}
                      </div>

                      {hasAudio && (
                        <audio src={sceneAsset.audioUrl} controls style={{ width: '100%', marginBottom: '8px' }} />
                      )}

                      {sceneAsset.audioError && (
                        <p style={{ color: '#f87171', fontSize: '11px', marginBottom: '8px' }}>{sceneAsset.audioError}</p>
                      )}

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {actionBtn('🎵 Generate Audio VO', () => handleGenerateAudio(scene), sceneAsset.audioStatus, false, '#A855F7')}
                        {downloadBtn(sceneAsset.audioUrl, `${title}_scene_${sceneNum}.mp3`, '⬇️')}
                      </div>
                    </div>

                    {/* Camera + Transition */}
                    {(scene.camera_angle || scene.transition) && (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                        {scene.camera_angle && (
                          <span style={{ padding: '3px 9px', borderRadius: '20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(239,225,207,0.4)', fontSize: '10px' }}>
                            📷 {scene.camera_angle as string}
                          </span>
                        )}
                        {scene.transition && (
                          <span style={{ padding: '3px 9px', borderRadius: '20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(239,225,207,0.4)', fontSize: '10px' }}>
                            ➡️ {(scene.transition as string).replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
```

-----

## TASK 7 — Update SceneAssets type in src/types/schema.ts

Add enhancedPrompt field:

```typescript
export interface SceneAssets {
  imageUrl?: string
  imageStatus: GenerationStatus
  imageError?: string
  enhancedPrompt?: string  // ← ADD THIS
  videoUrl?: string
  videoStatus: GenerationStatus
  videoError?: string
  audioUrl?: string
  audioStatus: GenerationStatus
  audioError?: string
}
```

-----

## TASK 8 — Import clearVideoJob in Storyboard.tsx

Make sure this import exists in Storyboard.tsx:

```typescript
import { ..., clearVideoJob } from '../types/schema'
```

-----

## TASK 9 — Build, Deploy, Test

```bash
# TypeScript check
npx tsc --noEmit 2>&1 | head -30

# Build
npm run build 2>&1 | tail -20
# Must be 0 errors

# Deploy Worker
wrangler deploy

# Test enhance-prompt endpoint
curl -X POST https://fuzzy-vid-worker.officialdian21.workers.dev/api/image/enhance-prompt \
  -H "Content-Type: application/json" \
  -H "X-AWS-Access-Key-Id: YOUR_AWS_ACCESS_KEY_ID" \
  -H "X-AWS-Secret-Access-Key: YOUR_AWS_SECRET_ACCESS_KEY" \
  -H "X-Brain-Region: us-east-1" \
  -d '{"raw_prompt":"Ancient Persian market at sunset","art_style":"cinematic_realistic","aspect_ratio":"9_16","mood":"epic"}' \
  2>&1 | tail -5
# Expected: { enhanced_prompt: "..." with technical terms }

# Test video start endpoint
curl -X POST https://fuzzy-vid-worker.officialdian21.workers.dev/api/video/start \
  -H "Content-Type: application/json" \
  -H "X-AWS-Access-Key-Id: YOUR_AWS_ACCESS_KEY_ID" \
  -H "X-AWS-Secret-Access-Key: YOUR_AWS_SECRET_ACCESS_KEY" \
  -d '{"prompt":"Ancient market cinematic","image_url":"https://example.com/test.jpg","scene_number":1,"project_id":"test","aspect_ratio":"9_16","duration_seconds":4}' \
  2>&1 | tail -5
# Expected: { job_id: "arn:aws:bedrock:...", status: "processing" }

# Push all changes
git add .
git commit -m "feat: nova reel polling + prompt enhance + json view + duration control + export per scene"
git push origin main
```