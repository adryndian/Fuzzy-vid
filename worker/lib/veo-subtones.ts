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
