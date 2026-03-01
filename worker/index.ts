import { handleBrainRequest } from './brain';
import { handleImageRequest } from './image';
import { handleVideoRequest } from './video';
import { handleAudioRequest } from './audio';
import { handleProjectRequest } from './project';
import { handleStorageRequest } from './storage';
import { corsHeaders } from './lib/cors';

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
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      if (pathname.startsWith('/api/brain')) {
        return handleBrainRequest(request, env, url, ctx);
      }
      if (pathname.startsWith('/api/image')) {
        return handleImageRequest(request, env, url, ctx);
      }
       if (pathname.startsWith('/api/video')) {
        return handleVideoRequest(request, env, url, ctx);
      }
       if (pathname.startsWith('/api/audio')) {
        return handleAudioRequest(request, env, url, ctx);
      }
       if (pathname.startsWith('/api/project')) {
        return handleProjectRequest(request, env, url, ctx);
      }
      if (pathname.startsWith('/api/storage')) {
        return handleStorageRequest(request, env, url, ctx);
      }
      
      return new Response(JSON.stringify({ error: 'Not Found', message: `Route ${pathname} not found` }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (e: any) {
        console.error('Main Worker Error:', e, e.stack);
        return new Response(JSON.stringify({ error: 'Internal Server Error', message: e.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  },
};
