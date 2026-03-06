import { verifyClerkJWT, ensureUser } from './lib/auth'
import type { ClerkUser } from './lib/auth'
import {
  handleGetProfile, handleUpdatePreferences,
  handleSaveApiKeys, handleGetDecryptedApiKeys,
  handleListStoryboards, handleSaveStoryboard, handleGetStoryboard, handleDeleteStoryboard,
  handleSaveSceneAsset,
  handleGetUsage,
  deductCredits, CREDIT_COSTS,
} from './db'

export interface Env {
  JOB_STATUS: KVNamespace;
  STORY_STORAGE: R2Bucket;
  ASSETS: { fetch: typeof fetch };
  DB: D1Database;
  GEMINI_API_KEY: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  RUNWAY_API_KEY: string;
  ELEVENLABS_API_KEY: string;
  DASHSCOPE_API_KEY: string;
  CLERK_SECRET_KEY: string;
  CLERK_JWKS_URL: string;
  R2_BUCKET_NAME?: string;
  ENVIRONMENT: string;
}

export interface Credentials {
  geminiApiKey: string
  awsAccessKeyId: string
  awsSecretAccessKey: string
  brainRegion: string
  imageRegion: string
  audioRegion: string
  videoRegion: string
  elevenLabsApiKey: string
  runwayApiKey: string
  dashscopeApiKey: string
  r2AccountId: string
  r2AccessKeyId: string
  r2SecretAccessKey: string
  r2Bucket: string
}

export function extractCredentials(request: Request, env: Env): Credentials {
  const h = request.headers
  return {
    geminiApiKey:        h.get('X-Gemini-Key')            || env.GEMINI_API_KEY          || '',
    awsAccessKeyId:     h.get('X-AWS-Access-Key-Id')      || env.AWS_ACCESS_KEY_ID       || '',
    awsSecretAccessKey: h.get('X-AWS-Secret-Access-Key')  || env.AWS_SECRET_ACCESS_KEY   || '',
    brainRegion:        h.get('X-Brain-Region')           || 'us-east-1',
    imageRegion:        h.get('X-Image-Region')           || 'us-east-1',
    audioRegion:        h.get('X-Audio-Region')           || 'us-west-2',
    videoRegion:        'us-east-1', // always fixed for Nova Reel
    elevenLabsApiKey:   h.get('X-ElevenLabs-Key')         || env.ELEVENLABS_API_KEY      || '',
    runwayApiKey:       h.get('X-Runway-Key')             || env.RUNWAY_API_KEY           || '',
    dashscopeApiKey:    h.get('X-Dashscope-Api-Key')      || env.DASHSCOPE_API_KEY        || '',
    r2AccountId:        h.get('X-R2-Account-Id')          || env.R2_ACCOUNT_ID            || '',
    r2AccessKeyId:      h.get('X-R2-Access-Key-Id')       || env.R2_ACCESS_KEY_ID         || '',
    r2SecretAccessKey:  h.get('X-R2-Secret-Access-Key')   || env.R2_SECRET_ACCESS_KEY     || '',
    r2Bucket:           h.get('X-R2-Bucket')              || 'igome-story-storage',
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Gemini-Key, X-AWS-Access-Key-Id, X-AWS-Secret-Access-Key, X-Brain-Region, X-Image-Region, X-Audio-Region, X-ElevenLabs-Key, X-Runway-Key, X-Dashscope-Api-Key, X-R2-Account-Id, X-R2-Access-Key-Id, X-R2-Secret-Access-Key, X-R2-Bucket',
      'Access-Control-Max-Age': '86400',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    const url = new URL(request.url)
    const path = url.pathname

    const creds = extractCredentials(request, env)
    let response: Response

    // ── Auth middleware for protected routes ──────────────────────────────
    let clerkUser: ClerkUser | null = null
    const isProtected = path.startsWith('/api/user') || path.startsWith('/api/storyboards')
    if (isProtected) {
      clerkUser = await verifyClerkJWT(request, env)
      if (!clerkUser) {
        response = Response.json({ error: 'Unauthorized' }, { status: 401 })
        const finalHeaders = new Headers(response.headers)
        Object.entries(corsHeaders).forEach(([k, v]) => finalHeaders.set(k, v))
        return new Response(response.body, { status: 401, headers: finalHeaders })
      }
      await ensureUser(env.DB, clerkUser)
    }

    // Optional auth for generation routes (for credit deduction)
    if (!clerkUser && (path.startsWith('/api/brain/') || path.startsWith('/api/image/') ||
        path.startsWith('/api/video/') || path.startsWith('/api/audio/') ||
        path.startsWith('/api/dashscope/'))) {
      clerkUser = await verifyClerkJWT(request, env)
    }

    try {
      // ── User / D1 routes ────────────────────────────────────────────────
      if (path === '/api/user/profile') {
        if (request.method === 'GET') {
          response = await handleGetProfile(env.DB, clerkUser!)
        } else if (request.method === 'PUT') {
          response = await handleUpdatePreferences(env.DB, clerkUser!, request)
        } else {
          response = Response.json({ error: 'Method not allowed' }, { status: 405 })
        }
      }
      else if (path === '/api/user/keys') {
        if (request.method === 'GET') {
          response = await handleGetDecryptedApiKeys(env.DB, clerkUser!, env.CLERK_SECRET_KEY)
        } else if (request.method === 'POST') {
          response = await handleSaveApiKeys(env.DB, clerkUser!, request, env.CLERK_SECRET_KEY)
        } else {
          response = Response.json({ error: 'Method not allowed' }, { status: 405 })
        }
      }
      else if (path === '/api/user/usage') {
        response = await handleGetUsage(env.DB, clerkUser!)
      }
      // ── Storyboard routes ────────────────────────────────────────────────
      else if (path === '/api/storyboards') {
        if (request.method === 'GET') {
          response = await handleListStoryboards(env.DB, clerkUser!)
        } else if (request.method === 'POST') {
          response = await handleSaveStoryboard(env.DB, clerkUser!, request)
        } else {
          response = Response.json({ error: 'Method not allowed' }, { status: 405 })
        }
      }
      else if (path.startsWith('/api/storyboards/') && path.includes('/scenes')) {
        if (request.method === 'POST') {
          response = await handleSaveSceneAsset(env.DB, clerkUser!, request)
        } else {
          response = Response.json({ error: 'Method not allowed' }, { status: 405 })
        }
      }
      else if (path.match(/^\/api\/storyboards\/[^/]+$/)) {
        const id = path.replace('/api/storyboards/', '')
        if (request.method === 'GET') {
          response = await handleGetStoryboard(env.DB, clerkUser!, id)
        } else if (request.method === 'DELETE') {
          response = await handleDeleteStoryboard(env.DB, clerkUser!, id)
        } else {
          response = Response.json({ error: 'Method not allowed' }, { status: 405 })
        }
      }
      // ── Brain routes ─────────────────────────────────────────────────────
      else if (path === '/api/brain/rewrite-vo') {
        const { handleRewriteVO } = await import('./brain')
        response = await handleRewriteVO(request, env, creds)
      }
      else if (path === '/api/brain/regenerate-video-prompt') {
        const { handleRegenerateVideoPrompt } = await import('./brain')
        response = await handleRegenerateVideoPrompt(request, env, creds)
      }
      else if (path === '/api/brain/generate' || path.startsWith('/api/brain/')) {
        if (clerkUser && env.DB) {
          const creditCheck = await deductCredits(env.DB, clerkUser.id, 'brain')
          if (!creditCheck.ok) {
            response = Response.json({ error: creditCheck.error || 'Insufficient credits' }, { status: 402 })
          } else {
            const { handleBrainRequest } = await import('./brain')
            response = await handleBrainRequest(request, env, url, ctx, creds)
          }
        } else {
          const { handleBrainRequest } = await import('./brain')
          response = await handleBrainRequest(request, env, url, ctx, creds)
        }
      }
      // ── Image routes ─────────────────────────────────────────────────────
      else if (path === '/api/image/enhance-prompt') {
        if (clerkUser && env.DB) {
          ctx.waitUntil(deductCredits(env.DB, clerkUser.id, 'enhance'))
        }
        const { handleEnhancePrompt } = await import('./image')
        response = await handleEnhancePrompt(request, env, creds)
      }
      else if (path.startsWith('/api/image/')) {
        const { handleImageRequest } = await import('./image')
        response = await handleImageRequest(request, env, url, ctx, creds)
        if (clerkUser && env.DB && response.ok) {
          ctx.waitUntil(deductCredits(env.DB, clerkUser.id, 'image'))
        }
      }
      // ── Video routes ─────────────────────────────────────────────────────
      else if (path === '/api/video/start') {
        const { handleVideoStart } = await import('./video')
        response = await handleVideoStart(request, env, url, ctx, creds)
        if (clerkUser && env.DB && response.ok) {
          ctx.waitUntil(deductCredits(env.DB, clerkUser.id, 'video'))
        }
      }
      else if (path.startsWith('/api/video/status/')) {
        const jobId = decodeURIComponent(path.replace('/api/video/status/', ''))
        const { handleVideoStatus } = await import('./video')
        response = await handleVideoStatus(request, env, jobId, creds)
      }
      else if (path.startsWith('/api/video/')) {
        const { handleVideoRequest } = await import('./video')
        response = await handleVideoRequest(request, env, url, ctx, creds)
      }
      // ── Dashscope routes ──────────────────────────────────────────────────
      else if (path === '/api/dashscope/brain') {
        if (clerkUser && env.DB) {
          const creditCheck = await deductCredits(env.DB, clerkUser.id, 'brain')
          if (!creditCheck.ok) {
            response = Response.json({ error: creditCheck.error || 'Insufficient credits' }, { status: 402 })
          } else {
            const { handleDashscopeBrain } = await import('./dashscope')
            response = await handleDashscopeBrain(request, env, creds)
          }
        } else {
          const { handleDashscopeBrain } = await import('./dashscope')
          response = await handleDashscopeBrain(request, env, creds)
        }
      }
      else if (path === '/api/dashscope/image/start') {
        const { handleDashscopeImageStart } = await import('./dashscope')
        response = await handleDashscopeImageStart(request, env, creds)
        if (clerkUser && env.DB && response.ok) {
          ctx.waitUntil(deductCredits(env.DB, clerkUser.id, 'image'))
        }
      }
      else if (path === '/api/dashscope/video/start') {
        const { handleDashscopeVideoStart } = await import('./dashscope')
        response = await handleDashscopeVideoStart(request, env, creds)
        if (clerkUser && env.DB && response.ok) {
          ctx.waitUntil(deductCredits(env.DB, clerkUser.id, 'video'))
        }
      }
      else if (path.startsWith('/api/dashscope/task/')) {
        const taskId = path.replace('/api/dashscope/task/', '')
        const { handleDashscopeTaskStatus } = await import('./dashscope')
        response = await handleDashscopeTaskStatus(request, env, taskId, creds)
      }
      // ── Audio routes ──────────────────────────────────────────────────────
      else if (path.startsWith('/api/audio/')) {
        const { handleAudioRequest } = await import('./audio')
        response = await handleAudioRequest(request, env, url, ctx, creds)
        if (clerkUser && env.DB && response.ok) {
          ctx.waitUntil(deductCredits(env.DB, clerkUser.id, 'audio'))
        }
      }
      // ── Project routes ────────────────────────────────────────────────────
      else if (path.startsWith('/api/project/')) {
        const { handleProjectRequest } = await import('./project')
        response = await handleProjectRequest(request, env, url, ctx, creds as any)
      }
      // ── Storage routes ────────────────────────────────────────────────────
      else if (path.startsWith('/api/storage/')) {
        const { handleStorageRequest } = await import('./storage')
        response = await handleStorageRequest(request, env, url, ctx, creds)
      }
      // ── Health check ──────────────────────────────────────────────────────
      else if (path === '/api/health') {
        response = Response.json({ status: 'ok', worker: 'fuzzy-vid-worker' })
      }
      // ── API 404 ───────────────────────────────────────────────────────────
      else if (path.startsWith('/api/')) {
        response = Response.json({ error: 'Not Found', path }, { status: 404 })
      }
      // ── SPA fallback ──────────────────────────────────────────────────────
      else {
        response = await env.ASSETS.fetch(new Request(new URL('/', request.url), request))
      }
    } catch (error) {
      console.error('Worker error:', error)
      response = Response.json(
        { error: 'Internal Server Error', message: String(error) },
        { status: 500 }
      )
    }

    const finalHeaders = new Headers(response.headers)
    Object.entries(corsHeaders).forEach(([key, value]) => {
      finalHeaders.set(key, value)
    })

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: finalHeaders,
    })
  }
}
