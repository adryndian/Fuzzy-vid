// worker/handlers/cf-flux.ts
// Cloudflare Workers AI — FLUX Image Generation
// POST /api/image/cf-flux
// FREE: 10,000 requests/day (included in Workers free tier)
// No user API key needed — uses internal CF AI binding

export async function handleCfFlux(request: Request, env: any, corsHeaders: Record<string, string>, workerUrl: string): Promise<Response> {
  // Check if CF AI binding exists
  if (!env.AI) {
    return Response.json({
      error: 'Cloudflare AI binding not configured. Add [ai] to wrangler.toml.'
    }, { status: 503, headers: corsHeaders })
  }

  try {
    const body: CfFluxRequest = await request.json()
    const { prompt, scene_number, project_id, aspect_ratio = '9:16', negative_prompt } = body

    if (!prompt?.trim()) {
      return Response.json({ error: 'prompt is required' }, { status: 400, headers: corsHeaders })
    }

    // Map aspect ratio ke width/height
    const { width, height } = getFluxDimensions(aspect_ratio)

    // CF Workers AI FLUX inference
    // Model: @cf/black-forest-labs/flux-1-schnell (fastest, free)
    const response = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', {
      prompt: prompt,
      negative_prompt: negative_prompt || 'blurry, low quality, distorted, watermark',
      width: width,
      height: height,
      num_steps: 4,    // schnell = 4 steps
    })

    if (!response) {
      return Response.json({ error: 'No image from CF AI' }, { status: 500, headers: corsHeaders })
    }

    // Workers AI image output can be a Response, Uint8Array, or ReadableStream.
    // Convert everything to a Blob which R2 definitely accepts.
    let imageBlob: Blob
    if (response instanceof Response) {
      imageBlob = await response.blob()
    } else if (response instanceof ReadableStream) {
      const arrayBuffer = await new Response(response).arrayBuffer()
      imageBlob = new Blob([arrayBuffer], { type: 'image/png' })
    } else {
      // response is usually Uint8Array
      imageBlob = new Blob([response], { type: 'image/png' })
    }

    // Upload ke R2
    const fileName = `images/${project_id || 'default'}/scene_${scene_number || 0}_cfflux_${Date.now()}.png`
    await env.STORY_STORAGE.put(fileName, imageBlob, {
      httpMetadata: { contentType: 'image/png' }
    })
    
    const imageUrl = `${workerUrl}/api/storage/file/${fileName}`

    return Response.json({
      image_url: imageUrl,
      engine: 'cf-flux',
      model: '@cf/black-forest-labs/flux-1-schnell',
      width: width,
      height: height,
    }, { headers: corsHeaders })

  } catch (err: any) {
    console.error('CF FLUX exception:', err)
    return Response.json({ 
      error: 'CF FLUX exception', 
      message: err.message || String(err)
    }, { status: 500, headers: corsHeaders })
  }
}

function getFluxDimensions(aspectRatio: string): { width: number; height: number } {
  const dimensions: Record<string, { width: number; height: number }> = {
    '9:16':  { width: 768,  height: 1344 },  // Mobile/TikTok
    '16:9':  { width: 1344, height: 768  },  // Landscape
    '1:1':   { width: 1024, height: 1024 },  // Square
    '4:5':   { width: 896,  height: 1120 },  // Instagram
  }
  return dimensions[aspectRatio] || dimensions['9:16']
}

interface CfFluxRequest {
  prompt: string
  scene_number?: number
  project_id?: string
  aspect_ratio?: string
  negative_prompt?: string
}
