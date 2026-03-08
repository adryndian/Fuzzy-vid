// worker/handlers/siliconflow-image.ts
// SiliconFlow FLUX Image Generation (OpenAI-compatible images API)
// POST /api/image/siliconflow
// Free models: FLUX.1-schnell, FLUX.1-lite, stable-diffusion-3-5-large

export async function handleSiliconflowImage(request: Request, env: any, corsHeaders: Record<string, string>, workerUrl: string): Promise<Response> {
  const h = request.headers
  const siliconflowApiKey = h.get('X-Siliconflow-Api-Key') || env.SILICONFLOW_API_KEY || ''

  if (!siliconflowApiKey) {
    return Response.json({ error: 'SiliconFlow API key required' }, { status: 401, headers: corsHeaders })
  }

  const body: SiliconflowImageRequest = await request.json()
  const { prompt, model = 'black-forest-labs/FLUX.1-schnell', scene_number, project_id, image_size = '768x1280', negative_prompt } = body

  if (!prompt?.trim()) {
    return Response.json({ error: 'prompt is required' }, { status: 400, headers: corsHeaders })
  }

  // SiliconFlow Image API (OpenAI-compatible)
  const sfUrl = 'https://api.siliconflow.cn/v1/images/generations'

  const sfBody = {
    model: model,
    prompt: prompt,
    negative_prompt: negative_prompt || 'blurry, low quality, distorted, watermark, text',
    image_size: image_size,   // SiliconFlow format: "768x1280"
    batch_size: 1,
    num_inference_steps: model.includes('schnell') ? 4 : 20,  // schnell = 4 steps
    guidance_scale: model.includes('schnell') ? 0 : 7.5,
  }

  try {
    const sfRes = await fetch(sfUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${siliconflowApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sfBody)
    })

    if (!sfRes.ok) {
      const errData = await sfRes.json()
      console.error('SiliconFlow Image error:', errData)
      return Response.json({ error: 'SiliconFlow Image failed', details: errData }, { status: sfRes.status, headers: corsHeaders })
    }

    const sfData = await sfRes.json() as {
      data?: Array<{ url: string }>
      images?: Array<{ url: string }>
    }

    // SiliconFlow/OpenAI-compat returns: { data: [{ url: "..." }] } or sometimes { images: [...] }
    const imageUrl = sfData?.data?.[0]?.url || sfData?.images?.[0]?.url
    if (!imageUrl) {
      return Response.json({ error: 'No image URL from SiliconFlow', raw: sfData }, { status: 500, headers: corsHeaders })
    }

    // Download image dan re-upload ke R2 (SiliconFlow URLs expire)
    const imgRes = await fetch(imageUrl)
    const imgBuffer = await imgRes.arrayBuffer()

    const fileName = `images/${project_id || 'default'}/scene_${scene_number || 0}_sf_${Date.now()}.png`
    await env.STORY_STORAGE.put(fileName, imgBuffer, {
      httpMetadata: { contentType: 'image/png' }
    })
    const r2ImageUrl = `${workerUrl}/api/storage/file/${fileName}`

    // Parse dimensions dari image_size
    const [width, height] = image_size.split('x').map(Number)

    return Response.json({
      image_url: r2ImageUrl,
      engine: 'siliconflow',
      model: model,
      width: width || 768,
      height: height || 1280,
    }, { headers: corsHeaders })

  } catch (err) {
    console.error('SiliconFlow Image exception:', err)
    return Response.json({ error: 'SiliconFlow Image exception', message: String(err) }, { status: 500, headers: corsHeaders })
  }
}

interface SiliconflowImageRequest {
  prompt: string
  model?: string
  scene_number?: number
  project_id?: string
  image_size?: string     // format: "768x1280"
  negative_prompt?: string
}

// Available SiliconFlow Image Models:
// FREE:
//   black-forest-labs/FLUX.1-schnell   <- fastest (4 steps), gratis
//   Pro:
//   black-forest-labs/FLUX.1-dev       <- high quality
//   black-forest-labs/FLUX.1-pro       <- premium
//   stabilityai/stable-diffusion-3-5-large <- SD3.5
//   Kwai-Kolors/Kolors                  <- good for Asian faces/scenes