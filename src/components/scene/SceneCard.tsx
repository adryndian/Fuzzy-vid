import React from 'react';
import type { Scene } from '../../types/schema';
import { useProjectStore } from '../../store/projectStore';
import { GlassCard } from '../glass/GlassCard';
import { ImageTab } from './tabs/ImageTab';
import { VideoTab } from './tabs/VideoTab';
import { AudioTab } from './tabs/AudioTab';

interface SceneCardProps {
  scene: Scene;
}

export const SceneCard: React.FC<SceneCardProps> = ({ scene }) => {
  const { project } = useProjectStore();
  const [activeTab, setActiveTab] = React.useState('image');

  // Find the most up-to-date scene data from the store
  const currentScene = project?.scenes.find((s) => s.scene_id === scene.scene_id);

  if (!currentScene) {
    return null; // Or a loading/error state
  }

  const isImageApproved = currentScene.status.image === 'approved';
  const isVideoApproved = currentScene.status.video === 'approved';

  return (
    <GlassCard>
      <div className="p-4">
        <h3 className="text-lg font-semibold">Scene {currentScene.scene_id}: {currentScene.title}</h3>
        <p className="text-sm text-text-secondary">{currentScene.narrative_voiceover.text_en}</p>

        <div className="flex space-x-2 mt-4 border-b border-glass-border-01 mb-4">
            <button 
                onClick={() => setActiveTab('image')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'image' ? 'text-accent-orange border-b-2 border-accent-orange' : 'text-text-secondary hover:text-text-primary'}`}>
                Image
            </button>
            <button 
                onClick={() => setActiveTab('video')}
                disabled={!isImageApproved}
                className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'video' ? 'text-accent-orange border-b-2 border-accent-orange' : 'text-text-secondary hover:text-text-primary'} disabled:text-text-muted disabled:cursor-not-allowed`}>
                Video
            </button>
            <button 
                onClick={() => setActiveTab('audio')}
                disabled={!isVideoApproved}
                className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'audio' ? 'text-accent-orange border-b-2 border-accent-orange' : 'text-text-secondary hover:text-text-primary'} disabled:text-text-muted disabled:cursor-not-allowed`}>
                Audio
            </button>
        </div>

        {activeTab === 'image' && <ImageTab scene={currentScene} />}
        {activeTab === 'video' && isImageApproved && <VideoTab scene={currentScene} />}
        {activeTab === 'audio' && isVideoApproved && <AudioTab scene={currentScene} />}
      </div>
    </GlassCard>
  );
};
