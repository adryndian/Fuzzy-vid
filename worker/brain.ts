import { Env } from './index';

function getVoCharLimit(durationSeconds: number, language: string): number {
  const charsPerSecond = language === 'id' ? 15 : 18
  return Math.floor(durationSeconds * charsPerSecond)
}

const getSystemPrompt = (language: 'id' | 'en', avgDuration = 10) => `
You are an expert Creative Director and Visual Storyteller
specializing in short-form video content for YouTube Shorts,
Instagram Reels, and TikTok.

Think in cinematic sequences. Understand visual continuity,
camera language, and narrative arc.

CRITICAL DURATION RULES:
- Each scene has a specific duration in seconds
- The narration text (text_id and text_en) MUST fit within that duration
- Indonesian narration: maximum ${getVoCharLimit(avgDuration, 'id')} characters per scene
- English narration: maximum ${getVoCharLimit(avgDuration, 'en')} characters per scene
- Count characters carefully — shorter is better than longer
- Audio will be cut off if narration exceeds duration

STRICT RULES TO PREVENT HALLUCINATION:
- Only describe what CAN be visually shown in a single image frame
- Do NOT reference events that happened before/after the scene
- Do NOT mention sounds, music, or audio in image_prompt
- Each scene must be self-contained and visually coherent
- image_prompt must describe ONLY visible elements: lighting, composition, subjects, colors, camera angle
- text_id and text_en must match the EXACT scene duration
- NEVER invent historical facts not in the original story
- NEVER add characters or elements not mentioned in the story
- If unsure about a visual detail, describe it generically

VIDEO PROMPT RULES:
- video_prompt describes MOTION and ACTION, not static appearance
- It must be coherent with image_prompt (same scene, same subject)
- motion: camera movement (dolly, pan, tilt, zoom, static, handheld)
- subject_action: what subjects/objects are doing
- atmosphere: environmental motion (wind, particles, light changes)
- camera: shot type + movement style
- pacing: slow / medium / fast
- full_prompt: 1-2 sentence combined description, max 200 chars,
  optimized for Nova Reel / Wan2.1 i2v models
- full_prompt must START with camera movement, then subject

OUTPUT RULES:
- Return ONLY valid JSON. No markdown. No backticks. No explanation.
- Start your response with { and end with }
- Any text outside the JSON will break the parser.
- Use EXACTLY this JSON structure (no wrapper objects, scenes at root level):
{
  "title": "string",
  "platform": "string",
  "art_style": "string",
  "language": "string",
  "aspect_ratio": "string",
  "scenes": [
    {
      "scene_number": 1,
      "scene_type": "opening_hook",
      "duration_seconds": 6,
      "char_limit": ${getVoCharLimit(avgDuration, language)},
      "image_prompt": "string — always in English",
      "video_prompt": {
        "motion": "slow dolly forward",
        "subject_action": "merchant hands arranging colorful spices",
        "atmosphere": "dust particles floating in light shafts, fabric rippling",
        "camera": "steady cam, slight upward tilt",
        "pacing": "slow",
        "full_prompt": "Camera slowly dollies forward through ancient spice market, merchant hands arranging spices, golden dust particles drift through warm shafts of light"
      },
      "text_id": "string — Bahasa Indonesia narration",
      "text_en": "string — English narration",
      "mood": "string",
      "camera_angle": "string",
      "transition": "string"
    }
  ]
}
- scene_type must be one of: opening_hook, rising_action, climax, resolution
- Image prompts ALWAYS in English (cinematic, detailed visual description)
- Narasi voiceover in ${language}
- Every scene serves the story arc:
  Scene 1 → opening_hook (captures attention in 2 seconds)
  Middle scenes → rising_action / climax (builds tension)
  Final scene → resolution (closure + implicit CTA)
- Generate BOTH text_id (Bahasa Indonesia) AND text_en (English)
  even if narasi_language is set to one language
`;

export function buildBrainPrompts(body: Record<string, unknown>): {
  systemPrompt: string
  userPrompt: string
} {
  const { title, story, platform, language: narasi_language = 'en', art_style, total_scenes } = body as any
  const scene_durations = (body.scene_durations as number[]) || []
  const total_duration = (body.total_duration as number) || 60
  const avgDuration = scene_durations.length > 0
    ? total_duration / scene_durations.length
    : total_duration / ((total_scenes as number) || 5)

  const aspectRatioMap: Record<string, string> = {
    '9_16': '1080x1920 vertical (9:16) - optimized for mobile full screen',
    '16_9': '1920x1080 landscape (16:9) - optimized for desktop/TV',
    '1_1':  '1080x1080 square (1:1) - optimized for social feed',
    '4_5':  '864x1080 portrait (4:5) - optimized for Instagram feed',
  }
  const aspectRatio = (body.aspect_ratio as string) || '9_16'
  const resolution = (body.resolution as string) || '1080p'
  const frameSpec = aspectRatioMap[aspectRatio] || aspectRatioMap['9_16']

  const userPrompt = `Title: ${title}
Story: ${story}
Platform: ${platform}
Art Style: ${art_style}
Total Scenes: ${total_scenes}
Language: ${narasi_language}
Frame Specification: ${frameSpec}
Resolution: ${resolution}
Total Video Duration: ${total_duration} seconds

SCENE DURATION TARGETS:
${scene_durations.length > 0
  ? scene_durations.map((d: number, i: number) =>
      `Scene ${i + 1}: ${d}s → max ${getVoCharLimit(d, narasi_language)} chars narration`
    ).join('\n')
  : `Each scene: ~${Math.round(total_duration / ((total_scenes as number) || 5))}s → max ${getVoCharLimit(Math.round(total_duration / ((total_scenes as number) || 5)), narasi_language)} chars narration`
}

IMPORTANT: All image prompts must be composed for ${frameSpec}.
${aspectRatio === '9_16' ? 'Use vertical composition - subjects centered, portrait orientation.' : ''}
${aspectRatio === '16_9' ? 'Use horizontal composition - wide establishing shots, landscape orientation.' : ''}
${aspectRatio === '1_1' ? 'Use square composition - centered subjects, balanced framing.' : ''}
${aspectRatio === '4_5' ? 'Use portrait composition - slightly wider than phone screen.' : ''}`

  return { systemPrompt: getSystemPrompt(narasi_language, avgDuration), userPrompt }
}

async function callBedrock(creds: import('./index').Credentials, modelId: string, prompt: string, systemPrompt: string): Promise<string> {
  const region = creds.brainRegion || 'us-east-1'
  const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/invoke`
  
  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      { role: "user", content: prompt }
    ]
  })

  const { signRequest } = await import('./lib/aws-signature')
  const signedHeaders = await signRequest({
    method: 'POST',
    url: endpoint,
    region,
    service: 'bedrock',
    accessKeyId: creds.awsAccessKeyId,
    secretAccessKey: creds.awsSecretAccessKey,
    body,
    headers: { 'Content-Type': 'application/json' }
  })

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: signedHeaders,
    body
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Bedrock error ${res.status}: ${err}`)
  }

  const data = await res.json() as any
  return data.content[0].text
}

async function callBedrockLlama(creds: import('./index').Credentials, prompt: string, systemPrompt: string): Promise<string> {
  const region = creds.brainRegion || 'us-west-2'
  const modelId = 'us.meta.llama4-maverick-17b-instruct-v1:0'
  const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/invoke`

  const body = JSON.stringify({
    prompt: "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n"
      + systemPrompt
      + "<|eot_id|><|start_header_id|>user<|end_header_id|>\n"
      + prompt
      + "<|eot_id|><|start_header_id|>assistant<|end_header_id|>",
    max_gen_len: 8192,
    temperature: 0.7
  })

  const { signRequest } = await import('./lib/aws-signature')
  const signedHeaders = await signRequest({
    method: 'POST',
    url: endpoint,
    region,
    service: 'bedrock',
    accessKeyId: creds.awsAccessKeyId,
    secretAccessKey: creds.awsSecretAccessKey,
    body,
    headers: { 'Content-Type': 'application/json' }
  })

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: signedHeaders,
    body
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Llama error ${res.status}: ${err}`)
  }

  const data = await res.json() as any
  return data.generation
}

export async function handleBrainRequest(
  request: Request,
  env: Env,
  url: URL,
  ctx: ExecutionContext,
  creds: import('./index').Credentials
): Promise<Response> {
    const path = url.pathname;
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Gemini-Key, X-AWS-Access-Key-Id, X-AWS-Secret-Access-Key, X-Brain-Region, X-Image-Region, X-Audio-Region, X-ElevenLabs-Key, X-Runway-Key',
        'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        if (path.startsWith('/api/brain/generate')) {
            if (request.method !== 'POST') {
                return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            const body = await request.json() as any;
            const { brain_model: model } = body;
            const title = body.title
            const story = body.story

            const selectedModel = model || 'gemini'
            if (selectedModel === 'gemini' && !creds.geminiApiKey) {
              return Response.json({ error: 'Missing Gemini API Key', message: 'Please add your Gemini API Key in Settings' }, { status: 400, headers: corsHeaders })
            }
            if ((selectedModel === 'claude_sonnet' || selectedModel === 'llama4_maverick') && (!creds.awsAccessKeyId || !creds.awsSecretAccessKey)) {
              return Response.json({ error: 'Missing AWS Credentials', message: 'Please add your AWS credentials in Settings' }, { status: 400, headers: corsHeaders })
            }

            if (!title || !story || !model) {
                return new Response(JSON.stringify({ error: 'Bad Request', message: 'Missing title, story or brain_model' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            const { systemPrompt, userPrompt: promptWithContext } = buildBrainPrompts(body);
            let responseText: string

            if (model === 'claude_sonnet' || model === 'gemini') {
              // Use Claude as primary (also fallback for gemini when Gemini is down)
              responseText = await callBedrock(
                creds,
                'us.anthropic.claude-sonnet-4-6',
                promptWithContext,
                systemPrompt
              )
            } else if (model === 'llama4_maverick') {
              responseText = await callBedrockLlama(creds, promptWithContext, systemPrompt)
            } else {
              responseText = await callBedrock(
                creds,
                'us.anthropic.claude-sonnet-4-6',
                promptWithContext,
                systemPrompt
              )
            }

            // Strip markdown code fences the AI may have added
            let jsonText = responseText.trim()
            const fenced = jsonText.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/)
            if (fenced) jsonText = fenced[1].trim()

            // Validate parseable before sending
            try { JSON.parse(jsonText) } catch {
              return new Response(
                JSON.stringify({ error: 'Invalid JSON from AI', raw: jsonText.slice(0, 200) }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            }

            return new Response(jsonText, {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })

        } else if (path.startsWith('/api/brain/health')) {
            return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response('Not Found', { status: 404, headers: corsHeaders });

    } catch (error: any) {
        console.error('Error in brain handler:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error', message: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
}

export async function handleRegenerateVideoPrompt(
  request: Request,
  _env: Env,
  creds: import('./index').Credentials
): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-AWS-Access-Key-Id, X-AWS-Secret-Access-Key, X-Brain-Region, X-Dashscope-Api-Key',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const body = await request.json() as {
    image_prompt: string
    enhanced_prompt?: string
    mood: string
    camera_angle: string
    scene_type: string
    duration_seconds: number
    narration: string
    art_style: string
    aspect_ratio: string
    scene_number: number
    brain_model?: string
  }

  const systemPrompt = `You are an expert cinematographer and video director.
Generate a structured video_prompt object for a single scene in a short-form video.
Return ONLY valid JSON. No markdown. No backticks. No explanation.
Start your response with { and end with }.`

  const userPrompt = `Scene ${body.scene_number} details:
Image Prompt: ${body.image_prompt}
${body.enhanced_prompt ? `Enhanced Image Prompt: ${body.enhanced_prompt}` : ''}
Mood: ${body.mood}
Camera Angle: ${body.camera_angle}
Scene Type: ${body.scene_type}
Duration: ${body.duration_seconds} seconds
Narration: "${body.narration}"
Art Style: ${body.art_style}
Aspect Ratio: ${body.aspect_ratio}

Generate a video_prompt JSON for this scene. full_prompt must start with camera movement, max 200 chars, optimized for Nova Reel / Wan2.1 i2v.
Return ONLY this JSON structure:
{
  "video_prompt": {
    "motion": "camera movement type",
    "subject_action": "what subjects are doing",
    "atmosphere": "environmental motion elements",
    "camera": "shot type and movement style",
    "pacing": "slow|medium|fast",
    "full_prompt": "Camera [movement], [subject action], [atmosphere]"
  }
}`

  const brainModel = body.brain_model || 'claude_sonnet'

  const dashscopeModels: Record<string, string> = {
    qwen3_max: 'qwen3-max',
    qwen_plus: 'qwen-plus',
    qwen_flash: 'qwen-flash',
    qwen_turbo: 'qwen-turbo',
    qwq_plus: 'qwq-plus',
  }

  let responseText: string

  if (dashscopeModels[brainModel]) {
    if (!creds.dashscopeApiKey) {
      return Response.json({ error: 'Missing Dashscope API key' }, { status: 400, headers: corsHeaders })
    }
    const res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${creds.dashscopeApiKey}`,
      },
      body: JSON.stringify({
        model: dashscopeModels[brainModel],
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 400,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      return Response.json({ error: `Dashscope error: ${err}` }, { status: 500, headers: corsHeaders })
    }
    const data = await res.json() as any
    responseText = data.choices[0].message.content
  } else {
    responseText = await callBedrock(
      creds,
      'us.anthropic.claude-sonnet-4-6',
      userPrompt,
      systemPrompt
    )
  }

  let jsonText = responseText.trim()
  const fenced = jsonText.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/)
  if (fenced) jsonText = fenced[1].trim()

  try {
    const parsed = JSON.parse(jsonText)
    return Response.json(parsed, { headers: corsHeaders })
  } catch {
    return Response.json(
      { error: 'Invalid JSON from AI', raw: jsonText.slice(0, 200) },
      { status: 500, headers: corsHeaders }
    )
  }
}

export async function handleRewriteVO(
  request: Request,
  _env: Env,
  creds: import('./index').Credentials
): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-AWS-Access-Key-Id, X-AWS-Secret-Access-Key, X-Brain-Region',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const body = await request.json() as {
    original_text: string
    duration_seconds: number
    language: string
    scene_context: string
    art_style: string
  }

  const charLimit = body.language === 'id'
    ? Math.floor(body.duration_seconds * 15)
    : Math.floor(body.duration_seconds * 18)

  const systemPrompt = `You are an expert video narration writer.
Rewrite the given narration to fit exactly within ${body.duration_seconds} seconds.
Maximum ${charLimit} characters.
Keep the same meaning and emotional tone.
Return ONLY the rewritten text — no quotes, no explanation, no JSON.`

  const userPrompt = `Scene context: ${body.scene_context}
Original narration: "${body.original_text}"
Language: ${body.language === 'id' ? 'Indonesian' : 'English'}
Target duration: ${body.duration_seconds} seconds
Max characters: ${charLimit}

Rewrite to fit within ${charLimit} characters:`

  const region = creds.brainRegion || 'us-east-1'
  const modelId = 'us.anthropic.claude-sonnet-4-6'
  const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/invoke`

  const payload = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 200,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  })

  const { signRequest } = await import('./lib/aws-signature')
  const signedHeaders = await signRequest({
    method: 'POST',
    url: endpoint,
    region,
    service: 'bedrock',
    accessKeyId: creds.awsAccessKeyId,
    secretAccessKey: creds.awsSecretAccessKey,
    body: payload,
    headers: { 'Content-Type': 'application/json' }
  })

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: signedHeaders,
    body: payload
  })

  if (!res.ok) {
    return Response.json({ error: 'Rewrite failed' }, { status: 500, headers: corsHeaders })
  }

  const data = await res.json() as { content: [{ text: string }] }
  const rewritten = data.content[0].text.trim()

  return Response.json({
    rewritten_text: rewritten,
    char_count: rewritten.length,
    char_limit: charLimit,
    fits: rewritten.length <= charLimit
  }, { headers: corsHeaders })
}
