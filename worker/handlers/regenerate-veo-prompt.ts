// worker/handlers/regenerate-veo-prompt.ts

import type { Env } from '../index'
import { getProviderForModel, getProviderApiKey, callProvider } from '../lib/providers'
import type { Tone, Language } from '../lib/brain-system-prompt'
import { VEO_SUBTONES, type VeoSubTone, getDefaultSubTone } from '../lib/veo-subtones'

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

  const subToneId = (body.sub_tone || getDefaultSubTone(body.tone)) as VeoSubTone
  const subToneDef = VEO_SUBTONES[subToneId]

  const systemPrompt = `You are a Google Veo 3.1 video prompt specialist.
Sub-tone: ${subToneDef?.label || 'Documentary'}
Camera style: ${subToneDef?.cameraStyle || 'Locked or handheld'}
Lighting: ${subToneDef?.lightingStyle || 'Natural'}
Human presence: ${subToneDef?.humanPresence || 'Required'}
Physics to include: ${subToneDef?.physicsElements.join(', ') || 'natural physics'}
Target duration: ${subToneDef?.durationRange[0]}-${subToneDef?.durationRange[1]} seconds

Generate Veo 3.1 prompt for the scene.
Respond ONLY with valid JSON:
{
  "sub_tone": "${subToneId}",
  "camera_locked": boolean,
  "camera_instruction": "string",
  "starting_frame": "string",
  "temporal_action": "After X second(s), [exact action]",
  "physics_detail": "string — specific and visual",
  "human_element": "string — specific body part or action",
  "full_veo_prompt": "string — complete ready-to-paste prompt, max 300 chars"
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

    // Read user-supplied key from request headers (same pattern as brain-provider.ts)
    const userKey = provider.id === 'gemini'
      ? (request.headers.get('X-Gemini-Api-Key') || request.headers.get('X-Gemini-Key') || '')
      : (request.headers.get(`X-${provider.id.charAt(0).toUpperCase() + provider.id.slice(1)}-Api-Key`) || '')
    const apiKey = userKey || getProviderApiKey(provider, env)
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
