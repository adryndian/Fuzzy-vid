# Phase D: UI Update — Model Selector, Tone, Scene Count, Settings

# Patch: v3.7

# Read CLAUDE.md first. YOLO mode.

# Requires: Phase A + B + C completed first

# After ALL tasks: npm run build && wrangler deploy && git push

-----

## OVERVIEW

- Model selector redesign: grouped by provider with badges
- “No API key” warning per model (greyed out if key missing)
- Tone selector integrated in Home.tsx
- Scene count slider 1-15
- Settings: 4 new provider API key sections with “Get Key” links
- CLAUDE.md + GEMINI.md updated to v3.7

-----

## TASK 1 — Update src/pages/Home.tsx — Full Model Selector Redesign

Read src/pages/Home.tsx completely.

### 1A — Import new model registry

```typescript
import { ALL_BRAIN_MODELS, getModelsByProvider, hasRequiredKey, getModelById } from '../lib/providerModels'
import { useUser } from '@clerk/clerk-react'
```

### 1B — Load user settings for key detection

```typescript
const { user } = useUser()
const [userSettings, setUserSettings] = useState<Record<string, string>>({})

useEffect(() => {
  if (!user?.id) return
  const storageKey = `fuzzy_settings_${user.id}`
  const saved = localStorage.getItem(storageKey)
  if (saved) {
    try { setUserSettings(JSON.parse(saved)) } catch {}
  }
}, [user?.id])
```

### 1C — Replace brain model selector UI

Find existing brainModel selector. Replace with grouped provider selector:

```typescript
// Group models by provider
const modelsByProvider = getModelsByProvider()

const PROVIDER_ORDER = ['aws', 'dashscope', 'gemini', 'groq', 'openrouter', 'glm']
const PROVIDER_META: Record<string, { emoji: string; color: string; label: string }> = {
  aws:         { emoji: '☁️',  color: '#ff9900', label: 'AWS Bedrock' },
  dashscope:   { emoji: '🧠',  color: '#ff8c00', label: 'Dashscope' },
  gemini:      { emoji: '✨',  color: '#4285f4', label: 'Google Gemini' },
  groq:        { emoji: '⚡',  color: '#f97316', label: 'Groq' },
  openrouter:  { emoji: '🔀',  color: '#8b5cf6', label: 'OpenRouter' },
  glm:         { emoji: '🌐',  color: '#06b6d4', label: 'ZhipuAI GLM' },
}

// UI:
<div style={{ marginBottom: '16px' }}>
  <label style={{
    fontSize: '12px', fontWeight: 700,
    color: 'rgba(60,60,67,0.6)', display: 'block', marginBottom: '8px',
  }}>
    🧠 BRAIN MODEL
  </label>

  {PROVIDER_ORDER.map(providerId => {
    const models = modelsByProvider[providerId] || []
    if (models.length === 0) return null
    const meta = PROVIDER_META[providerId]
    const providerHasKey = models.some(m => hasRequiredKey(m, userSettings))

    return (
      <div key={providerId} style={{ marginBottom: '10px' }}>
        {/* Provider header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          marginBottom: '5px',
        }}>
          <span style={{ fontSize: '12px' }}>{meta.emoji}</span>
          <span style={{ fontSize: '10px', fontWeight: 700,
            color: providerHasKey ? meta.color : 'rgba(60,60,67,0.3)' }}>
            {meta.label}
          </span>
          {!providerHasKey && (
            <span style={{
              fontSize: '9px', padding: '1px 5px', borderRadius: '5px',
              background: 'rgba(255,59,48,0.08)', color: 'rgba(255,59,48,0.6)',
              border: '0.5px solid rgba(255,59,48,0.2)',
            }}>No key</span>
          )}
        </div>

        {/* Model chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {models.map(model => {
            const hasKey = hasRequiredKey(model, userSettings)
            const isSelected = brainModel === model.id
            return (
              <button
                key={model.id}
                onClick={() => hasKey && setBrainModel(model.id)}
                disabled={!hasKey}
                style={{
                  padding: '5px 9px', borderRadius: '9px',
                  border: isSelected
                    ? `0.5px solid ${meta.color}`
                    : '0.5px solid rgba(0,0,0,0.08)',
                  background: isSelected
                    ? `${meta.color}18`
                    : hasKey ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.03)',
                  color: isSelected
                    ? meta.color
                    : hasKey ? '#1d1d1f' : 'rgba(60,60,67,0.25)',
                  fontSize: '11px',
                  fontWeight: isSelected ? 700 : 400,
                  cursor: hasKey ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                {model.label}
                {model.free && hasKey && (
                  <span style={{
                    fontSize: '8px', padding: '1px 3px', borderRadius: '3px',
                    background: 'rgba(52,199,89,0.12)', color: '#34c759',
                  }}>FREE</span>
                )}
                {!hasKey && (
                  <span style={{ fontSize: '9px', opacity: 0.5 }}>🔒</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  })}

  {/* Selected model info */}
  {brainModel && (() => {
    const m = getModelById(brainModel)
    if (!m) return null
    return (
      <div style={{
        marginTop: '6px', padding: '6px 10px',
        background: 'rgba(0,0,0,0.03)', borderRadius: '8px',
        display: 'flex', gap: '8px', alignItems: 'center',
      }}>
        <span style={{ fontSize: '11px', color: PROVIDER_META[m.provider]?.color, fontWeight: 700 }}>
          {PROVIDER_META[m.provider]?.emoji} {m.label}
        </span>
        <span style={{ fontSize: '9px', color: 'rgba(60,60,67,0.4)' }}>
          Speed: {m.speedLabel} · {m.bestFor.slice(0, 2).join(', ')}
        </span>
      </div>
    )
  })()}

  {/* Go to Settings if no keys */}
  {PROVIDER_ORDER.every(p => !(modelsByProvider[p] || []).some(m => hasRequiredKey(m, userSettings))) && (
    <div style={{
      marginTop: '8px', padding: '10px',
      background: 'rgba(255,59,48,0.06)',
      border: '0.5px solid rgba(255,59,48,0.2)',
      borderRadius: '10px', textAlign: 'center',
    }}>
      <p style={{ fontSize: '11px', color: 'rgba(60,60,67,0.6)', margin: '0 0 6px' }}>
        Add at least one API key to use Brain generate
      </p>
      <button onClick={() => navigate('/settings')} style={{
        padding: '5px 14px', borderRadius: '8px', border: 'none',
        background: '#007aff', color: 'white',
        fontSize: '11px', fontWeight: 600, cursor: 'pointer',
      }}>
        → Go to Settings
      </button>
    </div>
  )}
</div>
```

### 1D — Update scenes slider max to 15

```typescript
// Find scenes/totalScenes slider, update:
min={1} max={15} step={1}

// Update label to show estimate:
<label>
  Scenes: {scenes}
  <span style={{ fontSize: '10px', color: 'rgba(60,60,67,0.4)', marginLeft: '6px' }}>
    (~{scenes * 7}s total)
  </span>
</label>
```

### 1E — Add language selector (English + Indonesian)

```typescript
const [language, setLanguage] = useState<'id' | 'en'>('id')

// UI:
<div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
  {[
    { id: 'id', label: '🇮🇩 Indonesia' },
    { id: 'en', label: '🇺🇸 English' },
  ].map(l => (
    <button key={l.id} onClick={() => setLanguage(l.id as 'id' | 'en')} style={{
      flex: 1, padding: '8px', borderRadius: '12px', border: 'none',
      background: language === l.id ? 'rgba(0,122,255,0.1)' : 'rgba(118,118,128,0.08)',
      color: language === l.id ? '#007aff' : 'rgba(60,60,67,0.5)',
      fontWeight: language === l.id ? 700 : 500,
      fontSize: '12px', cursor: 'pointer',
      border: language === l.id ? '0.5px solid rgba(0,122,255,0.3)' : '0.5px solid transparent',
    }}>{l.label}</button>
  ))}
</div>
```

-----

## TASK 2 — Update src/pages/Settings.tsx — Complete API Keys Section

Read src/pages/Settings.tsx completely.

### 2A — Ensure new provider sections from Phase A Task 6 are added

Verify these sections exist with proper inputStyle matching the existing design:

- Groq (⚡ orange — console.groq.com)
- OpenRouter (🔀 purple — openrouter.ai/keys)
- GLM/ZhipuAI (🌐 cyan — open.bigmodel.cn)
- Gemini (✨ blue — aistudio.google.com/apikey)

### 2B — Add visual “key present” indicator to all API key inputs

For each API key input, show a green checkmark if the field has a value:

```typescript
// Wrap each input with a relative positioned div:
<div style={{ position: 'relative' }}>
  <input
    type="password"
    value={settings.groqApiKey || ''}
    onChange={...}
    style={{
      ...inputStyle,
      paddingRight: settings.groqApiKey ? '36px' : '12px',
      borderColor: settings.groqApiKey
        ? 'rgba(52,199,89,0.4)'
        : 'rgba(0,0,0,0.1)',
    }}
  />
  {settings.groqApiKey && (
    <span style={{
      position: 'absolute', right: '10px', top: '50%',
      transform: 'translateY(-50%)',
      color: '#34c759', fontSize: '14px',
    }}>✓</span>
  )}
</div>
```

Apply this pattern to ALL API key inputs (AWS, Dashscope, ElevenLabs, Groq, OpenRouter, GLM, Gemini).

### 2C — Add “Test Connection” mini-button per provider

After each API key input:

```typescript
{settings.groqApiKey && (
  <button
    onClick={async () => {
      try {
        const res = await fetch(`${WORKER_URL}/api/brain/provider`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brain_model: 'llama-3.1-8b-instant',
            system_prompt: 'You are helpful.',
            user_prompt: 'Reply with: {"ok":true}',
            max_tokens: 20,
          }),
        })
        const data = await res.json()
        showToast(data.content?.includes('true') ? '✅ Groq connected!' : '⚠️ Groq responded but check key')
      } catch {
        showToast('❌ Groq connection failed')
      }
    }}
    style={{
      marginTop: '4px', padding: '4px 10px', borderRadius: '7px',
      border: '0.5px solid rgba(52,199,89,0.3)',
      background: 'rgba(52,199,89,0.06)',
      color: '#34c759', fontSize: '10px', cursor: 'pointer',
    }}
  >Test →</button>
)}
```

Add similar Test button for OpenRouter (test with gemma-3-27b:free),
GLM (test with glm-4-flash), Gemini (test with gemini-2.0-flash-lite).

### 2D — Add provider section descriptions / limits info

Below each provider header, add a small rate limit note:

```typescript
// Groq
<div style={{ fontSize: '9px', color: 'rgba(60,60,67,0.4)', marginTop: '3px' }}>
  Free: 30 req/min · 14,400 req/day · No credit card required
</div>

// OpenRouter
<div style={{ fontSize: '9px', color: 'rgba(60,60,67,0.4)', marginTop: '3px' }}>
  Free models available · ~20 req/min · No credit card required
</div>

// GLM
<div style={{ fontSize: '9px', color: 'rgba(60,60,67,0.4)', marginTop: '3px' }}>
  GLM-4-Flash: unlimited free · Register at open.bigmodel.cn
</div>

// Gemini
<div style={{ fontSize: '9px', color: 'rgba(60,60,67,0.4)', marginTop: '3px' }}>
  Gemini 2.0 Flash: 15 req/min · 1,500 req/day free
</div>
```

-----

## TASK 3 — Update src/pages/Dashboard.tsx — Show tone badge on storyboards

Read src/pages/Dashboard.tsx.

In storyboard list items, add tone badge:

```typescript
const TONE_BADGES: Record<string, { emoji: string; color: string }> = {
  documentary_viral: { emoji: '📰', color: '#ff3b30' },
  natural_genz:      { emoji: '✌️', color: '#007aff' },
  informative:       { emoji: '💡', color: '#5856d6' },
  narrative_storytelling: { emoji: '📖', color: '#ff6b35' },
  product_ads:       { emoji: '🛍️', color: '#34c759' },
  educational:       { emoji: '🎓', color: '#af52de' },
  entertainment:     { emoji: '🎉', color: '#ffcc00' },
  motivational:      { emoji: '💪', color: '#ff9500' },
}

// In storyboard card subtitle:
{sb.tone && TONE_BADGES[sb.tone] && (
  <span style={{ marginRight: '4px' }}>
    {TONE_BADGES[sb.tone].emoji}
  </span>
)}
{sb.total_scenes} scenes · {sb.platform}...
```

-----

## TASK 4 — Update CLAUDE.md and GEMINI.md to v3.7

Read ~/Fuzzy-vid/CLAUDE.md.

Add/update these sections:

```markdown
## PATCH v3.7 — Multi-Provider + Tone System + Veo 3.1

### New Brain Providers
All use OpenAI-compatible format via universal handler:
- Groq: api.groq.com → GROQ_API_KEY
- OpenRouter: openrouter.ai → OPENROUTER_API_KEY
- GLM/ZhipuAI: open.bigmodel.cn → GLM_API_KEY
- Gemini: generativelanguage.googleapis.com → GEMINI_API_KEY

### New Worker Routes
POST /api/brain/provider         ← universal provider brain
GET  /api/providers/models       ← model list for frontend
POST /api/brain/regenerate-veo-prompt ← Veo 3.1 prompt per scene

### Tone System
8 tones: documentary_viral, natural_genz, informative,
narrative_storytelling, product_ads, educational, entertainment, motivational

Veo-compatible tones (have veo_prompt in JSON):
  documentary_viral → 5 sub-tones
  natural_genz → genz_authentic
  informative → clean_explainer
  narrative_storytelling → cinematic_narrative

### Scene JSON Schema v3.7
{
  scene_number, vo_script, vo_word_count, vo_duration_sec,
  scene_purpose, image_prompt,
  video_prompt: { duration_sec, movement_type, energy, subject_motion,
                  camera_start, camera_end, physics_detail, full_prompt },
  veo_prompt: { sub_tone, camera_locked, camera_instruction,
                starting_frame, temporal_action, physics_detail,
                human_element, full_veo_prompt }  // only for Veo tones
}

### New Files
worker/lib/providers.ts          ← provider registry
worker/lib/brain-system-prompt.ts ← master system prompt builder
worker/lib/veo-subtones.ts       ← Veo 3.1 sub-tone definitions
worker/handlers/brain-provider.ts ← universal provider handler
worker/handlers/regenerate-veo-prompt.ts ← Veo prompt regen
src/lib/providerModels.ts        ← frontend model registry
src/lib/veoSubtones.ts           ← frontend Veo definitions
src/components/VeoPromptSection.tsx ← Veo prompt UI component

### New Worker Secrets
GROQ_API_KEY
OPENROUTER_API_KEY
GLM_API_KEY
GEMINI_API_KEY

### D1 Migrations
003_tone.sql — adds tone column to storyboards

### UI Changes
- Home: grouped model selector by provider
- Home: tone selector (8 tones)
- Home: scene slider 1-15
- Home: language selector (ID/EN)
- Settings: 4 new provider API key sections with Test button
- Storyboard: VeoPromptSection replaces video_prompt for Veo tones
- Storyboard: Export All Veo Prompts button
- Dashboard: tone badge on storyboard cards
```

-----

## TASK 5 — Build, Deploy, Full Test

```bash
npx tsc --noEmit 2>&1 | head -30
npm run build 2>&1 | tail -20
# Must be 0 errors

wrangler deploy

# Run D1 migration
wrangler d1 execute fuzzy-short-db --file=worker/migrations/003_tone.sql --remote

# Integration tests:

# 1. Provider models list
curl https://fuzzy-vid-worker.officialdian21.workers.dev/api/providers/models | python3 -m json.tool | head -30

# 2. Brain generate via Gemini (change model to one with key set)
curl -X POST https://fuzzy-vid-worker.officialdian21.workers.dev/api/brain/provider \
  -H "Content-Type: application/json" \
  -d '{
    "brain_model": "gemini-2.0-flash",
    "story": "Warung bakso viral yang antriannya sampai 3 jam",
    "platform": "TikTok",
    "language": "id",
    "tone": "documentary_viral",
    "total_scenes": 3,
    "art_style": "cinematic_realistic",
    "aspect_ratio": "9_16"
  }' | python3 -m json.tool | head -50

# 3. Veo prompt regen
curl -X POST https://fuzzy-vid-worker.officialdian21.workers.dev/api/brain/regenerate-veo-prompt \
  -H "Content-Type: application/json" \
  -d '{
    "scene_number": 1,
    "vo_script": "Tidak ada yang menyangka warung ini kini diantre ribuan orang setiap harinya",
    "image_prompt": "Small street food stall, morning light, steam rising, people queuing",
    "tone": "documentary_viral",
    "sub_tone": "human_story",
    "platform": "TikTok",
    "brain_model": "gemini-2.0-flash"
  }' | python3 -m json.tool

# 4. Admin still works
curl https://fuzzy-vid-worker.officialdian21.workers.dev/api/admin/stats
# Expected: {"error":"Unauthorized"}

git add .
git commit -m "feat(v3.7): UI redesign — grouped model selector, tone system, Veo prompt UI, Settings provider keys"
git push origin main
```

-----

## POST-DEPLOY CHECKLIST

```
□ wrangler secret put GROQ_API_KEY
□ wrangler secret put OPENROUTER_API_KEY
□ wrangler secret put GLM_API_KEY
□ wrangler secret put GEMINI_API_KEY
□ wrangler d1 execute fuzzy-short-db --file=worker/migrations/003_tone.sql --remote
□ Add keys in Settings page → test each provider's Test button
□ Set role=admin in Clerk for your account (see FASE1B-ADMIN-PANEL.md)
□ Generate a storyboard with Documentary Viral tone → verify veo_prompt in scenes
□ Click "Export Veo Prompts" → verify .txt file downloads correctly
□ Open AI Studio → paste one Veo prompt → verify it generates expected output
```