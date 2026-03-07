// worker/handlers/regenerate-veo-prompt.ts

import type { Env } from '../index'
import { getProviderForModel, getProviderApiKey, callProvider } from '../lib/providers'
import type { Tone, Language } from '../lib/brain-system-prompt'

const cors = { 'Access-Control-Allow-Origin': '*' }

export async function handleRegenerateVeoPrompt(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.json() as {
    scene_number: number
    vo_script: string
    image_prompt: string
    tone: Tone
    language: Language
    platform: string
    brain_model: string
    sub_tone?: string
  }

  const systemPrompt = `You are a Google Veo 3.1 video prompt specialist.
Generate an optimized Veo 3.1 prompt for a single scene.
Respond ONLY with valid JSON, no markdown.

JSON schema:
{
  "camera_locked": boolean,
  "camera_instruction": "string",
  "starting_frame": "string",
  "temporal_action": "After X second(s), [what happens]",
  "physics_detail": "string",
  "human_element": "string",
  "full_veo_prompt": "string — max 300 chars, complete Veo 3.1 ready prompt"
}`

  const userPrompt = `Scene ${body.scene_number}
VO Script: "${body.vo_script}"
Visual Reference: "${body.image_prompt}"
Tone: ${body.tone}${body.sub_tone ? ` / ${body.sub_tone}` : ''}
Platform: ${body.platform}

Generate the Veo 3.1 prompt for this scene.`

  // Determine provider
  const provider = getProviderForModel(body.brain_model)

  try {
    if (!provider) {
      throw new Error(`Unknown model: ${body.brain_model}. Cannot generate Veo prompt.`)
    }

    const apiKey = getProviderApiKey(provider, env)
    const content = await callProvider(provider, apiKey, body.brain_model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { max_tokens: 512 })

    // Parse JSON — strip markdown fences if present
    const clean = content.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    return Response.json({ veo_prompt: parsed }, { headers: cors })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Veo prompt generation failed'
    return Response.json(
      { error: msg },
      { status: 500, headers: cors }
    )
  }
}
