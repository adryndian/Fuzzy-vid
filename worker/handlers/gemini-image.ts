// worker/handlers/gemini-image.ts
// Gemini 2.5 Flash Image Generation
// POST /api/image/gemini
// Free: 500 images/day at 1024x1024

export async function handleGeminiImage(request: Request, env: any, corsHeaders: Record<string, string>, workerUrl: string): Promise<Response> {
  const h = request.headers
  const geminiApiKey = h.get('X-Gemini-Api-Key') || h.get('X-Gemini-Key') || env.GEMINI_API_KEY || ''

  if (!geminiApiKey) {
    return Response.json({ error: 'Gemini API key required for image generation' }, { status: 401, headers: corsHeaders })
  }

  const body: GeminiImageRequest = await request.json()
  const { prompt, scene_number, project_id, aspect_ratio = '9:16', negative_prompt } = body

  if (!prompt?.trim()) {
    return Response.json({ error: 'prompt is required' }, { status: 400, headers: corsHeaders })
  }

  // Gemini Image Generation API
  // Model: gemini-2.0-flash-exp-image-generation OR imagen-3.0-generate-002
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${geminiApiKey}`

  // Build enhanced prompt dengan aspect ratio instruction
  const enhancedPrompt = buildGeminiImagePrompt(prompt, aspect_ratio, negative_prompt)

  const geminiBody = {
    contents: [{
      parts: [{ text: enhancedPrompt }]
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE']
    }
  }

  try {
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody)
    })

    if (!geminiRes.ok) {
      const errData = await geminiRes.json()
      console.error('Gemini Image error:', errData)
      return Response.json({ error: 'Gemini Image failed', details: errData }, { status: geminiRes.status, headers: corsHeaders })
    }

    const geminiData = await geminiRes.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: {
              mimeType?: string
              data?: string
            }
          }>
        }
      }>
    }

    // Extract image from response
    const parts = geminiData?.candidates?.[0]?.content?.parts || []
    const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'))

    if (!imagePart || !imagePart.inlineData?.data) {
      return Response.json({ error: 'No image in Gemini response', raw: geminiData }, { status: 500, headers: corsHeaders })
    }

    const imageBase64 = imagePart.inlineData.data
    const mimeType = imagePart.inlineData.mimeType || 'image/png'
    const ext = mimeType.split('/')[1] || 'png'

    // Convert base64 to binary
    const imageBuffer = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0))

    // Upload ke R2
    const fileName = `images/${project_id || 'default'}/scene_${scene_number || 0}_gemini_${Date.now()}.${ext}`
    await env.STORY_STORAGE.put(fileName, imageBuffer, {
      httpMetadata: { contentType: mimeType }
    })
    const imageUrl = `${workerUrl}/api/storage/file/${fileName}`

    return Response.json({
      image_url: imageUrl,
      engine: 'gemini-image',
      model: 'gemini-2.0-flash-exp-image-generation',
      width: 1024,
      height: 1024,
    }, { headers: corsHeaders })

  } catch (err) {
    console.error('Gemini Image exception:', err)
    return Response.json({ error: 'Gemini Image exception', message: String(err) }, { status: 500, headers: corsHeaders })
  }
}

function buildGeminiImagePrompt(prompt: string, aspectRatio: string, negativePrompt?: string): string {
  // Gemini image generation menggunakan instruksi teks biasa
  const aspectInstructions: Record<string, string> = {
    '9:16':  'Portrait/vertical orientation (9:16 ratio), suitable for mobile/TikTok.',
    '16:9':  'Landscape/horizontal orientation (16:9 ratio).',
    '1:1':   'Square composition (1:1 ratio).',
    '4:5':   'Portrait orientation (4:5 ratio), suitable for Instagram.',
  }

  const aspectInstruction = aspectInstructions[aspectRatio] || aspectInstructions['9:16']
  const negativeInstruction = negativePrompt ? `Avoid: ${negativePrompt}.` : ''

  return `Generate a high-quality cinematic image. ${aspectInstruction}

${prompt}

${negativeInstruction}
Style: Photorealistic, cinematic lighting, professional composition, high detail.`
}

interface GeminiImageRequest {
  prompt: string
  scene_number?: number
  project_id?: string
  aspect_ratio?: string
  negative_prompt?: string
}