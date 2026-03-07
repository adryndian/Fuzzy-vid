# Phase B: Brain System Prompt Rebuild

# Patch: v3.5

# Read CLAUDE.md first. YOLO mode.

# Requires: Phase A (FEAT-PROVIDERS-FOUNDATION.md) completed first

# After ALL tasks: npm run build && wrangler deploy && git push

-----

## OVERVIEW

- Max 15 scenes (user selects 1-15)
- New tone system: Documentary Viral, Natural Gen Z, Informative, Narrative Storytelling + existing
- VO word limit enforced by brain (max 22 words = ~7 seconds)
- New JSON schema: vo_word_count, vo_duration_sec, video_prompt with movement_type taxonomy
- Brain auto-selects movement_type from VO keywords
- All providers (AWS, Dashscope, Groq, OpenRouter, GLM, Gemini) use same system prompt
- Language: English + Bahasa Indonesia

-----

## TASK 1 — Create worker/lib/brain-system-prompt.ts

Create new file worker/lib/brain-system-prompt.ts:

```typescript
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
```

-----

## TASK 2 — Update worker/handlers/brain.ts (AWS Bedrock brain)

Read worker/handlers/brain.ts completely.

Replace the hardcoded system prompt with the new builder:

```typescript
import { buildBrainSystemPrompt, buildBrainUserPrompt, Tone, Language } from '../lib/brain-system-prompt'

// In handleBrainGenerate, update to extract new params from request body:
const body = await request.json() as {
  story: string
  platform: string
  language: Language
  tone: Tone            // ← NEW
  total_scenes: number  // ← was 'scenes' before — check and unify
  art_style: string
  aspect_ratio: string
  brain_model: string
  project_id?: string
}

// Validate scenes (1-15)
const totalScenes = Math.min(15, Math.max(1, body.total_scenes || body.scenes || 5))

// Build prompts
const systemPrompt = buildBrainSystemPrompt({
  tone: body.tone || 'narrative_storytelling',
  language: body.language || 'id',
  platform: body.platform || 'TikTok',
  artStyle: body.art_style || 'cinematic_realistic',
  totalScenes,
  aspectRatio: body.aspect_ratio || '9_16',
})

const userPrompt = buildBrainUserPrompt({
  story: body.story,
  platform: body.platform || 'TikTok',
  language: body.language || 'id',
  tone: body.tone || 'narrative_storytelling',
  totalScenes,
  artStyle: body.art_style || 'cinematic_realistic',
  aspectRatio: body.aspect_ratio || '9_16',
})

// Use systemPrompt and userPrompt in the Bedrock call (replace existing hardcoded prompts)
```

-----

## TASK 3 — Update worker/handlers/brain-provider.ts

Read worker/handlers/brain-provider.ts (created in Phase A).

Update handleProviderBrain to also support built-in prompt generation:

```typescript
import { buildBrainSystemPrompt, buildBrainUserPrompt, Tone, Language } from '../lib/brain-system-prompt'

// In handleProviderBrain, update body type:
const body = await request.json() as {
  brain_model: string
  // Option A: pass raw prompts (existing)
  system_prompt?: string
  user_prompt?: string
  // Option B: pass story params (new — brain builds prompts internally)
  story?: string
  platform?: string
  language?: Language
  tone?: Tone
  total_scenes?: number
  art_style?: string
  aspect_ratio?: string
  // Common
  temperature?: number
  max_tokens?: number
}

// Build prompts if story params provided (Option B)
let systemPrompt = body.system_prompt || ''
let userPrompt = body.user_prompt || ''

if (body.story && !body.system_prompt) {
  const totalScenes = Math.min(15, Math.max(1, body.total_scenes || 5))
  systemPrompt = buildBrainSystemPrompt({
    tone: body.tone || 'narrative_storytelling',
    language: body.language || 'id',
    platform: body.platform || 'TikTok',
    artStyle: body.art_style || 'cinematic_realistic',
    totalScenes,
    aspectRatio: body.aspect_ratio || '9_16',
  })
  userPrompt = buildBrainUserPrompt({
    story: body.story,
    platform: body.platform || 'TikTok',
    language: body.language || 'id',
    tone: body.tone || 'narrative_storytelling',
    totalScenes,
    artStyle: body.art_style || 'cinematic_realistic',
    aspectRatio: body.aspect_ratio || '9_16',
  })
}
```

-----

## TASK 4 — Create worker/handlers/regenerate-veo-prompt.ts

```typescript
// worker/handlers/regenerate-veo-prompt.ts

import { buildBrainSystemPrompt, Tone, Language } from '../lib/brain-system-prompt'
import { getProviderForModel, getProviderApiKey, callProvider } from '../lib/providers'

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
  let content: string

  try {
    if (provider) {
      const apiKey = getProviderApiKey(provider, env)
      content = await callProvider(provider, apiKey, body.brain_model, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], { max_tokens: 512 })
    } else {
      // Fallback to Bedrock (existing brain handler logic)
      throw new Error('Use Bedrock fallback')
    }

    // Parse JSON
    const clean = content.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    return Response.json({ veo_prompt: parsed }, { headers: cors })
  } catch (e: any) {
    return Response.json(
      { error: e.message || 'Veo prompt generation failed' },
      { status: 500, headers: cors }
    )
  }
}
```

-----

## TASK 5 — Add new routes to worker/index.ts

```typescript
import { handleRegenerateVeoPrompt } from './handlers/regenerate-veo-prompt'
import { buildBrainSystemPrompt, buildBrainUserPrompt } from './lib/brain-system-prompt'

// Add route:
if (path === '/api/brain/regenerate-veo-prompt' && method === 'POST') {
  return handleRegenerateVeoPrompt(request, env)
}
```

-----

## TASK 6 — Update src/pages/Home.tsx — New Form Fields

Read src/pages/Home.tsx completely.

### 6A — Add tone state

```typescript
const [tone, setTone] = useState<string>('narrative_storytelling')
```

### 6B — Update scenes slider max from 10 to 15

Find the scenes/totalScenes slider. Change max to 15.

### 6C — Add tone selector UI (after platform selector, before generate button)

```typescript
// Tone options
const TONES = [
  { id: 'narrative_storytelling', label: '📖 Narrative Story', desc: 'Story arc with emotional beats' },
  { id: 'documentary_viral', label: '📰 Documentary Viral', desc: 'Journalistic + Veo 3.1 optimized' },
  { id: 'natural_genz', label: '✌️ Natural Gen Z', desc: 'Casual, relatable, authentic' },
  { id: 'informative', label: '💡 Informative', desc: 'Factual, clear, structured' },
  { id: 'product_ads', label: '🛍️ Product Ads', desc: 'Benefit-focused with CTA' },
  { id: 'educational', label: '🎓 Educational', desc: 'Step-by-step explanation' },
  { id: 'entertainment', label: '🎉 Entertainment', desc: 'Fun, energetic, surprising' },
  { id: 'motivational', label: '💪 Motivational', desc: 'Empowering and uplifting' },
]

// UI section:
<div style={{ marginBottom: '16px' }}>
  <label style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(60,60,67,0.6)', display: 'block', marginBottom: '8px' }}>
    CONTENT TONE
  </label>
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '6px' }}>
    {TONES.map(t => (
      <button key={t.id} onClick={() => setTone(t.id)} style={{
        padding: '8px 10px', borderRadius: '12px', border: 'none',
        background: tone === t.id
          ? 'linear-gradient(135deg, #ff6b35, #ff4500)'
          : 'rgba(118,118,128,0.08)',
        color: tone === t.id ? 'white' : '#1d1d1f',
        fontSize: '11px', fontWeight: tone === t.id ? 700 : 500,
        cursor: 'pointer', textAlign: 'left',
        boxShadow: tone === t.id ? '0 2px 12px rgba(255,107,53,0.35)' : 'none',
        transition: 'all 0.2s',
      }}>
        <div>{t.label}</div>
        <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '1px' }}>{t.desc}</div>
      </button>
    ))}
  </div>
  {(tone === 'documentary_viral' || tone === 'natural_genz' || tone === 'informative' || tone === 'narrative_storytelling') && (
    <div style={{
      marginTop: '6px', padding: '8px 10px',
      background: 'rgba(255,107,53,0.06)',
      border: '0.5px solid rgba(255,107,53,0.2)',
      borderRadius: '10px', fontSize: '10px',
      color: 'rgba(60,60,67,0.6)',
    }}>
      🎬 Veo 3.1 prompts akan di-generate untuk tone ini — siap di-paste ke Google AI Studio
    </div>
  )}
</div>
```

### 6D — Add tone to brain generate call payload

```typescript
// In handleGenerate / callBrain, add tone to body:
body: JSON.stringify({
  story,
  platform,
  language,
  tone,          // ← ADD
  total_scenes: scenes,
  art_style: artStyle,
  aspect_ratio: aspectRatio,
  brain_model: brainModel,
})
```

-----

## TASK 7 — Update src/lib/api.ts brain function

Read src/lib/api.ts. Update generateBrain / callBrainGenerate function signature:

```typescript
export async function generateBrain(params: {
  story: string
  platform: string
  language: string
  tone: string          // ← ADD
  totalScenes: number
  artStyle: string
  aspectRatio: string
  brainModel: string
  userId?: string
}): Promise<StoryboardResult> {
  const { brainModel, userId } = params
  const headers = getApiHeaders(userId)
  const WORKER_URL = import.meta.env.VITE_WORKER_URL

  // Route to provider endpoint if not AWS/Dashscope
  const isProvider = !brainModel.startsWith('us.') && !brainModel.startsWith('qwen') && !brainModel.startsWith('qwq')
  const endpoint = isProvider ? '/api/brain/provider' : '/api/brain/generate'

  const res = await fetch(`${WORKER_URL}${endpoint}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      story: params.story,
      platform: params.platform,
      language: params.language,
      tone: params.tone,
      total_scenes: params.totalScenes,
      art_style: params.artStyle,
      aspect_ratio: params.aspectRatio,
      brain_model: brainModel,
    }),
  })

  if (!res.ok) {
    const err = await res.json() as { error: string }
    throw new Error(err.error || `Brain failed: ${res.status}`)
  }

  const data = await res.json() as { content?: string; scenes?: unknown[] }

  // Handle provider response (returns {content: "json string"})
  if (data.content) {
    const clean = data.content.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  }

  return data as StoryboardResult
}
```

-----

## TASK 8 — Update D1 storyboards table for tone field

Create worker/migrations/003_tone.sql:

```sql
ALTER TABLE storyboards ADD COLUMN tone TEXT NOT NULL DEFAULT 'narrative_storytelling';
```

Run migration:

```bash
wrangler d1 execute fuzzy-short-db --file=worker/migrations/003_tone.sql --remote
```

Also update handleSaveStoryboard in worker/db.ts to include tone field in INSERT/UPDATE.

-----

## TASK 9 — Build, Deploy, Test

```bash
npx tsc --noEmit 2>&1 | head -20
npm run build 2>&1 | tail -20

wrangler deploy

# Test brain with new tone via provider
curl -X POST https://fuzzy-vid-worker.officialdian21.workers.dev/api/brain/provider \
  -H "Content-Type: application/json" \
  -d '{
    "brain_model": "gemini-2.0-flash",
    "story": "Kisah warung kecil yang viral di media sosial",
    "platform": "TikTok",
    "language": "id",
    "tone": "documentary_viral",
    "total_scenes": 3,
    "art_style": "cinematic_realistic",
    "aspect_ratio": "9_16"
  }'
# Expected: JSON storyboard with veo_prompt in each scene

git add .
git commit -m "feat(v3.5): brain system prompt rebuild — tone system, 15 scenes, Veo 3.1 prompts, all providers"
git push origin main
```