/// <reference types="vite/client" />

const WORKER_URL = 'https://fuzzy-vid-worker.officialdian21.workers.dev'

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

function getApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  try {
    const stored = localStorage.getItem('fuzzy_short_settings')
    if (stored) {
      const keys = JSON.parse(stored)
      if (keys.awsAccessKeyId)     headers['X-AWS-Access-Key-Id'] = keys.awsAccessKeyId
      if (keys.awsSecretAccessKey) headers['X-AWS-Secret-Access-Key'] = keys.awsSecretAccessKey
      if (keys.imageRegion)        headers['X-Image-Region'] = keys.imageRegion
      if (keys.audioRegion)        headers['X-Audio-Region'] = keys.audioRegion
      if (keys.elevenLabsApiKey)   headers['X-ElevenLabs-Key'] = keys.elevenLabsApiKey
    }
  } catch { /* ignore */ }
  return headers
}

export async function generateImage(params: {
  prompt: string
  scene_number: number
  project_id: string
  aspect_ratio: string
  art_style: string
  image_model?: 'nova_canvas' | 'titan_v2'
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

export async function generateVideo(params: {
  image_url: string
  prompt: string
  scene_number: number
  project_id: string
  aspect_ratio: string
}): Promise<{ video_url: string }> {
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

export async function generateAudio(params: {
  text: string
  language: string
  scene_number: number
  project_id: string
  engine?: 'polly' | 'elevenlabs'
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
