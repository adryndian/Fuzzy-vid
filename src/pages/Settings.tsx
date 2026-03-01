
import React from 'react';
import useSettingsStore from '../store/settingsStore';
import { GlassCard } from '../components/glass/GlassCard';
import { GlassInput } from '../components/glass/GlassInput';

const Settings: React.FC = () => {
  const settings = useSettingsStore();

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-[#EFE1CF]">Settings</h1>
        <p className="mt-2 text-sm text-[rgba(239,225,207,0.45)]">
          API keys are stored locally in your browser and are never sent to our servers.
        </p>
      </div>

      <GlassCard variant="strong">
        <div className="p-6">
          <h2 className="text-lg font-medium text-[#EFE1CF]">🧠 AI Brain</h2>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="text-sm text-[rgba(239,225,207,0.7)]">Default model</label>
              <select onChange={(e) => settings.setDefaultBrainModel(e.target.value as any)} value={settings.default_brain_model} className="w-full bg-transparent border-b border-white/20 py-2 text-white">
                <option value="gemini">Gemini 1.5 Flash</option>
                <option value="llama4_maverick">Llama 4 Maverick</option>
                <option value="claude_sonnet">Claude Sonnet 4.6</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-[rgba(239,225,207,0.7)]">Gemini API Key</label>
              <GlassInput type="password" value={settings.gemini_api_key} onChange={(e) => settings.setGeminiApiKey(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-[rgba(239,225,207,0.7)]">Bedrock Brain Region</label>
              <select onChange={(e) => settings.setBedrockBrainRegion(e.target.value as any)} value={settings.bedrock_brain_region} className="w-full bg-transparent border-b border-white/20 py-2 text-white">
                <option value="us-east-1">us-east-1</option>
                <option value="us-west-2">us-west-2</option>
              </select>
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="p-6">
          <h2 className="text-lg font-medium text-[#EFE1CF]">🎨 Image Generation</h2>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="text-sm text-[rgba(239,225,207,0.7)]">Default model</label>
              <select onChange={(e) => settings.setDefaultImageModel(e.target.value as any)} value={settings.default_image_model} className="w-full bg-transparent border-b border-white/20 py-2 text-white">
                <option value="gemini">Gemini Imagen</option>
                <option value="nova_canvas">Nova Canvas</option>
                <option value="titan_v2">Titan V2</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-[rgba(239,225,207,0.7)]">Bedrock Image Region</label>
              <select onChange={(e) => settings.setBedrockImageRegion(e.target.value as any)} value={settings.bedrock_image_region} className="w-full bg-transparent border-b border-white/20 py-2 text-white">
                <option value="us-east-1">us-east-1</option>
                <option value="us-west-2">us-west-2</option>
                <option value="ap-southeast-1">ap-southeast-1</option>
              </select>
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="p-6">
          <h2 className="text-lg font-medium text-[#EFE1CF]">🎬 Video Generation</h2>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="text-sm text-[rgba(239,225,207,0.7)]">Default model</label>
              <select onChange={(e) => settings.setDefaultVideoModel(e.target.value as any)} value={settings.default_video_model} className="w-full bg-transparent border-b border-white/20 py-2 text-white">
                <option value="nova_reel">Nova Reel</option>
                <option value="runway_gen4">Runway Gen-4</option>
                <option value="runway_gen4_turbo">Runway Gen-4 Turbo</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-[rgba(239,225,207,0.7)]">Runway API Key</label>
              <GlassInput type="password" value={settings.runway_api_key} onChange={(e) => settings.setRunwayApiKey(e.target.value)} />
            </div>
             <div>
              <label className="text-sm text-[rgba(239,225,207,0.7)]">Nova Reel Region</label>
              <p className='py-2'>us-east-1 (fixed)</p>
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="p-6">
          <h2 className="text-lg font-medium text-[#EFE1CF]">🔊 Audio TTS</h2>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="text-sm text-[rgba(239,225,207,0.7)]">Default model</label>
              <select onChange={(e) => settings.setDefaultAudioModel(e.target.value as any)} value={settings.default_audio_model} className="w-full bg-transparent border-b border-white/20 py-2 text-white">
                <option value="polly">AWS Polly</option>
                <option value="gemini_tts">Gemini TTS</option>
                <option value="elevenlabs">ElevenLabs</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-[rgba(239,225,207,0.7)]">Polly Region</label>
              <select onChange={(e) => settings.setBedrockAudioRegion(e.target.value as any)} value={settings.bedrock_audio_region} className="w-full bg-transparent border-b border-white/20 py-2 text-white">
                 <option value="us-east-1">us-east-1</option>
                <option value="us-west-2">us-west-2</option>
                <option value="ap-southeast-1">ap-southeast-1</option>
              </select>
            </div>
             <div>
              <label className="text-sm text-[rgba(239,225,207,0.7)]">ElevenLabs API Key</label>
              <GlassInput type="password" value={settings.elevenlabs_api_key} onChange={(e) => settings.setElevenLabsApiKey(e.target.value)} />
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="p-6">
          <h2 className="text-lg font-medium text-[#EFE1CF]">☁️ AWS Credentials</h2>
           <p className="mt-2 text-xs text-[rgba(239,225,207,0.45)]">
         Used for Image, Video, Audio, and AI Brain on AWS Bedrock
        </p>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="text-sm text-[rgba(239,225,207,0.7)]">AWS Access Key ID</label>
              <GlassInput value={settings.aws_access_key_id} onChange={(e) => settings.setAwsAccessKeyId(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-[rgba(239,225,207,0.7)]">AWS Secret Access Key</label>
              <GlassInput type="password" value={settings.aws_secret_access_key} onChange={(e) => settings.setAwsSecretAccessKey(e.target.value)} />
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="p-6">
          <h2 className="text-lg font-medium text-[#EFE1CF]">📦 Cloudflare R2</h2>
           <p className="mt-2 text-xs text-[rgba(239,225,207,0.45)]">
          Required only if using Nova Reel video generation.
        </p>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="text-sm text-[rgba(239,225,207,0.7)]">R2 Account ID</label>
              <GlassInput value={settings.r2_account_id} onChange={(e) => settings.setR2AccountId(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-[rgba(239,225,207,0.7)]">R2 Access Key ID</label>
              <GlassInput value={settings.r2_access_key_id} onChange={(e) => settings.setR2AccessKeyId(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-[rgba(239,225,207,0.7)]">R2 Secret Access Key</label>
              <GlassInput type="password" value={settings.r2_secret_access_key} onChange={(e) => settings.setR2SecretAccessKey(e.target.value)} />
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

export default Settings;
