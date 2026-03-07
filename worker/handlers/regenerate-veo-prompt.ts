// worker/handlers/regenerate-veo-prompt.ts

import type { Env } from '../index'
import { getProviderForModel, getProviderApiKey, callProvider } from '../lib/providers'
import { AwsV4Signer } from '../lib/aws-signature'
import type { Tone } from '../lib/brain-system-prompt'
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

  try {
    let content: string

    // AWS Bedrock models (us.*) — use Bedrock API directly
    if (body.brain_model.startsWith('us.')) {
      content = await callBedrockForVeo(request, body.brain_model, systemPrompt, userPrompt)
    } else {
      // OpenAI-compatible providers (Gemini, Groq, OpenRouter, GLM)
      const provider = getProviderForModel(body.brain_model)
      if (!provider) {
        throw new Error(`Unknown model: ${body.brain_model}. Use an AWS Bedrock (us.*), Gemini, Groq, OpenRouter, or GLM model.`)
      }

      const userKey = provider.id === 'gemini'
        ? (request.headers.get('X-Gemini-Api-Key') || request.headers.get('X-Gemini-Key') || '')
        : (request.headers.get(`X-${provider.id.charAt(0).toUpperCase() + provider.id.slice(1)}-Api-Key`) || '')
      const apiKey = userKey || getProviderApiKey(provider, env)

      content = await callProvider(provider, apiKey, body.brain_model, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], { max_tokens: 512 })
    }

    // Parse JSON — strip reasoning think blocks + markdown fences
    const clean = content
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/```json|```/g, '')
      .trim()
    const parsed = JSON.parse(clean)

    return Response.json({ veo_prompt: parsed }, { headers: cors })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Veo prompt generation failed'
    return Response.json({ error: msg }, { status: 500, headers: cors })
  }
}

// Call AWS Bedrock (Claude) for Veo prompt generation
async function callBedrockForVeo(
  request: Request,
  modelId: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const awsKey = request.headers.get('X-AWS-Access-Key-Id') || ''
  const awsSecret = request.headers.get('X-AWS-Secret-Access-Key') || ''
  const region = request.headers.get('X-Brain-Region') || 'us-east-1'

  if (!awsKey || !awsSecret) {
    throw new Error('AWS credentials required for Bedrock model. Add them in Settings.')
  }

  const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/invoke`

  const payload = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const signer = new AwsV4Signer(
    { awsAccessKeyId: awsKey, awsSecretKey: awsSecret },
    region,
    'bedrock'
  )
  const req = new Request(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: payload,
  })
  const signedReq = await signer.sign(req)
  const res = await fetch(signedReq)

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Bedrock error ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json() as { content: [{ text: string }] }
  return data.content[0].text
}
