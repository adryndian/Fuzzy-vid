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

export async function handleBrainRequest(request: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response> {
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

            const { prompt, model, narasi_language = 'en' } = await request.json() as { prompt: string, model: string, narasi_language?: 'id' | 'en' };

            if (!prompt || !model) {
                return new Response(JSON.stringify({ error: 'Bad Request', message: 'Missing prompt or model' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            if (model === 'gemini') {
                const systemPrompt = getSystemPrompt(narasi_language);
                const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${env.GEMINI_API_KEY}`;

                const geminiPayload = {
                    contents: [
                        { parts: [{ text: systemPrompt }] },
                        { parts: [{ text: prompt }] }
                    ],
                    generationConfig: {
                        response_mime_type: "application/json",
                    }
                };

                const geminiRes = await fetch(geminiEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(geminiPayload)
                });

                if (!geminiRes.ok) {
                    const errorBody = await geminiRes.text();
                    console.error("Gemini API Error:", errorBody);
                    return new Response(JSON.stringify({ error: 'Gemini API Error', message: errorBody }), { status: geminiRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }

                const geminiData = await geminiRes.json() as any;
                const projectSchemaText = geminiData.candidates[0].content.parts[0].text;
                
                // The response is pure JSON, so we can return it directly.
                return new Response(projectSchemaText, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            return new Response(JSON.stringify({ error: 'Not Implemented', message: `Model ${model} is not supported yet` }), { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        } else if (path.startsWith('/api/brain/health')) {
            return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response('Not Found', { status: 404, headers: corsHeaders });

    } catch (error: any) {
        console.error('Error in brain handler:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error', message: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
}
