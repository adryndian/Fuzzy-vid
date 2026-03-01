import { Env } from './index';
import { nanoid } from 'nanoid';

async function generateImageWithGemini(env: Env, imagePrompt: string, jobId: string) {
  const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/projects/fuzzy-pollen/locations/us-central1/publishers/google/models/imagen-3.0-generate-005:generateImage?key=${env.GEMINI_API_KEY}`;

  const geminiPayload = {
    "prompt": imagePrompt,
    "aspect_ratio": "9:16",
    "negative_prompt": "text, watermark, blur, distortion, lowres",
    "return_bytes": true,
  };

  fetch(geminiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(geminiPayload)
  }).then(async (res) => {
    if(!res.ok) {
        const errorBody = await res.text();
        console.error("Gemini Image Gen Error:", errorBody);
        await env.JOB_STATUS.put(jobId, JSON.stringify({ status: 'failed', error: errorBody }), { expirationTtl: 3600 });
    } else {
        const data = await res.json() as any;
        const imageBytes = data.images[0].image.b64_encoded;
        const imageBuffer = Uint8Array.from(atob(imageBytes), c => c.charCodeAt(0));

        const r2Key = `img_${Date.now()}.png`;

        try {
          await env.STORY_STORAGE.put(r2Key, imageBuffer, {
            httpMetadata: { contentType: 'image/png' },
          });
          await env.JOB_STATUS.put(jobId, JSON.stringify({ status: 'done', imageR2Key: r2Key }), { expirationTtl: 3600 });
        } catch (r2Error) {
          console.error("R2 Upload Error:", r2Error);
          await env.JOB_STATUS.put(jobId, JSON.stringify({ status: 'failed', error: 'Failed to upload image to storage.' }), { expirationTtl: 3600 });
        }
    }
  }).catch(err => {
      console.error('Fetch error in Gemini background task:', err);
      env.JOB_STATUS.put(jobId, JSON.stringify({ status: 'failed', error: 'Failed to invoke Gemini model.' }), { expirationTtl: 3600 });
  });
}

export async function handleImageRequest(request: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response> {
  const path = url.pathname;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (path.startsWith('/api/image/generate')) {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { image_prompt, model } = await request.json() as { image_prompt: string, model: string };

      if (!image_prompt || !model) {
        return new Response(JSON.stringify({ error: 'Bad Request', message: 'Missing image_prompt or model' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const jobId = `img_${Date.now()}_${nanoid(6)}`;
      await env.JOB_STATUS.put(jobId, JSON.stringify({ status: 'generating' }), { expirationTtl: 3600 });

      if (model === 'gemini') {
        ctx.waitUntil(generateImageWithGemini(env, image_prompt, jobId));
      } else {
        return new Response(JSON.stringify({ error: 'Not Implemented', message: `Model ${model} is not supported yet` }), { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }

      return new Response(JSON.stringify({ jobId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } else if (path.startsWith('/api/image/status/')) {
        if (request.method !== 'GET') {
            return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        const parts = path.split('/');
        const jobId = parts[parts.length - 1];
        
        const status = await env.JOB_STATUS.get(jobId);

        if (!status) {
            return new Response(JSON.stringify({ status: 'pending' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(status, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  } catch (e: any) {
    console.error('Image handler error:', e);
    return new Response(JSON.stringify({ error: 'Internal Server Error', message: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}
