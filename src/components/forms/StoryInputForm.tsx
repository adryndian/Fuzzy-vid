import React, { useState } from 'react';
import { GlassCard } from '../glass/GlassCard';
import { GlassButton } from '../glass/GlassButton';
import { GlassInput } from '../glass/GlassInput';
import { useSettingsStore } from '../../store/settingsStore';
import type { BrainModel, ArtStyle } from '../../types/schema';
import { Bot, Loader, Monitor, Smartphone, MessageSquare, Globe, Image as ImageIcon, Layers } from 'lucide-react';
import { useBrainGenerate } from '../../hooks/useBrainGenerate';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';

const ART_STYLES: { id: ArtStyle; label: string; icon: string }[] = [
  { id: 'cinematic_realistic', label: 'Cinematic', icon: '🎬' },
  { id: 'anime_stylized', label: 'Anime', icon: '🎎' },
  { id: 'comic_book', label: 'Comic', icon: '💥' },
  { id: '3d_render', label: '3D Render', icon: '🧊' },
  { id: 'oil_painting', label: 'Oil Painting', icon: '🎨' },
  { id: 'pixel_art', label: 'Pixel Art', icon: '👾' },
];

export const StoryInputForm: React.FC = () => {
  const [storyPrompt, setStoryPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState<'youtube_shorts' | 'reels' | 'tiktok'>('youtube_shorts');
  const [artStyle, setArtStyle] = useState<ArtStyle>('cinematic_realistic');
  const [numScenes, setNumScenes] = useState(5);
  
  const { 
    default_brain_model, 
    default_narasi_language, 
    setDefaultBrainModel, 
    setDefaultNarasiLanguage 
  } = useSettingsStore();
  
  const brainGenerateMutation = useBrainGenerate();
  const navigate = useNavigate();

  const handleGenerate = async () => {
    try {
      const result = await brainGenerateMutation.mutateAsync({
        prompt: `Title: ${title}. Story: ${storyPrompt}. Art Style: ${artStyle}. Scenes: ${numScenes}. Platform: ${platform}`,
        model: default_brain_model,
        narasi_language: default_narasi_language,
      });
      navigate(`/storyboard/${result.project_id}`);
    } catch (error) {
      console.error('Failed to generate storyboard:', error);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Title Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--text-secondary)] ml-1">Story Title</label>
        <GlassInput 
          placeholder="Enter a catchy title..." 
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-lg py-4 px-6 rounded-2xl bg-[var(--glass-02)] border-[var(--glass-border-02)]"
        />
      </div>

      {/* Platform Selector */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-[var(--text-secondary)] ml-1 flex items-center gap-2">
          <Monitor size={14} /> Target Platform
        </label>
        <div className="flex p-1.5 bg-[var(--glass-01)] border border-[var(--glass-border-01)] rounded-2xl gap-1">
          {(['youtube_shorts', 'reels', 'tiktok'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 capitalize",
                platform === p 
                  ? "bg-[var(--accent-blue)] text-white shadow-[var(--glow-blue)]" 
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-01)]"
              )}
            >
              {p.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Story Prompt */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-[var(--text-secondary)] ml-1 flex items-center gap-2">
          <MessageSquare size={14} /> The Story
        </label>
        <textarea
          className="w-full min-h-[160px] rounded-2xl border border-[var(--glass-border-02)] bg-[var(--glass-02)] p-6 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)] transition-all resize-none"
          placeholder="Describe your story in detail... The AI will build a visual storyboard from this."
          value={storyPrompt}
          onChange={(e) => setStoryPrompt(e.target.value)}
        />
      </div>

      {/* Brain Model Selector */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-[var(--text-secondary)] ml-1 flex items-center gap-2">
          <Bot size={14} /> AI Brain
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(['gemini', 'llama4_maverick', 'claude_sonnet'] as BrainModel[]).map((m) => (
            <button
              key={m}
              onClick={() => setDefaultBrainModel(m)}
              className={cn(
                "p-4 rounded-2xl border transition-all duration-300 text-center flex flex-col items-center gap-2",
                default_brain_model === m
                  ? "bg-[var(--glass-03)] border-[var(--accent-orange)] shadow-[0_0_15px_rgba(240,90,37,0.2)]"
                  : "bg-[var(--glass-01)] border-[var(--glass-border-01)] hover:border-[var(--glass-border-03)]"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                default_brain_model === m ? "bg-[var(--accent-orange)] text-white" : "bg-[var(--glass-02)] text-[var(--text-muted)]"
              )}>
                {m[0].toUpperCase()}
              </div>
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-wider",
                default_brain_model === m ? "text-[var(--accent-orange)]" : "text-[var(--text-muted)]"
              )}>
                {m.split('_')[0]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Language Toggle */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-[var(--text-secondary)] ml-1 flex items-center gap-2">
            <Globe size={14} /> Narration
          </label>
          <div className="flex p-1 bg-[var(--glass-01)] border border-[var(--glass-border-01)] rounded-xl gap-1">
            {(['id', 'en'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setDefaultNarasiLanguage(l)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
                  default_narasi_language === l
                    ? "bg-white/10 text-[var(--text-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                )}
              >
                {l === 'id' ? '🇮🇩 Indo' : '🇬🇧 English'}
              </button>
            ))}
          </div>
        </div>

        {/* Scene Slider */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-[var(--text-secondary)] ml-1 flex items-center gap-2">
            <Layers size={14} /> {numScenes} Scenes
          </label>
          <input
            type="range"
            min="3"
            max="15"
            value={numScenes}
            onChange={(e) => setNumScenes(parseInt(e.target.value))}
            className="w-full h-1.5 bg-[var(--glass-02)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-blue)]"
          />
        </div>
      </div>

      {/* Art Style Grid */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-[var(--text-secondary)] ml-1 flex items-center gap-2">
          <ImageIcon size={14} /> Art Style
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {ART_STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => setArtStyle(style.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all duration-300",
                artStyle === style.id
                  ? "bg-[var(--glass-03)] border-[var(--accent-blue)]"
                  : "bg-[var(--glass-01)] border-[var(--glass-border-01)] hover:border-[var(--glass-border-02)]"
              )}
            >
              <span className="text-lg">{style.icon}</span>
              <span className={cn(
                "text-[9px] font-semibold text-center leading-tight",
                artStyle === style.id ? "text-[var(--accent-blue)]" : "text-[var(--text-muted)]"
              )}>
                {style.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <div className="pt-4">
        <button
          onClick={handleGenerate}
          disabled={brainGenerateMutation.isPending || !storyPrompt || !title}
          className={cn(
            "group relative w-full py-5 rounded-2xl font-bold text-lg transition-all duration-500 flex items-center justify-center gap-3 overflow-hidden",
            "bg-[var(--accent-orange)] text-white shadow-[var(--glow-orange)]",
            "hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
          )}
        >
          {brainGenerateMutation.isPending ? (
            <>
              <Loader className="animate-spin" size={20} />
              <span>Architecting Story...</span>
            </>
          ) : (
            <>
              <Bot size={20} className="group-hover:rotate-12 transition-transform" />
              <span>Generate Storyboard</span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
            </>
          )}
        </button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
};
