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

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    const url = new URL(request.url)
    const path = url.pathname

    try {
      // Brain routes
      if (path === '/api/brain/generate' || path.startsWith('/api/brain/')) {
        const { handleBrainRequest } = await import('./brain')
        return handleBrainRequest(request, env, url, ctx)
      }

      // Image routes
      if (path.startsWith('/api/image/')) {
        const { handleImageRequest } = await import('./image')
        return handleImageRequest(request, env, url, ctx)
      }

      // Video routes
      if (path.startsWith('/api/video/')) {
        const { handleVideoRequest } = await import('./video')
        return handleVideoRequest(request, env, url, ctx)
      }

      // Audio routes
      if (path.startsWith('/api/audio/')) {
        const { handleAudioRequest } = await import('./audio')
        return handleAudioRequest(request, env, url, ctx)
      }

      // Project routes
      if (path.startsWith('/api/project/')) {
        const { handleProjectRequest } = await import('./project')
        return handleProjectRequest(request, env, url, ctx)
      }

      // Storage routes
      if (path.startsWith('/api/storage/')) {
        const { handleStorageRequest } = await import('./storage')
        return handleStorageRequest(request, env, url, ctx)
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
