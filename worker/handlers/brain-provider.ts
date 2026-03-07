// worker/handlers/brain-provider.ts
// Generic brain handler for all OpenAI-compat providers

import type { Env } from '../index'
import {
  getProviderForModel,
  getProviderApiKey,
  callProvider,
} from '../lib/providers'
import { buildBrainSystemPrompt, buildBrainUserPrompt, type Tone, type Language as BrainLanguage } from '../lib/brain-system-prompt'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Gemini-Key, X-Gemini-Api-Key, X-Groq-Api-Key, X-Openrouter-Api-Key, X-Glm-Api-Key',
}

export async function handleProviderBrain(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.json() as {
    brain_model: string          // e.g. "llama-3.3-70b-versatile" or "groq:llama-3.3-70b"
    // Option A: raw prompts (existing)
    system_prompt?: string
    user_prompt?: string
    // Option B: story params (new — brain builds prompts internally)
    story?: string
    platform?: string
    language?: BrainLanguage
    tone?: Tone
    total_scenes?: number
    art_style?: string
    aspect_ratio?: string
    // Common
    temperature?: number
    max_tokens?: number
    response_format?: { type: 'json_object' }
  }

  const { brain_model } = body

  let systemPrompt = body.system_prompt || ''
  let userPrompt = body.user_prompt || ''

  if (body.story && !body.system_prompt) {
    const totalScenes = Math.min(15, Math.max(1, body.total_scenes || 5))
    systemPrompt = buildBrainSystemPrompt({
      tone: body.tone || 'narrative_storytelling',
      language: body.language || 'id',
      platform: body.platform || 'TikTok',
      artStyle: body.art_style || 'cinematic_realistic',
      totalScenes,
      aspectRatio: body.aspect_ratio || '9_16',
    })
    userPrompt = buildBrainUserPrompt({
      story: body.story,
      platform: body.platform || 'TikTok',
      language: body.language || 'id',
      tone: body.tone || 'narrative_storytelling',
      totalScenes,
      artStyle: body.art_style || 'cinematic_realistic',
      aspectRatio: body.aspect_ratio || '9_16',
    })
  }

  // Find provider
  const provider = getProviderForModel(brain_model)
  if (!provider) {
    return Response.json(
      { error: `Unknown model: ${brain_model}. Supported: groq, openrouter, glm, gemini` },
      { status: 400, headers: corsHeaders }
    )
  }

  // Get API key — user header takes priority, env fallback OK for shared free-tier keys
  // Gemini accepts both X-Gemini-Api-Key (new standard) and X-Gemini-Key (legacy)
  const userKey = provider.id === 'gemini'
    ? (request.headers.get('X-Gemini-Api-Key') || request.headers.get('X-Gemini-Key') || '')
    : (request.headers.get(`X-${provider.id.charAt(0).toUpperCase() + provider.id.slice(1)}-Api-Key`) || '')
  const apiKey = userKey || getProviderApiKey(provider, env)
  if (!apiKey) {
    return Response.json(
      { error: `${provider.name} API key not configured. Add it in Settings.` },
      { status: 401, headers: corsHeaders }
    )
  }

  try {
    const content = await callProvider(
      provider,
      apiKey,
      brain_model,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        temperature: body.temperature,
        max_tokens: body.max_tokens || 4096,
        response_format: body.response_format,
      }
    )

    // Storyboard generation mode: parse the AI JSON and return it directly
    // (same format as /api/brain/generate — frontend expects scenes at top level)
    if (body.story && !body.system_prompt) {
      // Strip reasoning blocks (various formats), markdown fences, then extract JSON
      const clean = content
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/\[thinking\][\s\S]*?\[\/thinking\]/gi, '')
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim()
      // Find outermost JSON object — handles models that add preamble/postamble
      const firstBrace = clean.indexOf('{')
      const lastBrace = clean.lastIndexOf('}')
      if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error(`No JSON object found in response. Got: ${clean.slice(0, 200)}`)
      }
      const storyboardData = JSON.parse(clean.slice(firstBrace, lastBrace + 1))
      return Response.json(storyboardData, { headers: corsHeaders })
    }

    // Raw prompt mode (Settings test, Veo regen, etc.): return content wrapper
    return Response.json({ content, provider: provider.id, model: brain_model }, {
      headers: corsHeaders,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Provider call failed'
    return Response.json(
      { error: msg },
      { status: 500, headers: corsHeaders }
    )
  }
}
