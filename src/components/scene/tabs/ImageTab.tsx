import React from 'react';
import type { Scene } from '../../../types/schema';
import { useImageGeneration } from '../../../hooks/useImageGenerate';
import { useProjectStore } from '../../../store/projectStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { Button } from '../../ui/button';
import { Image, Loader, Check, AlertTriangle } from 'lucide-react';
import { GlassCard } from '../../glass/GlassCard';
import { ImageSkeleton } from '../../skeletons/ImageSkeleton';

interface ImageTabProps {
  scene: Scene;
}

const ImageTab: React.FC<ImageTabProps> = ({ scene }) => {
  const { project, updateScene, getScene } = useProjectStore();
  const { bedrock_image_region, default_image_model } = useSettingsStore();

  const { generate, isStarting, isGenerating } = useImageGeneration(scene.scene_id);

  const currentScene = getScene(scene.scene_id)!;

  const handleGenerateImage = () => {
    if (project) {
      generate({
        scene: currentScene,
        projectId: project.project_id,
        imageModel: currentScene.recommended_image_model || default_image_model,
        awsRegion: bedrock_image_region,
      });
    }
  };

  const handleApprove = () => {
    updateScene(scene.scene_id, {
      status: { ...currentScene.status, image: 'approved', video: 'pending' }, // Unlock video
    });
  };

  const handleRetry = () => {
    updateScene(scene.scene_id, { 
      status: { ...currentScene.status, image: 'pending' }
    });
    handleGenerateImage();
  };

  const status = currentScene.status.image;
  const isLoading = isStarting || isGenerating;
  const isDone = status === 'done' || status === 'approved';

  return (
    <div className="p-2 md:p-4 space-y-4">
      <GlassCard>
        <div className="aspect-[9/16] w-full rounded-lg bg-black/20 overflow-hidden relative">
          {currentScene.assets.image_url ? (
            <img src={currentScene.assets.image_url} alt={`Scene ${scene.scene_id}`} className="w-full h-full object-cover" />
          ) : (
            <ImageSkeleton isLoading={isLoading} />
          )}
        </div>
      </GlassCard>

      <GlassCard variant="subtle" className="p-4">
        <h3 className="text-lg font-semibold text-cream mb-2">Image Prompt</h3>
        <p className="text-sm text-text-secondary bg-black/20 p-3 rounded-md font-mono whitespace-pre-wrap">
          {currentScene.image_prompt ? JSON.stringify(currentScene.image_prompt, null, 2) : "No prompt available."}
        </p>
      </GlassCard>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button size="lg" onClick={handleGenerateImage} disabled={isLoading || isDone} className="flex-1">
          {isLoading ? <><Loader size={20} className="animate-spin mr-2" /> Generating...</> : <><Image size={20} className="mr-2" /> Generate Image</>}
        </Button>

        <Button size="lg" onClick={handleApprove} disabled={!isDone || status === 'approved'} className="flex-1">
          <Check size={20} className="mr-2" /> {status === 'approved' ? 'Image Approved' : 'Approve Image'}
        </Button>
      </div>

      {status === 'failed' && (
        <GlassCard variant="subtle" className="p-4 border-accent-orange/50">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-accent-orange" size={24} />
            <div>
              <h4 className="font-bold text-cream">Image Generation Failed</h4>
              <p className="text-sm text-text-secondary">An error occurred. Please try again.</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={handleRetry}>Retry</Button>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
};

export { ImageTab };