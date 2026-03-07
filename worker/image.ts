import type { Env, Credentials } from './index'
import { AwsV4Signer } from './lib/aws-signature'

const WORKER_URL = 'https://fuzzy-vid-worker.officialdian21.workers.dev'

interface ImageRequestBody {
  prompt: string
  scene_number: number
  project_id: string
  aspect_ratio: string
  art_style: string
  image_model?: 'nova_canvas' | 'sd35'
}

function getDimensions(aspect: string): { width: number; height: number } {
  switch (aspect) {
    case '16_9': return { width: 1280, height: 720 }
    case '1_1':  return { width: 1024, height: 1024 }
    case '4_5':  return { width: 896, height: 1120 }
    default:     return { width: 720, height: 1280 } // 9:16
  }
}


export async function handleEnhancePrompt(
  request: Request,
  _env: Env,
  creds: Credentials
): Promise<Response> {
  const body = await request.json() as {
    raw_prompt: string
    art_style: string
    aspect_ratio: string
    mood?: string
  }

  const systemPrompt = `You are an expert AI image prompt engineer specializing in cinematic visual storytelling.
Your job is to enhance image prompts for maximum quality output from AI image generators like Amazon Nova Canvas.

Rules:
- Keep the original scene/subject intact
- Add professional photography and cinematography technical terms
- Add lighting specifications
- Add camera and lens details
- Add quality modifiers
- Keep the enhanced prompt under 400 characters
- Return ONLY the enhanced prompt text, nothing else`

  const userPrompt = `Enhance this image prompt for ${body.art_style} style, ${body.aspect_ratio} aspect ratio, mood: ${body.mood || 'neutral'}:

"${body.raw_prompt}"

Add these types of technical terms as appropriate:
- Photography: depth of field, bokeh, rule of thirds, golden ratio
- Lighting: volumetric lighting, god rays, golden hour, rim light, chiaroscuro
- Camera: 85mm lens, wide angle, dutch angle, bird's eye view
- Quality: 8k UHD, photorealistic, highly detailed, sharp focus
- Style-specific terms for ${body.art_style}`

  const region = creds.brainRegion || 'us-east-1'
  const modelId = 'us.anthropic.claude-sonnet-4-6'
  const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/invoke`

  const payload = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const signer = new AwsV4Signer(
    { awsAccessKeyId: creds.awsAccessKeyId, awsSecretKey: creds.awsSecretAccessKey },
    region,
    'bedrock'
  )
  const req = new Request(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: payload,
  })
  const signedReq = await signer.sign(req)
  const res = await fetch(signedReq)

  if (!res.ok) {
    // Fallback: return original prompt with basic enhancement
    const basicEnhanced = `${body.raw_prompt}, ${body.art_style}, cinematic lighting, 8k UHD, highly detailed, sharp focus`
    return Response.json({ enhanced_prompt: basicEnhanced })
  }

  const data = await res.json() as { content: [{ text: string }] }
  const enhanced = data.content[0].text.trim()
  return Response.json({ enhanced_prompt: enhanced })
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
      const { prompt, scene_number, project_id, aspect_ratio, art_style, image_model } = body

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

      const isSd35 = image_model === 'sd35'
      const region = isSd35 ? 'us-west-2' : (creds.imageRegion || 'us-east-1')
      const modelId = isSd35 ? 'stability.sd3-5-large-v1:0' : 'amazon.nova-canvas-v1:0'
      // Use literal colon in URL — buildCanonicalUri encodes it to %3A in the canonical string.
      // Pre-encoding ':' as '%3A' in the URL causes AWS to double-encode it to %253A,
      // creating a signature mismatch.
      const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/invoke`
      const dims = getDimensions(aspect_ratio)

      const sd35AspectMap: Record<string, string> = {
        '9_16': '9:16', '16_9': '16:9', '1_1': '1:1', '4_5': '4:5',
      }
      const bedrockBody = isSd35
        ? JSON.stringify({
            prompt: `${art_style} style. ${prompt}`,
            mode: 'text-to-image',
            aspect_ratio: sd35AspectMap[aspect_ratio] || '9:16',
            output_format: 'jpeg',
          })
        : JSON.stringify({
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
              seed: Math.floor(Math.random() * 858993459),
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

      const ext = isSd35 ? 'jpg' : 'png'
      const r2Key = `projects/${project_id}/scene_${scene_number}/img_${Date.now()}.${ext}`
      await env.STORY_STORAGE.put(r2Key, imageBuffer, {
        httpMetadata: { contentType: isSd35 ? 'image/jpeg' : 'image/png' },
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
