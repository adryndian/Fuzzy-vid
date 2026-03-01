import React, { useState } from 'react';
import { GlassCard } from '../glass/GlassCard';
import { GlassButton } from '../glass/GlassButton';
import { useSettingsStore } from '../../store/settingsStore';
import type { BrainModel } from '../../types/schema';
import { Bot, Loader } from 'lucide-react';
import { useBrainGenerate } from '../../hooks/useBrainGenerate';
import { useNavigate } from 'react-router-dom';

export const StoryInputForm: React.FC = () => {
  const [storyPrompt, setStoryPrompt] = useState('');
  const { default_brain_model, default_narasi_language, setDefaultBrainModel } = useSettingsStore();
  const brainGenerateMutation = useBrainGenerate();
  const navigate = useNavigate();

  const handleGenerate = async () => {
    try {
      const result = await brainGenerateMutation.mutateAsync({
        prompt: storyPrompt,
        model: default_brain_model,
        narasi_language: default_narasi_language,
      });
      navigate(`/storyboard/${result.project_id}`);
    } catch (error) {
      console.error('Failed to generate storyboard:', error);
    }
  };

  return (
    <GlassCard variant="strong" className="p-6">
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-text-primary">Create Your Story</h2>
        <textarea
          className="relative block w-full rounded-lg border border-glass-border-02 bg-glass-01 px-3 py-2 text-text-primary shadow-inner placeholder:text-text-muted focus:border-glass-border-03 focus:outline-none focus:ring-1 focus:ring-accent-blue min-h-[120px]"
          placeholder="A hero's journey in ancient Indonesia..."
          value={storyPrompt}
          onChange={(e) => setStoryPrompt(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-4">
          {/* Brain Model Selector */}
          <div>
            <label className="text-xs text-text-secondary mb-1 block">AI Brain</label>
            <select 
              value={default_brain_model} 
              onChange={(e) => setDefaultBrainModel(e.target.value as BrainModel)}
              className="relative block w-full rounded-lg border border-glass-border-02 bg-glass-01 px-3 py-2 text-text-primary shadow-inner focus:border-glass-border-03 focus:outline-none focus:ring-1 focus:ring-accent-blue"
            >
              <option value="gemini">Gemini 1.5 Flash</option>
              <option value="llama4_maverick">Llama 4 Maverick</option>
              <option value="claude_sonnet">Claude Sonnet 4.6</option>
            </select>
          </div>
          {/* Other options will go here */}
        </div>
        <GlassButton onClick={handleGenerate} className="w-full" disabled={brainGenerateMutation.isPending}>
          {brainGenerateMutation.isPending ? (
            <>
              <Loader className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Bot size={16} className="mr-2" />
              Generate Storyboard
            </>
          )}
        </GlassButton>
      </div>
    </GlassCard>
  );
};