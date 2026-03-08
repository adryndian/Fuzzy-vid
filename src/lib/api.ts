/// <reference types="vite/client" />
import type { VideoPromptData } from '../types/schema'
import { loadSettings, buildApiHeaders } from '../types/schema'

export const api = {
  get: async (path: string) => {
    const res = await fetch(`${WORKER_URL}${path}`)
    return res.json()
  },
  post: async (path: string, body: unknown) => {
    const res = await fetch(`${WORKER_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    return res.json()
  }
}

export const WORKER_URL = 'https://fuzzy-vid-worker.officialdian21.workers.dev'

export function getApiHeaders(userId?: string): Record<string, string> {
  const settings = loadSettings(userId)
  return buildApiHeaders(settings)
}

// Clear current user's in-memory session data on sign-out
// Does NOT clear saved settings (user wants to keep their keys)
export function clearUserSessionData(_userId: string) {
  sessionStorage.removeItem('storyboard_result')
  sessionStorage.removeItem('selected_image_model')
  sessionStorage.removeItem('selected_video_model')
}

export async function generateImage(params: {
  prompt: string
  scene_number: number
  project_id: string
  aspect_ratio: string
  art_style: string
  image_model?: 'nova_canvas' | 'sd35'
}): Promise<{ image_url: string }> {
  const res = await fetch(`${WORKER_URL}/api/image/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getApiHeaders() },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const err = await res.json() as Record<string, unknown>
    throw new Error((err.error as string) || (err.message as string) || `Image generation failed: ${res.status}`)
  }
  return res.json()
}

export async function checkVideoStatus(jobId: string): Promise<{
  status: 'processing' | 'done' | 'failed'
  video_url?: string
  message?: string
}> {
  const res = await fetch(`${WORKER_URL}/api/video/status/${encodeURIComponent(jobId)}`, {
    headers: { ...getApiHeaders() },
  })
  if (!res.ok) throw new Error(`Video status check failed: ${res.status}`)
  return res.json()
}

export async function generateVideo(params: {
  image_url: string
  prompt: string
  scene_number: number
  project_id: string
  aspect_ratio: string
}): Promise<{ video_url: string | null; job_id?: string; status?: string }> {
  const res = await fetch(`${WORKER_URL}/api/video/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getApiHeaders() },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const err = await res.json() as Record<string, unknown>
    throw new Error((err.message as string) || `Video generation failed: ${res.status}`)
  }
  return res.json()
}

export async function startVideoJob(params: {
  prompt: string
  image_url?: string
  scene_number: number
  project_id: string
  aspect_ratio: string
  duration_seconds: number
  seed?: number
  prompt_extend?: boolean
}): Promise<{ job_id: string; scene_number: number; status: string }> {
  const res = await fetch(`${WORKER_URL}/api/video/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getApiHeaders() },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const err = await res.json() as Record<string, unknown>
    throw new Error((err.error as string) || (err.message as string) || `Failed to start video job`)
  }
  return res.json()
}

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

export async function rewriteVO(params: {
  original_text: string
  duration_seconds: number
  language: string
  scene_context: string
  art_style: string
}): Promise<{ rewritten_text: string; char_count: number; char_limit: number; fits: boolean }> {
  const res = await fetch(`${WORKER_URL}/api/brain/rewrite-vo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getApiHeaders() },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error('VO rewrite failed')
  return res.json()
}

export async function regenerateVideoPrompt(params: {
  image_prompt: string
  enhanced_prompt?: string
  mood: string
  camera_angle: string
  scene_type: string
  duration_seconds: number
  narration: string
  art_style: string
  aspect_ratio: string
  scene_number: number
  brain_model?: string
}): Promise<{ video_prompt: VideoPromptData }> {
  const res = await fetch(`${WORKER_URL}/api/brain/regenerate-video-prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getApiHeaders() },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error('Video prompt regeneration failed')
  return res.json()
}

export async function callProviderBrain(
  systemPrompt: string,
  userPrompt: string,
  brainModel: string,
  userId?: string
): Promise<string> {
  const headers = { ...getApiHeaders(userId), 'Content-Type': 'application/json' }

  const res = await fetch(`${WORKER_URL}/api/brain/provider`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      brain_model: brainModel,
      system_prompt: systemPrompt,
      user_prompt: userPrompt,
      max_tokens: 4096,
    }),
  })

  if (!res.ok) {
    const err = await res.json() as { error: string }
    throw new Error(err.error || `Provider brain failed: ${res.status}`)
  }

  const data = await res.json() as { content: string }
  return data.content
}

export async function generateBrain(params: {
  story: string
  platform: string
  language: string
  tone: string
  totalScenes: number
  artStyle: string
  aspectRatio: string
  brainModel: string
  userId?: string
}): Promise<unknown> {
  const { brainModel, userId } = params
  const headers = getApiHeaders(userId)

  // Route: AWS Bedrock (us.*) → /api/brain/generate
  // Dashscope models → /api/dashscope/brain
  // All other models (Groq, GLM, Gemini, OpenRouter IDs) → /api/brain/provider
  const DASHSCOPE_BRAIN_MODELS = ['qwen3-max', 'qwen-plus', 'qwen-flash', 'qwen-turbo', 'qwq-plus', 'qwen3-235b-a22b']
  const isDashscopeBrain = DASHSCOPE_BRAIN_MODELS.includes(brainModel)
  
  let endpoint = '/api/brain/provider'
  if (brainModel.startsWith('us.')) {
    endpoint = '/api/brain/generate'
  } else if (isDashscopeBrain) {
    endpoint = '/api/dashscope/brain'
  }

  const res = await fetch(`${WORKER_URL}${endpoint}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      story: params.story,
      platform: params.platform,
      language: params.language,
      tone: params.tone,
      total_scenes: params.totalScenes,
      art_style: params.artStyle,
      aspect_ratio: params.aspectRatio,
      brain_model: brainModel,
    }),
  })

  if (!res.ok) {
    const err = await res.json() as { error: string }
    throw new Error(err.error || `Brain failed: ${res.status}`)
  }

  return res.json()
}

export async function generateAudio(params: {
  text: string
  language: string
  scene_number: number
  project_id: string
  engine?: 'polly' | 'elevenlabs'
  voice?: string
  stability?: number
  similarity_boost?: number
  style?: number
}): Promise<{ audio_url: string }> {
  const res = await fetch(`${WORKER_URL}/api/audio/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getApiHeaders() },
    body: JSON.stringify({ ...params, engine: params.engine || 'polly' }),
  })
  if (!res.ok) {
    const err = await res.json() as Record<string, unknown>
    throw new Error((err.error as string) || (err.message as string) || `Audio generation failed: ${res.status}`)
  }
  return res.json()
}
