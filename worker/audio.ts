import type { Env, Credentials } from './index'
import { AwsV4Signer } from './lib/aws-signature'

const WORKER_URL = 'https://fuzzy-vid-worker.officialdian21.workers.dev'

interface AudioRequestBody {
  text: string
  voice?: string            // optional: override voice ID
  language?: 'id' | 'en'   // detect language, default 'id'
  engine?: 'neural' | 'standard' | 'elevenlabs' | 'polly'  // updated to include all engines
  scene_number?: number     // for naming files in R2
  project_id?: string       // for path in R2
  tone?: string             // for log/debug
  stability?: number
  similarity_boost?: number
  style?: number
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
      const { text, language, scene_number, project_id, engine, voice } = body

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
        audioBuffer = await generateWithElevenLabs(text, language || 'id', apiKey, voice, {
          stability: body.stability,
          similarity_boost: body.similarity_boost,
          style: body.style,
        })
      } else {
        // Default: Polly
        if (!creds.awsAccessKeyId || !creds.awsSecretAccessKey) {
          return Response.json(
            { error: 'Missing AWS credentials', message: 'Add AWS credentials in Settings' },
            { status: 400 }
          )
        }
        const region = creds.audioRegion || 'us-west-2'
        audioBuffer = await generateWithPolly(text, language || 'id', region, creds, voice)
      }

      // Upload to R2
      const r2Key = `audio/${project_id || 'default'}/scene_${scene_number || 0}_polly_${Date.now()}.mp3`
      await env.STORY_STORAGE.put(r2Key, audioBuffer, {
        httpMetadata: { contentType: 'audio/mpeg' },
      })

      const audioUrl = `${WORKER_URL}/api/storage/file/${r2Key}`
      
      // Calculate word count and duration
      const wordCount = text.trim().split(/\s+/).length
      const estimatedDuration = Math.ceil(wordCount / 3.0)
      
      return Response.json({
        audio_url: audioUrl,
        voice_used: voice || (language === 'id' ? 'Permata' : 'Joanna'),
        language: language as 'id' | 'en',
        engine: engine || 'neural',
        text_length: text.length,
        estimated_duration: estimatedDuration
      })

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

// Voice metadata: LanguageCode + Engine for each supported voice
const POLLY_VOICE_LANG: Record<string, { lang: string; engine: 'generative' | 'neural' | 'standard' }> = {
  // Indonesian (id-ID) — neural and standard
  Permata: { lang: 'id-ID', engine: 'neural' },  // female neural voice for Indonesia
  Aruna:   { lang: 'id-ID', engine: 'standard' }, // female standard voice for Indonesia
  // English (en-US) — generative
  Ruth:     { lang: 'en-US', engine: 'generative' },
  Danielle: { lang: 'en-US', engine: 'generative' },
  // English (en-US) — neural
  Joanna:   { lang: 'en-US', engine: 'neural' },
  Kimberly: { lang: 'en-US', engine: 'neural' },
  Salli:    { lang: 'en-US', engine: 'neural' },
  Kendra:   { lang: 'en-US', engine: 'neural' },
  Matthew:  { lang: 'en-US', engine: 'neural' },
  Joey:     { lang: 'en-US', engine: 'neural' },
  Stephen:  { lang: 'en-US', engine: 'neural' },
  Gregory:  { lang: 'en-US', engine: 'neural' },
}

async function generateWithPolly(
  text: string,
  language: string,
  region: string,
  creds: Credentials,
  voice?: string
): Promise<ArrayBuffer> {
  const endpoint = `https://polly.${region}.amazonaws.com/v1/speech`

  // Select voice based on language and engine preference
  const selectedVoice = selectPollyVoice(language, voice)
  const voiceMeta = POLLY_VOICE_LANG[selectedVoice.VoiceId] || { lang: selectedVoice.LanguageCode, engine: 'neural' as const }

  const pollyBody = JSON.stringify({
    Text: text,
    OutputFormat: 'mp3',
    VoiceId: selectedVoice.VoiceId,
    LanguageCode: selectedVoice.LanguageCode,
    Engine: selectedVoice.Engine || 'neural',
    SampleRate: '22050'
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

function selectPollyVoice(language: string, voiceOverride?: string): { VoiceId: string; LanguageCode: string; Engine?: string } {
  if (voiceOverride) {
    // If voice is explicitly provided, use it
    const voiceMeta = POLLY_VOICE_LANG[voiceOverride]
    if (voiceMeta) {
      return {
        VoiceId: voiceOverride,
        LanguageCode: voiceMeta.lang,
        Engine: voiceMeta.engine
      }
    }
    // If invalid voice provided, fall back to language-based selection
  }

  if (language === 'id' || language === 'id-ID') {
    // Indonesia — use Indonesia-specific voices
    return {
      VoiceId: 'Permata',  // Default to neural voice for Indonesia
      LanguageCode: 'id-ID'
    }
  }
  
  // Default to English
  return {
    VoiceId: 'Joanna',  // Default English neural voice
    LanguageCode: 'en-US'
  }
}

const ELEVENLABS_VOICE_MAP: Record<string, string> = {
  // Verified voices
  Adam:    '29vD33N1zt5gjR81Q3oR',
  Rachel:  '21m00Tcm4TlvDq8ikWAM',
  Antoni:  'ErXwobaYiN019PkySvjV',
  Bella:   'EXAVITQu4vr4xnSDxMaL',
  // Additional voices
  Josh:    'TxGEqnHWrfWFTfGW9XjX',
  Arnold:  'VR6AewLTigWG4xSOukaG',
  Sam:     'yoZ06aMxZJJ28mfd3POQ',
  Elli:    'MF3mGyEYCl7XYWbV9V6O',
  Domi:    'AZnzlk1XvdvUeBnXmlld',
}

async function generateWithElevenLabs(
  text: string,
  language: string,
  apiKey: string,
  voice?: string,
  settings?: { stability?: number; similarity_boost?: number; style?: number }
): Promise<ArrayBuffer> {
  // Resolve voice ID: named voice → ID map, else fall back to language default
  const resolvedVoiceId = (voice && ELEVENLABS_VOICE_MAP[voice])
    ? ELEVENLABS_VOICE_MAP[voice]
    : (language === 'id' ? 'pNInz6obpgDQGcFmaJgB' : 'EXAVITQu4vr4xnSDxMaL')
  const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}`

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
        stability: settings?.stability ?? 0.7,
        similarity_boost: settings?.similarity_boost ?? 0.75,
        style: settings?.style ?? 0.5,
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
