# Phase C: Veo 3.1 Prompt Engine + Documentary Tone UI

# Patch: v3.6

# Read CLAUDE.md first. YOLO mode.

# Requires: Phase A + Phase B completed first

# After ALL tasks: npm run build && wrangler deploy && git push

-----

## OVERVIEW

- 6 sub-tones under Documentary Viral umbrella
- Veo 3.1 prompt displayed as dedicated section in scene card
- Replaces video_prompt when Veo-compatible tone selected
- Copy-paste ready to Google AI Studio
- “Open in AI Studio” button
- Regenerate per scene via /api/brain/regenerate-veo-prompt

VEO-COMPATIBLE TONES:
documentary_viral → 5 sub-tones (Breaking News, Human Story, Product Origin, Investigation, Inspirational)
natural_genz      → sub-tone: genz_authentic
informative       → sub-tone: clean_explainer
narrative_storytelling → sub-tone: cinematic_narrative

-----

## TASK 1 — Create worker/lib/veo-subtones.ts

Create new file worker/lib/veo-subtones.ts:

```typescript
// worker/lib/veo-subtones.ts
// Sub-tone definitions for Veo 3.1 prompt generation

export type VeoSubTone =
  | 'breaking_news'
  | 'human_story'
  | 'product_origin'
  | 'investigation'
  | 'inspirational'
  | 'genz_authentic'
  | 'clean_explainer'
  | 'cinematic_narrative'

export interface VeoSubToneDef {
  id: VeoSubTone
  label: string
  emoji: string
  parentTone: string
  color: string
  cameraStyle: string
  lightingStyle: string
  humanPresence: string
  physicsElements: string[]
  voKeywords: string[]
  promptTemplate: string
  durationRange: [number, number]
}

export const VEO_SUBTONES: Record<VeoSubTone, VeoSubToneDef> = {

  breaking_news: {
    id: 'breaking_news',
    label: 'Breaking News',
    emoji: '📰',
    parentTone: 'documentary_viral',
    color: '#ff3b30',
    cameraStyle: 'Locked camera or very subtle handheld (max 2px shake). Eye-level.',
    lightingStyle: 'Harsh natural daylight or harsh artificial light. High contrast shadows.',
    humanPresence: 'Required. People moving through frame, reactions, crowd elements.',
    physicsElements: ['fast-moving crowd', 'papers blowing', 'urgent hand gestures', 'phone screens lit up'],
    voKeywords: ['viral', 'breaking', 'baru saja', 'detik ini', 'terjadi', 'breaking news', 'just in', 'urgent'],
    durationRange: [6, 7],
    promptTemplate: `Locked camera at eye level. {STARTING_FRAME}. 
After {TIME} second(s), {ACTION}. 
{PHYSICS}. Harsh natural light. {DURATION} seconds.`,
  },

  human_story: {
    id: 'human_story',
    label: 'Human Story',
    emoji: '❤️',
    parentTone: 'documentary_viral',
    color: '#ff6b35',
    cameraStyle: 'Slow push in OR static close-up. Intimate framing. Tight on face or hands.',
    lightingStyle: 'Soft window light or golden hour. Warm tones. Shadows present but soft.',
    humanPresence: 'Face, hands, or meaningful body language. Emotional expression.',
    physicsElements: ['tears forming', 'hands trembling slightly', 'fabric texture', 'dust in light beam', 'steam rising'],
    voKeywords: ['kisah', 'perjuangan', 'manusia', 'nyata', 'story', 'struggle', 'dia', 'mereka', 'saya'],
    durationRange: [7, 8],
    promptTemplate: `{CAMERA_START}. {STARTING_FRAME}.
After {TIME} second(s), camera gently {MOVEMENT} to reveal {REVEAL}.
{PHYSICS}. Soft {LIGHT} light from {DIRECTION}. {DURATION} seconds.`,
  },

  product_origin: {
    id: 'product_origin',
    label: 'Product Origin',
    emoji: '🏭',
    parentTone: 'documentary_viral',
    color: '#34c759',
    cameraStyle: 'Pull back reveal. Start extreme close-up on material/detail, pull to context.',
    lightingStyle: 'Practical workspace lighting. Authentic. Not studio-perfect.',
    humanPresence: 'Hands working with materials. Craft in progress.',
    physicsElements: ['material texture close-up', 'tools in use', 'workspace dust', 'raw material transformation'],
    voKeywords: ['mulai dari', 'bermula', 'brand', 'produk', 'awal', 'started', 'origin', 'journey', 'crafted'],
    durationRange: [6, 8],
    promptTemplate: `Extreme close-up on {MATERIAL} texture. 
After {TIME} second(s), hands enter frame and begin {ACTION}.
Camera slowly pulls back revealing {CONTEXT}. {PHYSICS}. {DURATION} seconds.`,
  },

  investigation: {
    id: 'investigation',
    label: 'Investigation / Exposé',
    emoji: '🔍',
    parentTone: 'documentary_viral',
    color: '#af52de',
    cameraStyle: 'Partially obscured or shadow-dominant. Slow zoom in. Low angle.',
    lightingStyle: 'Dramatic. Light through blinds or partial shadow. High contrast.',
    humanPresence: 'Hands with documents, silhouette, or obscured identity.',
    physicsElements: ['shadow patterns from blinds', 'paper pages turning', 'light flickering', 'smoke or fog'],
    voKeywords: ['rahasia', 'tersembunyi', 'sebenarnya', 'apa yang', 'secret', 'hidden', 'exposed', 'investigation'],
    durationRange: [6, 7],
    promptTemplate: `Dimly lit scene. {STARTING_FRAME}.
Harsh light strips from {LIGHT_SOURCE} create shadow patterns.
After {TIME} second(s), {ACTION}. Camera remains still. {DURATION} seconds.`,
  },

  inspirational: {
    id: 'inspirational',
    label: 'Inspirational Journey',
    emoji: '🌅',
    parentTone: 'documentary_viral',
    color: '#ffcc00',
    cameraStyle: 'Tilt up from low to sky. Golden hour dominant. Wide establishing.',
    lightingStyle: 'Golden hour (warm orange/yellow). Backlit subject. Lens flare subtle.',
    humanPresence: 'Full body or silhouette. Achievement pose. Looking toward horizon.',
    physicsElements: ['wind in hair or fabric', 'golden light particles', 'subtle lens flare', 'horizon glow'],
    voKeywords: ['membuktikan', 'akhirnya', 'tekad', 'bangkit', 'sukses', 'prove', 'finally', 'achieved', 'triumph'],
    durationRange: [7, 8],
    promptTemplate: `Wide shot of {SUBJECT} in golden hour light.
Camera slowly tilts up from {START_POINT} toward {END_POINT}.
{PHYSICS}. After {TIME} second(s), {ACTION}. {DURATION} seconds.`,
  },

  genz_authentic: {
    id: 'genz_authentic',
    label: 'Gen Z Authentic',
    emoji: '✌️',
    parentTone: 'natural_genz',
    color: '#007aff',
    cameraStyle: 'Casual handheld. Slight natural shake. Quick reframe allowed.',
    lightingStyle: 'Natural indoor or outdoor light. No professional setup feel.',
    humanPresence: 'Person in natural setting. Casual interaction with product or environment.',
    physicsElements: ['phone screen glow', 'casual clothing movement', 'urban textures', 'sneaker detail'],
    voKeywords: ['guys', 'literally', 'no cap', 'vibes', 'fr', 'gaskeun', 'real talk', 'bestie'],
    durationRange: [6, 7],
    promptTemplate: `Casual handheld shot, subtle natural shake. {STARTING_FRAME}.
{ACTION}. Quick reframe to show {DETAIL}.
Natural {LIGHT} light. After {TIME} second(s), {REACTION}. {DURATION} seconds.`,
  },

  clean_explainer: {
    id: 'clean_explainer',
    label: 'Clean Explainer',
    emoji: '💡',
    parentTone: 'informative',
    color: '#5856d6',
    cameraStyle: 'Clean static shot. Object or subject perfectly centered. No movement.',
    lightingStyle: 'Even soft lighting. No harsh shadows. Clean neutral background.',
    humanPresence: 'Hands demonstrating clearly. No face needed.',
    physicsElements: ['clean surface reflection', 'precise hand gesture', 'object in perfect focus'],
    voKeywords: ['caranya', 'langkahnya', 'faktanya', 'tips', 'how to', 'step', 'here is why', 'the reason'],
    durationRange: [6, 7],
    promptTemplate: `Clean static shot. {SUBJECT} centered on {SURFACE}.
Even soft lighting, no harsh shadows. 
After {TIME} second(s), hands enter frame demonstrating {ACTION} clearly.
Camera locked. {DURATION} seconds.`,
  },

  cinematic_narrative: {
    id: 'cinematic_narrative',
    label: 'Cinematic Narrative',
    emoji: '🎬',
    parentTone: 'narrative_storytelling',
    color: '#1d1d1f',
    cameraStyle: 'Deliberate camera movement matching story beat. One clear movement arc.',
    lightingStyle: 'Cinematic. Golden hour or dramatic artificial. Motivated light sources.',
    humanPresence: 'Character-driven. Face or significant gesture per scene.',
    physicsElements: ['motivated light shift', 'atmospheric haze', 'fabric or hair movement', 'environmental detail'],
    voKeywords: ['cerita', 'journey', 'ketika', 'suatu hari', 'saat itu', 'once', 'it began', 'the moment'],
    durationRange: [7, 8],
    promptTemplate: `{CAMERA_MOVEMENT} shot. {STARTING_FRAME} in {LIGHTING}.
{CHARACTER} {ACTION} as camera {MOVEMENT}.
{PHYSICS}. After {TIME} second(s), {STORY_BEAT}. {DURATION} seconds.`,
  },
}

// Map parent tone to available sub-tones
export const TONE_TO_SUBTONES: Record<string, VeoSubTone[]> = {
  documentary_viral: ['breaking_news', 'human_story', 'product_origin', 'investigation', 'inspirational'],
  natural_genz: ['genz_authentic'],
  informative: ['clean_explainer'],
  narrative_storytelling: ['cinematic_narrative'],
}

// Check if a tone has Veo sub-tones
export function isVeoTone(tone: string): boolean {
  return tone in TONE_TO_SUBTONES
}

// Get default sub-tone for a tone
export function getDefaultSubTone(tone: string): VeoSubTone | null {
  const subs = TONE_TO_SUBTONES[tone]
  return subs?.[0] || null
}
```

-----

## TASK 2 — Update worker/handlers/regenerate-veo-prompt.ts

Read worker/handlers/regenerate-veo-prompt.ts (created in Phase B).
Update it to use VEO_SUBTONES definitions:

```typescript
import { VEO_SUBTONES, VeoSubTone, getDefaultSubTone } from '../lib/veo-subtones'

// In handleRegenerateVeoPrompt, enhance system prompt with sub-tone context:

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
```

-----

## TASK 3 — Create src/components/VeoPromptSection.tsx

Create new file src/components/VeoPromptSection.tsx:

```typescript
// src/components/VeoPromptSection.tsx
import { useState, useCallback } from 'react'
import { useUser } from '@clerk/clerk-react'
import { VEO_SUBTONES, TONE_TO_SUBTONES, VeoSubTone } from '../lib/veoSubtones'

// Mirror of worker types for frontend
interface VeoPrompt {
  sub_tone?: string
  camera_locked?: boolean
  camera_instruction?: string
  starting_frame?: string
  temporal_action?: string
  physics_detail?: string
  human_element?: string
  full_veo_prompt: string
}

interface Props {
  sceneNumber: number
  veoPrompt: VeoPrompt | null
  voScript: string
  imagePrompt: string
  tone: string
  platform: string
  brainModel: string
  onUpdate: (veoPrompt: VeoPrompt) => void
}

const WORKER_URL = import.meta.env.VITE_WORKER_URL

export default function VeoPromptSection({
  sceneNumber, veoPrompt, voScript, imagePrompt,
  tone, platform, brainModel, onUpdate,
}: Props) {
  const { user } = useUser()
  const [expanded, setExpanded] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [selectedSubTone, setSelectedSubTone] = useState<string>(
    veoPrompt?.sub_tone || TONE_TO_SUBTONES[tone]?.[0] || 'human_story'
  )
  const [copied, setCopied] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  const availableSubTones = TONE_TO_SUBTONES[tone] || []
  const subToneDef = VEO_SUBTONES[selectedSubTone as VeoSubTone]

  const handleCopy = useCallback(async () => {
    if (!veoPrompt?.full_veo_prompt) return
    await navigator.clipboard.writeText(veoPrompt.full_veo_prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [veoPrompt])

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const res = await fetch(`${WORKER_URL}/api/brain/regenerate-veo-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene_number: sceneNumber,
          vo_script: voScript,
          image_prompt: imagePrompt,
          tone,
          sub_tone: selectedSubTone,
          platform,
          brain_model: brainModel,
        }),
      })
      const data = await res.json() as { veo_prompt: VeoPrompt }
      if (data.veo_prompt) onUpdate(data.veo_prompt)
    } catch (e) {
      console.error('Veo regen failed:', e)
    } finally {
      setRegenerating(false)
    }
  }

  const openInAIStudio = () => {
    window.open('https://aistudio.google.com/generate-video', '_blank')
  }

  return (
    <div style={{ marginTop: '10px' }}>
      {/* Header — collapsed trigger */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', padding: '8px 12px',
          background: expanded
            ? 'rgba(255,107,53,0.08)'
            : 'rgba(118,118,128,0.06)',
          border: `0.5px solid ${expanded ? 'rgba(255,107,53,0.25)' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: expanded ? '12px 12px 0 0' : '12px',
          display: 'flex', alignItems: 'center', gap: '8px',
          cursor: 'pointer', transition: 'all 0.2s',
        }}
      >
        <span style={{ fontSize: '14px' }}>🎬</span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#ff6b35', flex: 1, textAlign: 'left' }}>
          Veo 3.1 Prompt
          {veoPrompt && <span style={{ fontSize: '9px', marginLeft: '6px', opacity: 0.7 }}>
            {subToneDef?.emoji} {subToneDef?.label}
          </span>}
        </span>
        {veoPrompt && (
          <span style={{
            fontSize: '9px', padding: '2px 6px', borderRadius: '6px',
            background: 'rgba(52,199,89,0.1)', color: '#34c759',
            border: '0.5px solid rgba(52,199,89,0.3)',
          }}>Ready ✓</span>
        )}
        <span style={{ fontSize: '10px', color: 'rgba(60,60,67,0.4)' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{
          background: 'rgba(255,255,255,0.9)',
          border: '0.5px solid rgba(255,107,53,0.2)',
          borderTop: 'none', borderRadius: '0 0 12px 12px',
          padding: '12px',
        }}>
          {/* Sub-tone selector */}
          {availableSubTones.length > 1 && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(60,60,67,0.5)', marginBottom: '6px' }}>
                SUB-TONE
              </div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {availableSubTones.map(st => {
                  const def = VEO_SUBTONES[st as VeoSubTone]
                  return (
                    <button
                      key={st}
                      onClick={() => setSelectedSubTone(st)}
                      style={{
                        padding: '4px 8px', borderRadius: '8px', border: 'none',
                        background: selectedSubTone === st
                          ? `rgba(${def?.color === '#ff3b30' ? '255,59,48' : '255,107,53'},0.12)`
                          : 'rgba(118,118,128,0.08)',
                        color: selectedSubTone === st ? (def?.color || '#ff6b35') : 'rgba(60,60,67,0.6)',
                        fontSize: '10px', fontWeight: selectedSubTone === st ? 700 : 500,
                        cursor: 'pointer',
                        border: selectedSubTone === st
                          ? `0.5px solid ${def?.color || '#ff6b35'}40`
                          : '0.5px solid transparent',
                      }}
                    >
                      {def?.emoji} {def?.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Prompt display */}
          {veoPrompt ? (
            <>
              {/* Full prompt */}
              <div style={{
                background: 'rgba(0,0,0,0.03)', borderRadius: '10px',
                padding: '10px', marginBottom: '8px',
                fontFamily: 'monospace', fontSize: '11px',
                color: '#1d1d1f', lineHeight: 1.5,
              }}>
                {veoPrompt.full_veo_prompt}
              </div>

              {/* Breakdown pills */}
              {!showRaw && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                  {veoPrompt.camera_instruction && (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '9px', fontWeight: 700, color: '#007aff',
                        background: 'rgba(0,122,255,0.08)', padding: '2px 6px',
                        borderRadius: '5px', flexShrink: 0 }}>📷 CAMERA</span>
                      <span style={{ fontSize: '10px', color: 'rgba(60,60,67,0.7)' }}>
                        {veoPrompt.camera_instruction}
                      </span>
                    </div>
                  )}
                  {veoPrompt.temporal_action && (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '9px', fontWeight: 700, color: '#ff6b35',
                        background: 'rgba(255,107,53,0.08)', padding: '2px 6px',
                        borderRadius: '5px', flexShrink: 0 }}>⏱️ ACTION</span>
                      <span style={{ fontSize: '10px', color: 'rgba(60,60,67,0.7)' }}>
                        {veoPrompt.temporal_action}
                      </span>
                    </div>
                  )}
                  {veoPrompt.physics_detail && (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '9px', fontWeight: 700, color: '#34c759',
                        background: 'rgba(52,199,89,0.08)', padding: '2px 6px',
                        borderRadius: '5px', flexShrink: 0 }}>🌊 PHYSICS</span>
                      <span style={{ fontSize: '10px', color: 'rgba(60,60,67,0.7)' }}>
                        {veoPrompt.physics_detail}
                      </span>
                    </div>
                  )}
                  {veoPrompt.human_element && (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '9px', fontWeight: 700, color: '#af52de',
                        background: 'rgba(175,82,222,0.08)', padding: '2px 6px',
                        borderRadius: '5px', flexShrink: 0 }}>👤 HUMAN</span>
                      <span style={{ fontSize: '10px', color: 'rgba(60,60,67,0.7)' }}>
                        {veoPrompt.human_element}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button onClick={handleCopy} style={{
                  flex: 1, padding: '8px', borderRadius: '10px',
                  background: copied ? 'rgba(52,199,89,0.1)' : 'rgba(0,122,255,0.08)',
                  border: `0.5px solid ${copied ? 'rgba(52,199,89,0.3)' : 'rgba(0,122,255,0.2)'}`,
                  color: copied ? '#34c759' : '#007aff',
                  fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                }}>
                  {copied ? '✅ Copied!' : '📋 Copy Prompt'}
                </button>

                <button onClick={openInAIStudio} style={{
                  flex: 1, padding: '8px', borderRadius: '10px',
                  background: 'rgba(66,133,244,0.08)',
                  border: '0.5px solid rgba(66,133,244,0.25)',
                  color: '#4285f4', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                }}>
                  ✨ AI Studio
                </button>

                <button onClick={handleRegenerate} disabled={regenerating} style={{
                  flex: 1, padding: '8px', borderRadius: '10px',
                  background: 'rgba(255,107,53,0.08)',
                  border: '0.5px solid rgba(255,107,53,0.25)',
                  color: '#ff6b35', fontSize: '11px', fontWeight: 700,
                  cursor: regenerating ? 'not-allowed' : 'pointer',
                  opacity: regenerating ? 0.6 : 1,
                }}>
                  {regenerating ? '⏳' : '🔄'} Regen
                </button>

                <button onClick={() => setShowRaw(r => !r)} style={{
                  padding: '8px 10px', borderRadius: '10px',
                  background: showRaw ? 'rgba(118,118,128,0.12)' : 'rgba(118,118,128,0.06)',
                  border: '0.5px solid rgba(118,118,128,0.15)',
                  color: 'rgba(60,60,67,0.5)', fontSize: '10px', cursor: 'pointer',
                }}>
                  {showRaw ? '{ }' : '📊'}
                </button>
              </div>
            </>
          ) : (
            /* No veo_prompt yet */
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <p style={{ fontSize: '11px', color: 'rgba(60,60,67,0.5)', margin: '0 0 10px' }}>
                No Veo prompt yet. Regenerate to create one.
              </p>
              <button onClick={handleRegenerate} disabled={regenerating} style={{
                padding: '8px 20px', borderRadius: '12px', border: 'none',
                background: regenerating ? 'rgba(118,118,128,0.1)' : 'linear-gradient(135deg, #ff6b35, #ff4500)',
                color: regenerating ? 'rgba(60,60,67,0.4)' : 'white',
                fontSize: '12px', fontWeight: 700, cursor: regenerating ? 'not-allowed' : 'pointer',
              }}>
                {regenerating ? '⏳ Generating...' : '🎬 Generate Veo Prompt'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

-----

## TASK 4 — Create src/lib/veoSubtones.ts (Frontend mirror)

Create src/lib/veoSubtones.ts — copy the types and TONE_TO_SUBTONES from
worker/lib/veo-subtones.ts but simplified for frontend use.

This file should export:

- VEO_SUBTONES (same structure, used in VeoPromptSection)
- TONE_TO_SUBTONES (mapping)
- isVeoTone(tone: string): boolean
- getDefaultSubTone(tone: string): string | null

Copy the definitions from TASK 1 worker file, removing the Worker-specific
TypeScript types that don’t apply to frontend.

-----

## TASK 5 — Update src/pages/Storyboard.tsx — Add VeoPromptSection

Read src/pages/Storyboard.tsx completely.

### 5A — Add veo_prompt to scene assets state

```typescript
// In scene asset state type, add:
veoPrompt?: {
  sub_tone?: string
  camera_locked?: boolean
  camera_instruction?: string
  starting_frame?: string
  temporal_action?: string
  physics_detail?: string
  human_element?: string
  full_veo_prompt: string
} | null
```

### 5B — Import VeoPromptSection and isVeoTone

```typescript
import VeoPromptSection from '../components/VeoPromptSection'
import { isVeoTone } from '../lib/veoSubtones'
```

### 5C — Get tone from storyboard data

```typescript
// storyboard_result contains tone from brain output
const storyboard = JSON.parse(sessionStorage.getItem('storyboard_result') || '{}')
const [tone] = useState<string>(storyboard.tone || 'narrative_storytelling')
const [brainModel] = useState<string>(storyboard.brain_model || 'us.anthropic.claude-sonnet-4-6')
```

### 5D — Initialize veoPrompt from brain output

```typescript
// When loading scenes from storyboard result:
// scene.veo_prompt from brain JSON → assets[i].veoPrompt
useEffect(() => {
  if (!storyboard?.scenes) return
  const initialAssets: Record<number, SceneAsset> = {}
  storyboard.scenes.forEach((scene: any, i: number) => {
    initialAssets[i + 1] = {
      // ... existing fields ...
      veoPrompt: scene.veo_prompt || null,
      videoPrompt: scene.video_prompt || null,
      customVideoPrompt: '',
    }
  })
  setAssets(initialAssets)
}, [])
```

### 5E — In scene card render, replace video_prompt with VeoPromptSection conditionally

```typescript
{/* Video Prompt section — show Veo if Veo-compatible tone */}
{isVeoTone(tone) ? (
  <VeoPromptSection
    sceneNumber={scene.scene_number}
    veoPrompt={assets[scene.scene_number]?.veoPrompt || null}
    voScript={scene.vo_script}
    imagePrompt={scene.image_prompt}
    tone={tone}
    platform={storyboard.platform || 'TikTok'}
    brainModel={brainModel}
    onUpdate={(veoPrompt) => {
      setAssets(prev => ({
        ...prev,
        [scene.scene_number]: {
          ...prev[scene.scene_number],
          veoPrompt,
        }
      }))
      // Also save to D1 (non-blocking)
      saveSceneAsset({
        storyboard_id: projectId,
        scene_number: scene.scene_number,
        video_prompt: JSON.stringify(veoPrompt),
      }).catch(console.error)
    }}
  />
) : (
  /* Existing video_prompt section for non-Veo tones */
  <ExistingVideoPromptSection ... />
)}
```

-----

## TASK 6 — Add “Export All Veo Prompts” button to Storyboard header

In Storyboard.tsx header area, if tone is Veo-compatible:

```typescript
{isVeoTone(tone) && (
  <button
    onClick={() => {
      const allPrompts = scenes.map((scene: any) => {
        const veo = assets[scene.scene_number]?.veoPrompt
        return [
          `=== SCENE ${scene.scene_number} ===`,
          `VO: "${scene.vo_script}"`,
          ``,
          `VEO 3.1 PROMPT:`,
          veo?.full_veo_prompt || '(not generated yet)',
          ``,
        ].join('\n')
      }).join('\n')

      const blob = new Blob([allPrompts], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `veo-prompts-${storyboard.title?.replace(/\s/g, '-') || 'storyboard'}.txt`
      a.click()
      URL.revokeObjectURL(url)
    }}
    style={{
      padding: '6px 12px', borderRadius: '10px',
      background: 'rgba(255,107,53,0.1)',
      border: '0.5px solid rgba(255,107,53,0.3)',
      color: '#ff6b35', fontSize: '11px', fontWeight: 700,
      cursor: 'pointer',
    }}
  >
    🎬 Export Veo Prompts
  </button>
)}
```

-----

## TASK 7 — Build, Deploy, Test

```bash
npx tsc --noEmit 2>&1 | head -20
npm run build 2>&1 | tail -20

wrangler deploy

# Test Veo prompt regeneration
curl -X POST https://fuzzy-vid-worker.officialdian21.workers.dev/api/brain/regenerate-veo-prompt \
  -H "Content-Type: application/json" \
  -d '{
    "scene_number": 1,
    "vo_script": "Tidak ada yang menyangka warung kecil ini kini ramai diantre ribuan orang",
    "image_prompt": "Small street warung, morning light, steam rising",
    "tone": "documentary_viral",
    "sub_tone": "human_story",
    "platform": "TikTok",
    "brain_model": "gemini-2.0-flash"
  }'
# Expected: {"veo_prompt":{"sub_tone":"human_story","camera_locked":false,...}}

git add .
git commit -m "feat(v3.6): Veo 3.1 prompt engine — 6 sub-tones, VeoPromptSection, export all prompts"
git push origin main
```