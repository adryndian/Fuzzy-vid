// worker/handlers/fish-tts.ts
// Fish Audio TTS — #1 TTS-Arena2, Indonesia support, emotion tags
// POST /api/audio/fish-tts

export async function handleFishTts(request: Request, env: any, corsHeaders: Record<string, string>): Promise<Response> {
  const h = request.headers

  const fishApiKey = h.get('X-FishAudio-Api-Key') || env.FISH_AUDIO_API_KEY || ''
  if (!fishApiKey) {
    return Response.json({ error: 'Fish Audio API key required' }, { status: 401, headers: corsHeaders })
  }

  const body: FishTtsRequest = await request.json()
  const { text, language = 'id', voice_id, tone, scene_number, project_id } = body

  if (!text || text.trim().length === 0) {
    return Response.json({ error: 'text is required' }, { status: 400, headers: corsHeaders })
  }

  // Select reference voice ID berdasarkan language + tone
  const selectedVoiceId = voice_id || selectFishVoice(language, tone || '')

  // Tambah emotion tag berdasarkan tone
  const processedText = addEmotionTag(text, tone || '')

  // Fish Audio TTS API
  // Docs: https://docs.fish.audio/text-to-speech/streaming-tts
  const fishUrl = 'https://api.fish.audio/v1/tts'

  const fishBody = {
    text: processedText,
    reference_id: selectedVoiceId,
    format: 'mp3',
    mp3_bitrate: 128,
    normalize: true,
    latency: 'normal'   // 'normal' atau 'balanced'
  }

  try {
    const fishRes = await fetch(fishUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${fishApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fishBody)
    })

    if (!fishRes.ok) {
      const errText = await fishRes.text()
      console.error('Fish Audio error:', fishRes.status, errText)
      return Response.json({ error: 'Fish Audio TTS failed', status: fishRes.status }, { status: fishRes.status, headers: corsHeaders })
    }

    // Fish Audio returns audio binary directly
    const audioBuffer = await fishRes.arrayBuffer()

    const WORKER_URL = 'https://fuzzy-vid-worker.officialdian21.workers.dev'

    // Upload ke R2
    const fileName = `audio/${project_id || 'default'}/scene_${scene_number || 0}_fish_${Date.now()}.mp3`
    await env.STORY_STORAGE.put(fileName, audioBuffer, {
      httpMetadata: { contentType: 'audio/mpeg' }
    })
    const audioUrl = `${WORKER_URL}/api/storage/file/${fileName}`

    return Response.json({
      audio_url: audioUrl,
      engine: 'fish-audio',
      voice_id: selectedVoiceId,
      language: language,
      text_length: processedText.length,
      estimated_duration: Math.ceil(text.split(' ').length / 3.0)
    }, { headers: corsHeaders })

  } catch (err) {
    console.error('Fish TTS exception:', err)
    return Response.json({ error: 'Fish TTS exception', message: String(err) }, { status: 500, headers: corsHeaders })
  }
}

// ─── VOICE SELECTION ───────────────────────────────────────────────
// Fish Audio Reference IDs — bisa diisi dengan voice ID dari fish.audio/voices
// User bisa clone voice sendiri (15 detik sample), tapi kita default ke preset

function selectFishVoice(language: string, tone: string): string {
  // Fish Audio Reference IDs — updated with valid public IDs
  // Adam: 7f92f8afb8ca427fa9063bc9dbf00de0 (Multilingual)
  // Bella: e58b1209487f4ad19bd701ca2dbfa928 (Warm)
  
  const FISH_VOICES: Record<string, Record<string, string>> = {
    id: {
      documentary_viral:      '7f92f8afb8ca427fa9063bc9dbf00de0',    // Adam
      narrative_storytelling: 'e58b1209487f4ad19bd701ca2dbfa928',    // Bella
      natural_genz:           'ad6010066cf44cc98eb6068cd66dbcc3',    // ID Female
      informative:            '7f92f8afb8ca427fa9063bc9dbf00de0',    
      product_ads:            'e58b1209487f4ad19bd701ca2dbfa928',
      educational:            'ad6010066cf44cc98eb6068cd66dbcc3',
      entertainment:          '7f92f8afb8ca427fa9063bc9dbf00de0',
      motivational:           'e58b1209487f4ad19bd701ca2dbfa928',
      default:                '7f92f8afb8ca427fa9063bc9dbf00de0'
    },
    en: {
      documentary_viral:      '7f92f8afb8ca427fa9063bc9dbf00de0',
      narrative_storytelling: 'e58b1209487f4ad19bd701ca2dbfa928',
      natural_genz:           '546abd3665a14317ade44e2142a2dca6',    // Antoni
      informative:            '7f92f8afb8ca427fa9063bc9dbf00de0',
      product_ads:            '546abd3665a14317ade44e2142a2dca6',
      educational:            'e58b1209487f4ad19bd701ca2dbfa928',
      entertainment:          '7f92f8afb8ca427fa9063bc9dbf00de0',
      motivational:           'e58b1209487f4ad19bd701ca2dbfa928',
      default:                '7f92f8afb8ca427fa9063bc9dbf00de0'
    }
  }

  const langVoices = FISH_VOICES[language] || FISH_VOICES['en']
  return langVoices[tone] || langVoices['default']
}

// ─── EMOTION TAG INJECTION ─────────────────────────────────────────
// Fish Audio supports emotion tags: (sad), (cheerful), (in a hurry), (angry), etc.

function addEmotionTag(text: string, tone: string): string {
  const emotionMap: Record<string, string> = {
    documentary_viral:      '(news reporter)',
    narrative_storytelling: '(storytelling)',
    natural_genz:           '(cheerful)',
    informative:            '(professional)',
    product_ads:            '(enthusiastic)',
    educational:            '(patient)',
    entertainment:          '(excited)',
    motivational:           '(inspiring)',
  }

  const tag = emotionMap[tone]
  if (!tag) return text
  return `${tag} ${text}`
}

interface FishTtsRequest {
  text: string
  language?: 'id' | 'en'
  voice_id?: string       // override auto-selection
  tone?: string
  scene_number?: number
  project_id?: string
}