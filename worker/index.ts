export interface Env {
  JOB_STATUS: KVNamespace;
  STORY_STORAGE: R2Bucket;
  GEMINI_API_KEY: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  RUNWAY_API_KEY: string;
  ELEVENLABS_API_KEY: string;
  ENVIRONMENT: string;
}

function getCredentials(request: Request, env: Env) {
  const h = request.headers
  return {
    ...env,
    geminiApiKey: h.get('X-Gemini-Key') || env.GEMINI_API_KEY,
    awsAccessKeyId: h.get('X-AWS-Access-Key-Id') || env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: h.get('X-AWS-Secret-Access-Key') || env.AWS_SECRET_ACCESS_KEY,
    awsRegion: h.get('X-AWS-Region') || 'us-east-1',
    r2AccountId: h.get('X-R2-Account-Id') || env.R2_ACCOUNT_ID,
    r2AccessKeyId: h.get('X-R2-Access-Key-Id') || env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: h.get('X-R2-Secret-Access-Key') || env.R2_SECRET_ACCESS_KEY,
    r2Bucket: h.get('X-R2-Bucket') || 'igome-story-storage',
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Gemini-Key, X-AWS-Access-Key-Id, X-AWS-Secret-Access-Key, X-AWS-Region, X-R2-Account-Id, X-R2-Access-Key-Id, X-R2-Secret-Access-Key, X-R2-Bucket',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    const url = new URL(request.url)
    const path = url.pathname
    
    const credentials = getCredentials(request, env)

    try {
      // Brain routes
      if (path === '/api/brain/generate' || path.startsWith('/api/brain/')) {
        const { handleBrainRequest } = await import('./brain')
        return handleBrainRequest(request, credentials as any, url, ctx)
      }

      // Image routes
      if (path.startsWith('/api/image/')) {
        const { handleImageRequest } = await import('./image')
        return handleImageRequest(request, credentials as any, url, ctx)
      }

      // Video routes
      if (path.startsWith('/api/video/')) {
        const { handleVideoRequest } = await import('./video')
        return handleVideoRequest(request, credentials as any, url, ctx)
      }

      // Audio routes
      if (path.startsWith('/api/audio/')) {
        const { handleAudioRequest } = await import('./audio')
        return handleAudioRequest(request, credentials as any, url, ctx)
      }

      // Project routes
      if (path.startsWith('/api/project/')) {
        const { handleProjectRequest } = await import('./project')
        return handleProjectRequest(request, credentials as any, url, ctx)
      }

      // Storage routes
      if (path.startsWith('/api/storage/')) {
        const { handleStorageRequest } = await import('./storage')
        return handleStorageRequest(request, credentials as any, url, ctx)
      }

      // Health check
      if (path === '/api/health' || path === '/') {
        return Response.json({ status: 'ok', worker: 'fuzzy-vid-worker' }, { headers: corsHeaders })
      }

      return Response.json({ error: 'Not Found', path }, { status: 404, headers: corsHeaders })

    } catch (error) {
      console.error('Worker error:', error)
      return Response.json(
        { error: 'Internal Server Error', message: String(error) },
        { status: 500, headers: corsHeaders }
      )
    }
  }
}
