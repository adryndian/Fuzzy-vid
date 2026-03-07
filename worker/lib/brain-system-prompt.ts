// worker/lib/brain-system-prompt.ts
// Master system prompt for ALL brain providers

export type Tone =
  | 'documentary_viral'
  | 'natural_genz'
  | 'informative'
  | 'narrative_storytelling'
  | 'product_ads'
  | 'educational'
  | 'entertainment'
  | 'motivational'

export type Language = 'id' | 'en'

export type MovementType =
  | 'pull_back'
  | 'push_in'
  | 'pan_left'
  | 'pan_right'
  | 'tilt_up'
  | 'tilt_down'
  | 'static_hero'
  | 'orbit'
  | 'whip_pan'
  | 'slow_zoom_in'
  | 'handheld_follow'
  | 'locked_observe'

export type EnergyLevel = 'slow' | 'medium' | 'fast'

// ─── TONE DEFINITIONS ─────────────────────────────────────────────

const TONE_DEFINITIONS: Record<Tone, {
  label: string
  voStyle: string
  videoStyle: string
  keywords: string[]
}> = {
  documentary_viral: {
    label: 'Documentary Viral',
    voStyle: 'journalistic, factual, compelling. Short punchy sentences. Real events, real people.',
    videoStyle: 'Veo 3.1 optimized. Locked or handheld camera. Human presence required every scene. Physics realism (water, dust, fabric, light). Temporal sequencing ("After X seconds..."). No over-dramatization.',
    keywords: ['viral', 'nyata', 'kisah', 'berita', 'real', 'breaking', 'terjadi', 'faktanya'],
  },
  natural_genz: {
    label: 'Natural Gen Z',
    voStyle: 'Conversational, relatable, casual. Mix of English/Indonesian slang where natural. No stiff corporate language. Sounds like a friend talking.',
    videoStyle: 'Vertical-first, casual handheld. Quick reframes. Authentic moments. Phone screens, sneakers, urban details. Raw and real, not polished.',
    keywords: ['guys', 'literally', 'no cap', 'bestie', 'vibes', 'real talk', 'fr fr', 'gaskeun'],
  },
  informative: {
    label: 'Informative',
    voStyle: 'Clear, factual, structured. Use numbers and specifics. "First... Second... The fact is...". Educational but engaging.',
    videoStyle: 'Clean static shots. Explainer-style framing. Product/object centered. Hands demonstrating. Even soft lighting. No distractions.',
    keywords: ['faktanya', 'tahukah', 'data', 'riset', 'terbukti', 'fact', 'research', 'studies show'],
  },
  narrative_storytelling: {
    label: 'Narrative Storytelling',
    voStyle: 'Story arc: setup, conflict, resolution. Character-driven. Emotional beats. "It started when... Then one day... Today...',
    videoStyle: 'Cinematic movement. Establishing → detail → close-up. Emotional lighting (golden hour, shadows). Character-focused.',
    keywords: ['cerita', 'kisah', 'story', 'journey', 'perjuangan', 'bermula', 'akhirnya', 'mengubah'],
  },
  product_ads: {
    label: 'Product Ads',
    voStyle: 'Benefit-focused, persuasive, clear CTA. Hook in first sentence. Problem → Solution → Call to action.',
    videoStyle: 'Hero product shots. Premium lighting. Brand color consistent. Clean transitions. Product in use.',
    keywords: ['produk', 'beli', 'dapatkan', 'limited', 'sale', 'discount', 'terbaik', 'pilihan'],
  },
  educational: {
    label: 'Educational',
    voStyle: 'Step-by-step, clear explanation. Use analogies. "Imagine... Think of it as... Here is why..."',
    videoStyle: 'Diagram-friendly framing. Process visualization. Before/after. Demonstration shots.',
    keywords: ['cara', 'how to', 'tips', 'tutorial', 'belajar', 'langkah', 'pelajaran', 'kenapa'],
  },
  entertainment: {
    label: 'Entertainment',
    voStyle: 'Energetic, fun, surprising. Humor where appropriate. Unexpected twists. High energy throughout.',
    videoStyle: 'Dynamic movement. Quick cuts implied. Fun angles. Reactions and expressions. Bright lighting.',
    keywords: ['lucu', 'keren', 'wow', 'shocking', 'amazing', 'epic', 'unexpected', 'seru'],
  },
  motivational: {
    label: 'Motivational',
    voStyle: 'Empowering, direct, emotional. "You can... It is possible... The moment you decide..." Strong verbs.',
    videoStyle: 'Uplifting visuals. Tilt up shots. Golden hour dominant. Achievement moments. Human triumph.',
    keywords: ['bisa', 'mampu', 'bangkit', 'sukses', 'you can', 'believe', 'achieve', 'possible'],
  },
}

// ─── MOVEMENT TAXONOMY ────────────────────────────────────────────

const MOVEMENT_GUIDE = `
MOVEMENT TYPE SELECTION GUIDE (pick ONE based on VO keywords):
- pull_back    → reveal, grow, expand, "dari kecil jadi besar", journey
- push_in      → focus, detail, intimate, secret, important detail
- pan_left/right → travel, transition, "dari X ke Y", across locations
- tilt_up      → hope, achievement, future, pride, "akhirnya", success
- tilt_down    → detail, grounding, precision, product close-up
- static_hero  → strong statement, impact, product showcase, pause moment
- orbit        → premium, 360 view, luxury, all-angle reveal
- whip_pan     → energy, speed, action, modern, fast-paced
- slow_zoom_in → drama, emotion, important moment, tension building
- handheld_follow → documentary, authentic, following action, chase
- locked_observe → observation, waiting, ambient scene, time passing
`

// ─── MASTER SYSTEM PROMPT BUILDER ─────────────────────────────────

export function buildBrainSystemPrompt(params: {
  tone: Tone
  language: Language
  platform: string
  artStyle: string
  totalScenes: number
  aspectRatio: string
}): string {
  const { tone, language, platform, artStyle, totalScenes, aspectRatio } = params
  const toneDef = TONE_DEFINITIONS[tone] || TONE_DEFINITIONS.narrative_storytelling
  const isVeoTone = ['documentary_viral', 'natural_genz', 'informative', 'narrative_storytelling'].includes(tone)
  const langInstruction = language === 'id'
    ? 'Write ALL vo_script in BAHASA INDONESIA. Write ALL image_prompt and video prompts in ENGLISH.'
    : 'Write ALL vo_script in ENGLISH. Write ALL image_prompt and video prompts in ENGLISH.'

  return `You are an expert short-form video storyboard creator.
You generate COMPLETE storyboard JSON for ${platform} short videos.
Target aspect ratio: ${aspectRatio === '9_16' ? '9:16 vertical' : '16:9 horizontal'}.
Visual style: ${artStyle}.

## LANGUAGE RULE
${langInstruction}

## TONE: ${toneDef.label}
VO Style: ${toneDef.voStyle}
Visual Style: ${toneDef.videoStyle}

## CRITICAL VO RULES
1. Each vo_script MUST be MAX 22 WORDS (enforced — do not exceed)
2. Count words carefully. vo_word_count must be accurate.
3. vo_duration_sec = Math.ceil(vo_word_count / 3) — always between 3-8
4. VO must DIRECTLY match what is happening visually in that scene
5. No filler words. Every word must earn its place.

## MOVEMENT TYPES
${MOVEMENT_GUIDE}

## VIDEO PROMPT RULES
1. full_prompt MAX 200 characters
2. Include "X seconds" at the end matching vo_duration_sec
3. Describe ONE primary movement only — no complex multi-movement
4. Include at least ONE physics detail (steam, dust, fabric, water, light, wind)
5. Human element MUST appear in at least 60% of scenes
6. Match energy level to VO emotional tone:
   - Urgent/exciting VO → fast energy, whip_pan or push_in
   - Emotional/slow VO → slow energy, tilt_up or pull_back
   - Factual/neutral VO → medium energy, static_hero or pan

${isVeoTone ? `
## VEO 3.1 PROMPT (veo_prompt field — REQUIRED for this tone)
Generate veo_prompt for EACH scene optimized for Google Veo 3.1.
Rules:
- camera_locked: true = absolutely no camera movement
- temporal_action: describe EXACTLY what happens after how many seconds
  Format: "After X second(s), [what happens]"
- physics_detail: specific physics (water droplets, dust particles, fabric ripple, etc)
- human_element: specific human body part or action visible in scene
- full_veo_prompt: complete Veo 3.1 ready prompt, max 300 chars
  Must include: camera instruction, starting frame, action sequence, duration
` : ''}

## JSON OUTPUT SCHEMA
Respond ONLY with valid JSON. No markdown, no explanation, no backticks.

{
  "title": "string — compelling video title",
  "hook": "string — single hook sentence that grabs attention",
  "platform": "${platform}",
  "tone": "${tone}",
  "language": "${language}",
  "total_scenes": ${totalScenes},
  "estimated_duration_sec": number,
  "scenes": [
    {
      "scene_number": 1,
      "vo_script": "string — max 22 words, ${language === 'id' ? 'Bahasa Indonesia' : 'English'}",
      "vo_word_count": number,
      "vo_duration_sec": number,
      "scene_purpose": "hook|buildup|conflict|reveal|resolution|cta",
      "image_prompt": "string — detailed visual description, English, include art style, lighting, composition, 100-200 chars",
      "video_prompt": {
        "duration_sec": number,
        "movement_type": "one of: pull_back|push_in|pan_left|pan_right|tilt_up|tilt_down|static_hero|orbit|whip_pan|slow_zoom_in|handheld_follow|locked_observe",
        "energy": "slow|medium|fast",
        "subject_motion": "string — what the subject does",
        "camera_start": "string — starting frame description",
        "camera_end": "string — ending frame description",
        "physics_detail": "string — one specific physics element",
        "full_prompt": "string — max 200 chars, ends with 'X seconds'"
      }${isVeoTone ? `,
      "veo_prompt": {
        "camera_locked": boolean,
        "camera_instruction": "string — specific camera type and position",
        "starting_frame": "string — exact description of first frame",
        "temporal_action": "string — 'After X second(s), [what happens]'",
        "physics_detail": "string — specific physics element",
        "human_element": "string — specific human presence",
        "full_veo_prompt": "string — complete Veo 3.1 prompt, max 300 chars"
      }` : ''}
    }
  ]
}

Generate exactly ${totalScenes} scenes. No more, no less.
Ensure story flows naturally from scene 1 to scene ${totalScenes}.
First scene = hook, last scene = resolution or CTA.`
}

// ─── USER PROMPT BUILDER ──────────────────────────────────────────

export function buildBrainUserPrompt(params: {
  story: string
  platform: string
  language: Language
  tone: Tone
  totalScenes: number
  artStyle: string
  aspectRatio: string
}): string {
  const { story, platform, tone, totalScenes, language } = params
  return `Create a ${totalScenes}-scene storyboard for ${platform}.

Story/Topic: "${story}"
Tone: ${tone}
Language: ${language}
Total scenes: ${totalScenes}

Generate the complete JSON storyboard now.`
}

export { TONE_DEFINITIONS }
