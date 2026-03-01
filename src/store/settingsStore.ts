import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings, BrainModel, ImageModel, VideoModel, AudioModel, AWSRegion } from '../types/schema';

type SettingsState = AppSettings;

type SettingsActions = {
  setGeminiApiKey: (key: string) => void;
  setBedrockBrainRegion: (region: AWSRegion) => void;
  setDefaultBrainModel: (model: BrainModel) => void;
  setBedrockImageRegion: (region: AWSRegion) => void;
  setDefaultImageModel: (model: ImageModel) => void;
  setRunwayApiKey: (key: string) => void;
  setDefaultVideoModel: (model: VideoModel) => void;
  setBedrockAudioRegion: (region: AWSRegion) => void;
  setDefaultAudioModel: (model: AudioModel) => void;
  setElevenLabsApiKey: (key: string) => void;
  setAwsAccessKeyId: (key: string) => void;
  setAwsSecretAccessKey: (key: string) => void;
  setR2AccountId: (id: string) => void;
  setR2AccessKeyId: (id: string) => void;
  setR2SecretAccessKey: (key: string) => void;
  setDefaultNarasiLanguage: (lang: 'id' | 'en') => void;
};

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      // AI Brain
      default_brain_model: 'gemini',
      gemini_api_key: '',
      bedrock_brain_region: 'us-east-1',

      // Image Generation
      default_image_model: 'gemini',
      bedrock_image_region: 'us-east-1',

      // Video Generation
      default_video_model: 'nova_reel',
      runway_api_key: '',

      // Audio TTS
      default_audio_model: 'polly',
      bedrock_audio_region: 'us-east-1',
      elevenlabs_api_key: '',

      // AWS Credentials
      aws_access_key_id: '',
      aws_secret_access_key: '',

      // Cloudflare R2
      r2_account_id: '',
      r2_access_key_id: '',
      r2_secret_access_key: '',

      // General
      default_narasi_language: 'en',

      // Actions
      setGeminiApiKey: (key) => set({ gemini_api_key: key }),
      setBedrockBrainRegion: (region) => set({ bedrock_brain_region: region }),
      setDefaultBrainModel: (model) => set({ default_brain_model: model }),
      setBedrockImageRegion: (region) => set({ bedrock_image_region: region }),
      setDefaultImageModel: (model) => set({ default_image_model: model }),
      setRunwayApiKey: (key) => set({ runway_api_key: key }),
      setDefaultVideoModel: (model) => set({ default_video_model: model }),
      setBedrockAudioRegion: (region) => set({ bedrock_audio_region: region }),
      setDefaultAudioModel: (model) => set({ default_audio_model: model }),
      setElevenLabsApiKey: (key) => set({ elevenlabs_api_key: key }),
      setAwsAccessKeyId: (key) => set({ aws_access_key_id: key }),
      setAwsSecretAccessKey: (key) => set({ aws_secret_access_key: key }),
      setR2AccountId: (id) => set({ r2_account_id: id }),
      setR2AccessKeyId: (id) => set({ r2_access_key_id: id }),
      setR2SecretAccessKey: (key) => set({ r2_secret_access_key: key }),
      setDefaultNarasiLanguage: (lang) => set({ default_narasi_language: lang }),
    }),
    {
      name: 'fuzzy-short-settings',
    }
  )
);
