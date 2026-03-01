import React from 'react';
import type { Scene } from '../../../types/schema';
import { useVideoGeneration } from '../../../hooks/useVideoGenerate';
import { useProjectStore } from '../../../store/projectStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { Button } from '../../ui/button';
import { Video, Loader, Check, AlertTriangle, Download } from 'lucide-react';
import { GlassCard } from '../../glass/GlassCard';
import { VideoProgressBar } from '../../skeletons/VideoProgressBar';

interface VideoTabProps {
  scene: Scene;
}

const VideoTab: React.FC<VideoTabProps> = ({ scene }) => {
  const { project, updateScene, getScene } = useProjectStore();
  const { default_video_model } = useSettingsStore();

  const { generate, isStarting, isGenerating, progress } = useVideoGeneration(scene.scene_id);
  
  const currentScene = getScene(scene.scene_id)!;

  const handleGenerateVideo = () => {
    if (project && currentScene.assets.image_r2_key) {
      generate({
        image_r2_key: currentScene.assets.image_r2_key,
        model: currentScene.video_prompt.model_preference || default_video_model,
        project_id: project.project_id,
        scene_id: currentScene.scene_id,
      });
    }
  };

  const handleApprove = () => {
    updateScene(scene.scene_id, {
      status: { ...currentScene.status, video: 'approved', audio: 'pending' }, // Unlock audio
    });
  };

  const handleRetry = () => {
    updateScene(scene.scene_id, { 
      status: { ...currentScene.status, video: 'pending' }
    });
    handleGenerateVideo();
  }

  if (currentScene.status.image !== 'approved') {
    return (
      <div className="p-8 text-center text-text-muted">
        Please approve the image for this scene to unlock video generation.
      </div>
    );
  }

  const status = currentScene.status.video;
  const isLoading = isStarting || isGenerating;
  const isDone = status === 'done' || status === 'approved';

  return (
    <div className="p-2 md:p-4 space-y-4">
      <GlassCard>
        <div className="aspect-[9/16] w-full rounded-lg bg-black/20 overflow-hidden relative">
          {currentScene.assets.video_url ? (
            <video src={currentScene.assets.video_url} className="w-full h-full object-cover" controls playsInline autoPlay muted loop />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isLoading ? 
                <VideoProgressBar progress={progress || 0} /> :
                <Video size={48} className="text-text-muted" />
              }
            </div>
          )}
        </div>
      </GlassCard>

      <GlassCard variant="subtle" className="p-4">
        <h3 className="text-lg font-semibold text-cream mb-2">Video Prompt</h3>
        <p className="text-sm text-text-secondary bg-black/20 p-3 rounded-md font-mono whitespace-pre-wrap">
          {currentScene.video_prompt ? JSON.stringify(currentScene.video_prompt, null, 2) : "No prompt available."}
        </p>
      </GlassCard>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button size="lg" onClick={handleGenerateVideo} disabled={isLoading || isDone} className="flex-1">
          {isLoading ? <><Loader size={20} className="animate-spin mr-2" /> Generating Video...</> : <><Video size={20} className="mr-2" /> Generate Video</>}
        </Button>

        <Button size="lg" onClick={handleApprove} disabled={!isDone || status === 'approved'} className="flex-1">
          <Check size={20} className="mr-2" /> {status === 'approved' ? 'Video Approved' : 'Approve Video'}
        </Button>
      </div>

      {isDone && currentScene.assets.video_url && (
        <GlassCard variant="strong" className="p-3">
          <a href={currentScene.assets.video_url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="w-full">
              <Download size={16} className="mr-2" />
              Download Video
            </Button>
          </a>
        </GlassCard>
      )}

      {status === 'failed' && (
        <GlassCard variant="subtle" className="p-4 border-accent-orange/50">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-accent-orange" size={24} />
            <div>
              <h4 className="font-bold text-cream">Video Generation Failed</h4>
              <p className="text-sm text-text-secondary">An error occurred. Please try again.</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={handleRetry}>Retry</Button>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
};

export { VideoTab };