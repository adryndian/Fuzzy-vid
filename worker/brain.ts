import { Env } from './index';

const getSystemPrompt = (language: 'id' | 'en') => `
You are an expert Creative Director and Visual Storyteller
specializing in short-form video content for YouTube Shorts,
Instagram Reels, and TikTok.

Think in cinematic sequences. Understand visual continuity,
camera language, and narrative arc.

OUTPUT RULES:
- Respond with PURE JSON only — no markdown, no explanation, no backticks
- Follow the ProjectSchema exactly — include ALL required fields
- Image prompts ALWAYS in English (YouMind Nano Banana Pro format)
- Narasi voiceover in ${language}
- Every scene serves the story arc:
  Scene 1 → opening_hook (captures attention in 2 seconds)
  Middle scenes → rising_action / climax (builds tension)
  Final scene → resolution (closure + implicit CTA)
- Generate BOTH text_id (Bahasa Indonesia) AND text_en (English)
  even if narasi_language is set to one language
`;

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
    prompt: `<|system|>${systemPrompt}<|end|><|user|>${prompt}<|end|><|assistant|>`,
    max_gen_len: 8192,
    temperature: 0.8
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
        'Access-Control-Allow-Headers': 'Content-Type',
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
            const { title, story, platform, brain_model: model, language: narasi_language = 'en', art_style, total_scenes } = body;

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

            const prompt = `
Title: ${title}
Story: ${story}
Platform: ${platform}
Art Style: ${art_style}
Total Scenes: ${total_scenes}
Language: ${narasi_language}
`;

            const aspectRatioMap: Record<string, string> = {
              '9:16': '1080x1920 vertical (9:16) - optimized for mobile full screen',
              '16:9': '1920x1080 landscape (16:9) - optimized for desktop/TV',
              '1:1': '1080x1080 square (1:1) - optimized for social feed',
              '4:5': '864x1080 portrait (4:5) - optimized for Instagram feed',
            }

            const aspectRatio = body.aspect_ratio || '9:16'
            const resolution = body.resolution || '1080p'
            const frameSpec = aspectRatioMap[aspectRatio] || aspectRatioMap['9:16']

            const promptWithContext = `
Title: ${title}
Story: ${story}
Platform: ${platform}
Art Style: ${art_style}
Total Scenes: ${total_scenes}
Language: ${narasi_language}
Frame Specification: ${frameSpec}
Resolution: ${resolution}

IMPORTANT: All image prompts must be composed for ${frameSpec}.
${aspectRatio === '9:16' ? 'Use vertical composition - subjects centered, portrait orientation.' : ''}
${aspectRatio === '16:9' ? 'Use horizontal composition - wide establishing shots, landscape orientation.' : ''}
${aspectRatio === '1:1' ? 'Use square composition - centered subjects, balanced framing.' : ''}
${aspectRatio === '4:5' ? 'Use portrait composition - slightly wider than phone screen.' : ''}
`;

            const systemPrompt = getSystemPrompt(narasi_language);
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

            return new Response(responseText, {
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
