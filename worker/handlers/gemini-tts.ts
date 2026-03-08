// worker/handlers/gemini-tts.ts
// Gemini 2.5 Flash TTS — gratis via existing Gemini API key
// POST /api/audio/gemini-tts

export async function handleGeminiTts(request: Request, env: any, corsHeaders: Record<string, string>): Promise<Response> {
  const h = request.headers

  // Get Gemini API key (user key atau env fallback)
  const geminiApiKey = h.get('X-Gemini-Api-Key') || h.get('X-Gemini-Key') || env.GEMINI_API_KEY || ''
  if (!geminiApiKey) {
    return Response.json({ error: 'Gemini API key required for TTS' }, { status: 401, headers: corsHeaders })
  }

  const body: GeminiTtsRequest = await request.json()
  const { text, language = 'id', voice_name, scene_number, project_id, tone } = body

  if (!text || text.trim().length === 0) {
    return Response.json({ error: 'text is required' }, { status: 400, headers: corsHeaders })
  }

  // Select voice berdasarkan language dan tone
  const voiceName = voice_name || selectGeminiVoice(language, tone || '')

  // Gemini TTS API call
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${geminiApiKey}`

  const geminiBody = {
    contents: [{
      parts: [{
        text: buildTtsPrompt(text, tone || '', language)
      }]
    }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voiceName
          }
        }
      }
    }
  }

  try {
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody)
    })

    if (!geminiRes.ok) {
      const errData = await geminiRes.json()
      console.error('Gemini TTS error:', errData)
      return Response.json({ error: 'Gemini TTS failed', details: errData }, { status: geminiRes.status, headers: corsHeaders })
    }

    const geminiData = await geminiRes.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: {
              data?: string
            }
          }>
        }
      }>
    }

    // Extract audio bytes from response
    const audioBase64 = geminiData?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
    if (!audioBase64) {
      return Response.json({ error: 'No audio data in Gemini response' }, { status: 500, headers: corsHeaders })
    }

    // Convert base64 to binary
    const audioBuffer = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0))

    const WORKER_URL = 'https://fuzzy-vid-worker.officialdian21.workers.dev'

    // Upload to R2
    const fileName = `audio/${project_id || 'default'}/scene_${scene_number || 0}_gemini_${Date.now()}.wav`
    await env.STORY_STORAGE.put(fileName, audioBuffer, {
      httpMetadata: { contentType: 'audio/wav' }
    })
    const audioUrl = `${WORKER_URL}/api/storage/file/${fileName}`

    return Response.json({
      audio_url: audioUrl,
      engine: 'gemini-tts',
      voice_used: voiceName,
      language: language,
      text_length: text.length,
      estimated_duration: Math.ceil(text.split(' ').length / 3.0)
    }, { headers: corsHeaders })

  } catch (err) {
    console.error('Gemini TTS exception:', err)
    return Response.json({ error: 'Gemini TTS exception', message: String(err) }, { status: 500, headers: corsHeaders })
  }
}

// ─── VOICE SELECTION ───────────────────────────────────────────────

function selectGeminiVoice(language: string, tone: string): string {
  // Gemini 2.5 Flash TTS voices (available in preview):
  // Kore, Charon, Fenrir, Aoede, Puck, Leda, Orus, Zephyr, Autonoe
  // Pilih berdasarkan tone karakteristik

  if (language === 'id') {
    // Indonesia — gunakan voice yang natural untuk Bahasa Indonesia
    switch (tone) {
      case 'documentary_viral':  return 'Charon'    // authoritative, deep
      case 'narrative_storytelling': return 'Aoede'  // warm, narrative
      case 'natural_genz':       return 'Puck'      // youthful, casual
      case 'informative':        return 'Kore'      // clear, professional
      case 'product_ads':        return 'Fenrir'    // confident, persuasive
      case 'educational':        return 'Kore'      // clear, patient
      case 'entertainment':      return 'Puck'      // energetic, fun
      case 'motivational':       return 'Aoede'     // warm, inspiring
      default:                   return 'Aoede'
    }
  }

  // English
  switch (tone) {
    case 'documentary_viral':  return 'Charon'
    case 'narrative_storytelling': return 'Aoede'
    case 'natural_genz':       return 'Puck'
    case 'informative':        return 'Kore'
    case 'product_ads':        return 'Fenrir'
    case 'educational':        return 'Kore'
    case 'entertainment':      return 'Zephyr'
    case 'motivational':       return 'Aoede'
    default:                   return 'Kore'
  }
}

// ─── TTS PROMPT BUILDER ────────────────────────────────────────────

function buildTtsPrompt(text: string, tone: string, language: string): string {
  // Gemini TTS bisa menerima instruksi style dalam teks
  const styleInstructions: Record<string, string> = {
    documentary_viral:      'Read this as a professional news narrator. Confident and authoritative.',
    narrative_storytelling: 'Read this as a storyteller. Warm, engaging, with emotional depth.',
    natural_genz:           'Read this casually and naturally, like talking to a friend.',
    informative:            'Read this clearly and professionally, like an expert explaining facts.',
    product_ads:            'Read this with enthusiasm and confidence. Persuasive but not pushy.',
    educational:            'Read this slowly and clearly, like a patient teacher.',
    entertainment:          'Read this energetically and with excitement.',
    motivational:           'Read this with warmth, inspiration, and genuine emotion.',
  }

  const style = styleInstructions[tone] || 'Read this naturally and clearly.'
  return `${style}\n\n${text}`
}

interface GeminiTtsRequest {
  text: string
  language?: 'id' | 'en'
  voice_name?: string
  scene_number?: number
  project_id?: string
  tone?: string
}