import type { Env, Credentials } from './index'
import { AwsV4Signer } from './lib/aws-signature'

const WORKER_URL = 'https://fuzzy-vid-worker.officialdian21.workers.dev'

interface ImageRequestBody {
  prompt: string
  scene_number: number
  project_id: string
  aspect_ratio: string
  art_style: string
}

function getDimensions(aspect: string): { width: number; height: number } {
  switch (aspect) {
    case '16_9': return { width: 1280, height: 720 }
    case '1_1':  return { width: 1024, height: 1024 }
    case '4_5':  return { width: 896, height: 1120 }
    default:     return { width: 720, height: 1280 } // 9:16
  }
}

export async function handleImageRequest(
  request: Request,
  env: Env,
  url: URL,
  _ctx: ExecutionContext,
  creds: Credentials
): Promise<Response> {
  const path = url.pathname

  // POST /api/image/generate — synchronous Nova Canvas generation
  if (path === '/api/image/generate' && request.method === 'POST') {
    try {
      const body = await request.json() as ImageRequestBody
      const { prompt, scene_number, project_id, aspect_ratio, art_style } = body

      if (!prompt) {
        return Response.json(
          { error: 'Bad Request', message: 'Missing prompt' },
          { status: 400 }
        )
      }

      if (!creds.awsAccessKeyId || !creds.awsSecretAccessKey) {
        return Response.json(
          { error: 'Missing AWS credentials', message: 'Add AWS credentials in Settings' },
          { status: 400 }
        )
      }

      const region = creds.imageRegion || 'us-east-1'
      const modelId = 'amazon.nova-canvas-v1:0'
      const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/invoke`
      const dims = getDimensions(aspect_ratio)

      const bedrockBody = JSON.stringify({
        taskType: 'TEXT_IMAGE',
        textToImageParams: {
          text: `${art_style} style. ${prompt}`,
          negativeText: 'blurry, low quality, distorted, watermark, text overlay',
        },
        imageGenerationConfig: {
          numberOfImages: 1,
          height: dims.height,
          width: dims.width,
          cfgScale: 8.0,
          seed: Math.floor(Math.random() * 1000000),
        },
      })

      const signer = new AwsV4Signer(
        { awsAccessKeyId: creds.awsAccessKeyId, awsSecretKey: creds.awsSecretAccessKey },
        region,
        'bedrock'
      )
      const req = new Request(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: bedrockBody,
      })
      const signedReq = await signer.sign(req)
      const res = await fetch(signedReq)

      if (!res.ok) {
        const errText = await res.text()
        console.error('Nova Canvas error:', errText)
        return Response.json(
          { error: 'Image generation failed', message: errText.slice(0, 300) },
          { status: 502 }
        )
      }

      const data = await res.json() as { images: string[] }
      if (!data.images || !data.images[0]) {
        return Response.json(
          { error: 'No image returned from Nova Canvas' },
          { status: 502 }
        )
      }

      // Decode base64 and upload to R2
      const base64 = data.images[0]
      const byteString = atob(base64)
      const imageBuffer = new Uint8Array(byteString.length)
      for (let i = 0; i < byteString.length; i++) {
        imageBuffer[i] = byteString.charCodeAt(i)
      }

      const r2Key = `projects/${project_id}/scene_${scene_number}/img_${Date.now()}.png`
      await env.STORY_STORAGE.put(r2Key, imageBuffer, {
        httpMetadata: { contentType: 'image/png' },
      })

      const imageUrl = `${WORKER_URL}/api/storage/file/${r2Key}`
      return Response.json({ image_url: imageUrl })

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('Image handler error:', msg)
      return Response.json(
        { error: 'Internal Server Error', message: msg },
        { status: 500 }
      )
    }
  }

  return Response.json({ error: 'Not Found' }, { status: 404 })
}
