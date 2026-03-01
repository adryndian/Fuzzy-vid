// src/types/schema.ts — NEVER deviate from this

export type ArtStyle = 
  | 'cinematic_realistic' | 'anime_stylized' | 'comic_book'
  | 'oil_painting' | 'watercolor' | 'pixel_art' | '3d_render'

export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5'
export type Resolution = '1080p'

export const ASPECT_RATIOS: { id: AspectRatio; label: string; desc: string; icon: string }[] = [
  { id: '9:16', label: '9:16', desc: 'Vertical', icon: '📱' },
  { id: '16:9', label: '16:9', desc: 'Landscape', icon: '🖥️' },
  { id: '1:1', label: '1:1', desc: 'Square', icon: '⬜' },
  { id: '4:5', label: '4:5', desc: 'Portrait', icon: '🖼️' },
]

export const RESOLUTION = '1080p'

export type Mood = 
  | 'epic' | 'mysterious' | 'romantic' | 'horror' | 'comedy'
  | 'inspirational' | 'melancholic' | 'action'

export type BrainModel = 'gemini' | 'llama4_maverick' | 'claude_sonnet'
export type ImageModel = 'gemini' | 'nova_canvas' | 'titan_v2'
export type VideoModel = 'nova_reel' | 'runway_gen4' | 'runway_gen4_turbo'
export type VoiceGender = 'male' | 'female'
export type AudioModel = 'polly' | 'gemini_tts' | 'elevenlabs'

export type AWSRegion = 
  | 'us-west-2' | 'us-east-1' | 'ap-southeast-1'

export type AssetStatus = 'pending' | 'generating' | 'done' | 'approved' | 'failed'
export type LockedStatus = 'locked'

export interface ProjectSchema {
  project_id: string
  metadata: {
    title: string
    created_at: string
    target_platform: 'youtube_shorts' | 'reels' | 'tiktok'
    aspect_ratio: '9:16'
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

export function buildApiHeaders(settings: AppSettings): Record<string, string> {
  const headers: Record<string, string> = {}
  if (settings.geminiApiKey) headers['X-Gemini-Key'] = settings.geminiApiKey
  if (settings.awsAccessKeyId) headers['X-AWS-Access-Key-Id'] = settings.awsAccessKeyId
  if (settings.awsSecretAccessKey) headers['X-AWS-Secret-Access-Key'] = settings.awsSecretAccessKey
  if (settings.brainRegion) headers['X-Brain-Region'] = settings.brainRegion
  if (settings.imageRegion) headers['X-Image-Region'] = settings.imageRegion
  if (settings.audioRegion) headers['X-Audio-Region'] = settings.audioRegion
  if (settings.elevenLabsApiKey) headers['X-ElevenLabs-Key'] = settings.elevenLabsApiKey
  if (settings.runwayApiKey) headers['X-Runway-Key'] = settings.runwayApiKey
  return headers
}
