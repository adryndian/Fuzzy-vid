// worker/handlers/brain-provider.ts
// Generic brain handler for all OpenAI-compat providers

import type { Env } from '../index'
import {
  getProviderForModel,
  getProviderApiKey,
  callProvider,
} from '../lib/providers'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Brain-Provider, X-Brain-Model',
}

export async function handleProviderBrain(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.json() as {
    brain_model: string          // e.g. "llama-3.3-70b-versatile" or "groq:llama-3.3-70b"
    system_prompt: string
    user_prompt: string
    temperature?: number
    max_tokens?: number
    response_format?: { type: 'json_object' }
  }

  const { brain_model, system_prompt, user_prompt } = body

  // Find provider
  const provider = getProviderForModel(brain_model)
  if (!provider) {
    return Response.json(
      { error: `Unknown model: ${brain_model}. Supported: groq, openrouter, glm, gemini` },
      { status: 400, headers: corsHeaders }
    )
  }

  // Get API key — user header takes priority, env fallback OK for shared free-tier keys
  const userKey = request.headers.get(`X-${provider.id.charAt(0).toUpperCase() + provider.id.slice(1)}-Api-Key`) || ''
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
        { role: 'system', content: system_prompt },
        { role: 'user', content: user_prompt },
      ],
      {
        temperature: body.temperature,
        max_tokens: body.max_tokens || 4096,
        response_format: body.response_format,
      }
    )

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
