/// <reference types="vite/client" />
import type { VideoPromptData } from '../types/schema'

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
  const headers: Record<string, string> = {}
  try {
    // Try user-specific key first, fallback to shared legacy key
    const storageKey = userId ? `fuzzy_settings_${userId}` : 'fuzzy_short_settings'
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      const keys = JSON.parse(stored)
      if (keys.awsAccessKeyId)     headers['X-AWS-Access-Key-Id'] = keys.awsAccessKeyId
      if (keys.awsSecretAccessKey) headers['X-AWS-Secret-Access-Key'] = keys.awsSecretAccessKey
      if (keys.imageRegion)        headers['X-Image-Region'] = keys.imageRegion
      if (keys.audioRegion)        headers['X-Audio-Region'] = keys.audioRegion
      if (keys.elevenLabsApiKey)   headers['X-ElevenLabs-Key'] = keys.elevenLabsApiKey
      if (keys.dashscopeApiKey)    headers['X-Dashscope-Api-Key'] = keys.dashscopeApiKey
    }
  } catch { /* ignore */ }
  return headers
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
    throw new Error((err.message as string) || `Image generation failed: ${res.status}`)
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
    throw new Error((err.message as string) || `Failed to start video job`)
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
    throw new Error((err.message as string) || `Audio generation failed: ${res.status}`)
  }
  return res.json()
}
