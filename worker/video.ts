import { Env } from './index';
import { nanoid } from 'nanoid';
import { AwsV4Signer } from './lib/aws-signature';
import type { VideoModel } from '../src/types/schema';

interface VideoGenerationRequestBody {
  image_r2_key: string;
  model: VideoModel;
  project_id: string;
  scene_id: number;
}


async function generateVideoWithNovaReel(env: Env, imageR2Key: string, jobId: string, projectId: string, sceneId: number) {
  const outputR2Key = `projects/${projectId}/scene_${sceneId}/video_${Date.now()}.mp4`;

  const bedrockEndpoint = new URL('https://bedrock-runtime.us-east-1.amazonaws.com/model/amazon.nova-reel-v1:0/invoke');

  const payload = {
    "input_image_r2_key": imageR2Key,
    "output_r2_bucket": "igome-story-storage",
    "output_r2_key": outputR2Key,
  };

  const signer = new AwsV4Signer({
      awsAccessKeyId: env.AWS_ACCESS_KEY_ID,
      awsSecretKey: env.AWS_SECRET_ACCESS_KEY,
  }, 'us-east-1', 'bedrock');

  const request = new Request(bedrockEndpoint.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const signedRequest = await signer.sign(request);

  // Fire-and-forget background fetch
  return fetch(signedRequest)
    .then(async res => {
      if (!res.ok) {
        const errorBody = await res.text();
        console.error('Nova Reel Invocation Error:', errorBody);
        await env.JOB_STATUS.put(jobId, JSON.stringify({ status: 'failed', error: errorBody }), { expirationTtl: 3600 });
      } else {
        await env.JOB_STATUS.put(jobId, JSON.stringify({ status: 'done', videoR2Key: outputR2Key }), { expirationTtl: 3600 });
      }
    }).catch((err: any) => {
        console.error('Fetch error in Nova Reel background task:', err);
        env.JOB_STATUS.put(jobId, JSON.stringify({ status: 'failed', error: 'Failed to invoke Nova Reel model.' }), { expirationTtl: 3600 });
    });
}

export async function handleVideoRequest(request: Request, env: Env, url: URL, ctx: ExecutionContext) {
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
    if (path.startsWith('/api/video/generate')) {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const body = await request.json() as VideoGenerationRequestBody;
      const { image_r2_key, model, project_id, scene_id } = body;

      if (!image_r2_key || !model || !project_id || !scene_id) {
        return new Response(JSON.stringify({ error: 'Bad Request', message: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const jobId = `vid_${Date.now()}_${nanoid(6)}`;
      await env.JOB_STATUS.put(jobId, JSON.stringify({ status: 'generating' }), { expirationTtl: 3600 });

      if (model === 'nova_reel') {
        ctx.waitUntil(generateVideoWithNovaReel(env, image_r2_key, jobId, project_id, scene_id));
      } else {
        return new Response(JSON.stringify({ error: 'Not Implemented', message: `Model ${model} is not supported yet` }), { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }

      return new Response(JSON.stringify({ jobId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } else if (path.startsWith('/api/video/status/')) {
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
    console.error('Video handler error:', e);
    return new Response(JSON.stringify({ error: 'Internal Server Error', message: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}
