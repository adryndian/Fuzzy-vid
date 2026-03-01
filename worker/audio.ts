import type { Env, Credentials } from './index'
import { AwsV4Signer } from './lib/aws-signature'

const WORKER_URL = 'https://fuzzy-vid-worker.officialdian21.workers.dev'

interface AudioRequestBody {
  text: string
  language: string
  scene_number: number
  project_id: string
  engine?: 'polly' | 'elevenlabs'
}

export async function handleAudioRequest(
  request: Request,
  env: Env,
  url: URL,
  _ctx: ExecutionContext,
  creds: Credentials
): Promise<Response> {
  const path = url.pathname

  // POST /api/audio/generate — synchronous TTS
  if (path === '/api/audio/generate' && request.method === 'POST') {
    try {
      const body = await request.json() as AudioRequestBody
      const { text, language, scene_number, project_id, engine } = body

      if (!text) {
        return Response.json(
          { error: 'Bad Request', message: 'Missing text' },
          { status: 400 }
        )
      }

      let audioBuffer: ArrayBuffer

      if (engine === 'elevenlabs') {
        const apiKey = creds.elevenLabsApiKey || env.ELEVENLABS_API_KEY
        if (!apiKey) {
          return Response.json(
            { error: 'Missing ElevenLabs API key', message: 'Add ElevenLabs key in Settings' },
            { status: 400 }
          )
        }
        audioBuffer = await generateWithElevenLabs(text, language, apiKey)
      } else {
        // Default: Polly
        if (!creds.awsAccessKeyId || !creds.awsSecretAccessKey) {
          return Response.json(
            { error: 'Missing AWS credentials', message: 'Add AWS credentials in Settings' },
            { status: 400 }
          )
        }
        const region = creds.audioRegion || 'us-west-2'
        audioBuffer = await generateWithPolly(text, language, region, creds)
      }

      // Upload to R2
      const r2Key = `projects/${project_id}/scene_${scene_number}/audio_${Date.now()}.mp3`
      await env.STORY_STORAGE.put(r2Key, audioBuffer, {
        httpMetadata: { contentType: 'audio/mpeg' },
      })

      const audioUrl = `${WORKER_URL}/api/storage/file/${r2Key}`
      return Response.json({ audio_url: audioUrl })

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('Audio handler error:', msg)
      return Response.json(
        { error: 'Internal Server Error', message: msg },
        { status: 500 }
      )
    }
  }

  return Response.json({ error: 'Not Found' }, { status: 404 })
}

async function generateWithPolly(
  text: string,
  language: string,
  region: string,
  creds: Credentials
): Promise<ArrayBuffer> {
  const endpoint = `https://polly.${region}.amazonaws.com/v1/speech`

  // Pick voice based on language
  const voiceId = language === 'id' ? 'Andika' : 'Joanna'
  const langCode = language === 'id' ? 'id-ID' : 'en-US'

  const pollyBody = JSON.stringify({
    Engine: 'neural',
    LanguageCode: langCode,
    OutputFormat: 'mp3',
    Text: text,
    TextType: 'text',
    VoiceId: voiceId,
  })

  const signer = new AwsV4Signer(
    { awsAccessKeyId: creds.awsAccessKeyId, awsSecretKey: creds.awsSecretAccessKey },
    region,
    'polly'
  )
  const req = new Request(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: pollyBody,
  })
  const signedReq = await signer.sign(req)
  const res = await fetch(signedReq)

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Polly error: ${errText.slice(0, 300)}`)
  }

  return res.arrayBuffer()
}

async function generateWithElevenLabs(
  text: string,
  language: string,
  apiKey: string
): Promise<ArrayBuffer> {
  // Use a multilingual voice
  const voiceId = language === 'id' ? 'pNInz6obpgDQGcFmaJgB' : 'EXAVITQu4vr4xnSDxMaL'
  const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.7,
        similarity_boost: 0.75,
        style: 0.5,
        use_speaker_boost: true,
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`ElevenLabs error: ${errText.slice(0, 300)}`)
  }

  return res.arrayBuffer()
}
