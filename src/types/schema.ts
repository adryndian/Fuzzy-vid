// src/types/schema.ts — NEVER deviate from this

export type ArtStyle = 
  | 'cinematic_realistic' | 'anime_stylized' | 'comic_book'
  | 'oil_painting' | 'watercolor' | 'pixel_art' | '3d_render'

export type AspectRatio = '9_16' | '16_9' | '1_1' | '4_5'
export type Resolution = '1080p'

export const ASPECT_RATIOS: { id: AspectRatio; label: string; desc: string; icon: string }[] = [
  { id: '9_16', label: '9:16', desc: 'Vertical', icon: '📱' },
  { id: '16_9', label: '16:9', desc: 'Landscape', icon: '🖥️' },
  { id: '1_1', label: '1:1', desc: 'Square', icon: '⬜' },
  { id: '4_5', label: '4:5', desc: 'Portrait', icon: '🖼️' },
]

export const RESOLUTION = '1080p'

export type Mood = 
  | 'epic' | 'mysterious' | 'romantic' | 'horror' | 'comedy'
  | 'inspirational' | 'melancholic' | 'action'

export type BrainModel = string
export type ImageModel = string
export type VideoModel = string
export type VoiceGender = 'male' | 'female'
export type AudioModel = 'polly' | 'gemini_tts' | 'elevenlabs' | 'fish_audio' | string

export type AWSRegion = 
  | 'us-west-2' | 'us-east-1' | 'ap-southeast-1'

export type AssetStatus = 'pending' | 'generating' | 'done' | 'approved' | 'failed'
export type LockedStatus = 'locked'

export type GenerationStatus = 'idle' | 'generating' | 'done' | 'error'

export interface AudioHistoryItem {
  url: string
  engine: string
  voice: string
  timestamp: string
}

export interface VideoPromptData {
  motion: string
  subject_action: string
  atmosphere: string
  camera: string
  pacing: string
  full_prompt: string
}

export interface SceneAssets {
  imageUrl?: string
  imageStatus: GenerationStatus
  imageError?: string
  enhancedPrompt?: string
  videoUrl?: string
  videoJobId?: string
  videoStatus: GenerationStatus
  videoError?: string
  videoPrompt?: VideoPromptData
  customVideoPrompt?: string
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
  audioUrl?: string
  audioStatus: GenerationStatus
  audioError?: string
  audioHistory: AudioHistoryItem[]
}

export type SceneAssetsMap = Record<number, SceneAssets>

export const defaultSceneAssets = (): SceneAssets => ({
  imageStatus: 'idle',
  videoStatus: 'idle',
  audioStatus: 'idle',
  audioHistory: [],
})

export interface ProjectSchema {
  project_id: string
  metadata: {
    title: string
    created_at: string
    target_platform: 'youtube_shorts' | 'reels' | 'tiktok'
    aspect_ratio: AspectRatio
    art_style: ArtStyle
    mood: Mood
    brain_model: BrainModel
    total_scenes: number
    narasi_language: 'id' | 'en'
    character_names?: string
  }
  character_sheet: CharacterRef[]
  global_style_guide: {
    color_palette: string[]
    lighting_theme: string
    texture_style: string
    nano_banana_tags: string[]
    negative_global: string
  }
  scenes: Scene[]
}

export interface CharacterRef {
  name: string
  description: string
  reference_image_url?: string
}

export interface Scene {
  scene_id: number
  act: 'opening_hook' | 'rising_action' | 'climax' | 'resolution'
  title: string
  narrative_voiceover: {
    text_id: string
    text_en: string
    duration_estimate_seconds: number
    tone: string
    pacing: 'slow' | 'medium' | 'fast'
    ssml_hints: {
      pause_after: string[]
      stress: string[]
    }
  }
  recommended_image_model: ImageModel
  image_prompt: ImagePrompt
  video_prompt: VideoPrompt
  audio: AudioConfig
  status: {
    image: AssetStatus | LockedStatus
    video: AssetStatus | LockedStatus
    audio: AssetStatus | LockedStatus
  }
  assets: {
    image_url?: string
    image_r2_key?: string
    video_url?: string
    video_r2_key?: string
    audio_url?: string
    audio_r2_key?: string
    character_ref_url?: string
  }
}

export interface ImagePrompt {
  subject: {
    main: string
    characters: string[]
    action: string
    pose?: string
    expression?: string
  }
  environment: {
    setting: string
    time_of_day: string
    props: string
  }
  lighting: {
    source: string
    quality: string
    shadows: string
  }
  camera: {
    angle: string
    focal_length: string
    aperture: string
    composition: string
    movement_for_video: string
  }
  style_modifiers: string
  negative_prompts: string
}

export interface VideoPrompt {
  model_preference: VideoModel
  motion_type: string
  motion_intensity: 'subtle' | 'medium' | 'dynamic'
  duration_seconds: 5 | 10
  atmosphere: string
}

export interface AudioConfig {
  preferred_model: AudioModel
  voice_gender: 'male' | 'female'
  voice_character: string
  speed: number
  language: 'id' | 'en'
}

// Video Job (Nova Reel polling)
export interface VideoJob {
  jobId: string
  sceneNumber: number
  projectId: string
  startedAt: number // Date.now()
  status: 'processing' | 'done' | 'error'
  videoUrl?: string
  errorMessage?: string
  durationSeconds: number
}

export function videoJobKey(projectId: string, sceneNum: number): string {
  return `video_job_${projectId}_${sceneNum}`
}

export function saveVideoJob(job: VideoJob): void {
  localStorage.setItem(videoJobKey(job.projectId, job.sceneNumber), JSON.stringify(job))
}

export function loadVideoJob(projectId: string, sceneNum: number): VideoJob | null {
  try {
    const raw = localStorage.getItem(videoJobKey(projectId, sceneNum))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function clearVideoJob(projectId: string, sceneNum: number): void {
  localStorage.removeItem(videoJobKey(projectId, sceneNum))
}

// Duration
export interface SceneDuration {
  sceneNumber: number
  durationSeconds: number // 2-6 seconds
}

export function redistributeDurations(
  sceneCount: number,
  totalTarget: number
): SceneDuration[] {
  const perScene = Math.max(2, Math.min(6, Math.round(totalTarget / sceneCount)))
  return Array.from({ length: sceneCount }, (_, i) => ({
    sceneNumber: i + 1,
    durationSeconds: perScene,
  }))
}

// Settings Store Types
export interface StoreSettings {
  // AI Brain
  default_brain_model: BrainModel
  gemini_api_key: string
  bedrock_brain_region: AWSRegion

  // Image Generation
  default_image_model: ImageModel
  bedrock_image_region: AWSRegion

  // Video Generation
  default_video_model: VideoModel
  runway_api_key: string
  // Nova Reel: us-east-1 is FIXED, no user config needed

  // Audio TTS
  default_audio_model: AudioModel
  bedrock_audio_region: AWSRegion
  elevenlabs_api_key: string

  // AWS Credentials (shared for all Bedrock services)
  aws_access_key_id: string
  aws_secret_access_key: string

  // Cloudflare R2 (for Nova Reel direct output)
  r2_account_id: string
  r2_access_key_id: string
  r2_secret_access_key: string

  // General
  default_narasi_language: 'id' | 'en'
}

export interface AppSettings {
  // AI Keys
  geminiApiKey: string
  awsAccessKeyId: string
  awsSecretAccessKey: string
  // Region per service
  brainRegion: 'us-east-1' | 'us-west-2' | 'ap-southeast-1'
  imageRegion: 'us-east-1' | 'us-west-2' | 'ap-southeast-1'
  audioRegion: 'us-east-1' | 'us-west-2' | 'ap-southeast-1'
  videoRegion: 'us-east-1' // always fixed
  // Optional
  elevenLabsApiKey: string
  runwayApiKey: string
  dashscopeApiKey: string
  fishAudioApiKey?: string
  // Provider keys (OpenAI-compatible free-tier providers)
  groqApiKey: string
  openrouterApiKey: string
  glmApiKey: string
  cerebrasApiKey: string
  mistralApiKey: string
  siliconflowApiKey: string
  // Audio engine settings
  audioEngine?: 'polly' | 'gemini_tts' | 'fish_audio'  // default: 'gemini_tts'
  audioLanguage?: 'id' | 'en'                            // default: 'id'
  // Image engine settings
  imageEngine?: 'nova-canvas' | 'sd35' | 'wanx' | 'gemini-image' | 'siliconflow-flux' | 'cf-flux'
}

export const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: '',
  awsAccessKeyId: '',
  awsSecretAccessKey: '',
  brainRegion: 'us-east-1',
  imageRegion: 'us-east-1',
  audioRegion: 'us-west-2',
  videoRegion: 'us-east-1',
  elevenLabsApiKey: '',
  runwayApiKey: '',
  dashscopeApiKey: '',
  groqApiKey: '',
  openrouterApiKey: '',
  glmApiKey: '',
  cerebrasApiKey: '',
  mistralApiKey: '',
  siliconflowApiKey: '',
}

export const SETTINGS_STORAGE_KEY = 'fuzzy_short_settings'

export function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
  } catch {}
  return DEFAULT_SETTINGS
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}

// Available Image Engines
export const IMAGE_ENGINES = [
  { id: 'cf-flux',          label: 'CF FLUX',     emoji: '☁️', free: true,  requiresKey: null,              note: 'Gratis via CF Workers' },
  { id: 'gemini-image',     label: 'Gemini',      emoji: '✨', free: true,  requiresKey: 'geminiApiKey',    note: '500 gambar/hari gratis' },
  { id: 'siliconflow-flux', label: 'SF FLUX',     emoji: '🔥', free: true,  requiresKey: 'siliconflowApiKey', note: 'FLUX.1-schnell gratis' },
  { id: 'nova-canvas',      label: 'Nova Canvas', emoji: '🎨', free: false, requiresKey: 'awsAccessKeyId',  note: 'AWS Bedrock' },
  { id: 'sd35',             label: 'SD 3.5',      emoji: '🖼️', free: false, requiresKey: 'awsAccessKeyId',  note: 'us-west-2 only' },
  { id: 'wanx',             label: 'Wanx',        emoji: '🌊', free: false, requiresKey: 'dashscopeApiKey', note: 'Dashscope async' },
] as const

export function buildApiHeaders(settings: AppSettings): Record<string, string> {
  const headers: Record<string, string> = {}
  if (settings.geminiApiKey) headers['X-Gemini-Api-Key'] = settings.geminiApiKey
  if (settings.awsAccessKeyId) headers['X-AWS-Access-Key-Id'] = settings.awsAccessKeyId
  if (settings.awsSecretAccessKey) headers['X-AWS-Secret-Access-Key'] = settings.awsSecretAccessKey
  if (settings.brainRegion) headers['X-Brain-Region'] = settings.brainRegion
  if (settings.imageRegion) headers['X-Image-Region'] = settings.imageRegion
  if (settings.audioRegion) headers['X-Audio-Region'] = settings.audioRegion
  if (settings.elevenLabsApiKey) headers['X-ElevenLabs-Key'] = settings.elevenLabsApiKey
  if (settings.runwayApiKey) headers['X-Runway-Key'] = settings.runwayApiKey
  if (settings.dashscopeApiKey) headers['X-Dashscope-Api-Key'] = settings.dashscopeApiKey
  if (settings.groqApiKey) headers['X-Groq-Api-Key'] = settings.groqApiKey
  if (settings.openrouterApiKey) headers['X-Openrouter-Api-Key'] = settings.openrouterApiKey
  if (settings.glmApiKey) headers['X-Glm-Api-Key'] = settings.glmApiKey
  if (settings.cerebrasApiKey) headers['X-Cerebras-Api-Key'] = settings.cerebrasApiKey
  if (settings.mistralApiKey) headers['X-Mistral-Api-Key'] = settings.mistralApiKey
  if (settings.siliconflowApiKey) headers['X-Siliconflow-Api-Key'] = settings.siliconflowApiKey
  if (settings.fishAudioApiKey) headers['X-FishAudio-Api-Key'] = settings.fishAudioApiKey
  return headers
}
