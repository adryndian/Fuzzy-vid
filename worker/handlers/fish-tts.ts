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

    // Upload ke R2
    const fileName = `audio/${project_id || 'default'}/scene_${scene_number || 0}_fish_${Date.now()}.mp3`
    await env.R2_BUCKET?.put(fileName, audioBuffer, {
      httpMetadata: { contentType: 'audio/mpeg' }
    })
    const audioUrl = `${env.R2_PUBLIC_URL}/${fileName}`

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
  // IMPORTANT: Replace these placeholder IDs dengan actual Fish Audio voice reference IDs
  // Dapatkan di: https://fish.audio → Browse Voices
  // Cari voices yang support Indonesian / multilingual

  const FISH_VOICES: Record<string, Record<string, string>> = {
    id: {
      documentary_viral:      'FISH_VOICE_ID_ID_MALE_PROFESSIONAL',    // Male, deep, authoritative
      narrative_storytelling: 'FISH_VOICE_ID_ID_FEMALE_WARM',          // Female, warm, narrative
      natural_genz:           'FISH_VOICE_ID_ID_YOUNG_CASUAL',          // Young, casual
      informative:            'FISH_VOICE_ID_ID_MALE_CLEAR',            // Male, clear
      product_ads:            'FISH_VOICE_ID_ID_FEMALE_ENERGETIC',      // Female, energetic
      educational:            'FISH_VOICE_ID_ID_FEMALE_PATIENT',        // Female, patient
      entertainment:          'FISH_VOICE_ID_ID_YOUNG_ENERGETIC',       // Young, fun
      motivational:           'FISH_VOICE_ID_ID_MALE_INSPIRING',        // Male, inspiring
      default:                'FISH_VOICE_ID_ID_DEFAULT'
    },
    en: {
      documentary_viral:      'FISH_VOICE_ID_EN_MALE_NEWS',
      narrative_storytelling: 'FISH_VOICE_ID_EN_FEMALE_NARRATIVE',
      natural_genz:           'FISH_VOICE_ID_EN_YOUNG_CASUAL',
      informative:            'FISH_VOICE_ID_EN_MALE_PROFESSIONAL',
      product_ads:            'FISH_VOICE_ID_EN_FEMALE_SALES',
      educational:            'FISH_VOICE_ID_EN_FEMALE_TEACHER',
      entertainment:          'FISH_VOICE_ID_EN_MALE_ENERGETIC',
      motivational:           'FISH_VOICE_ID_EN_FEMALE_COACH',
      default:                'FISH_VOICE_ID_EN_DEFAULT'
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