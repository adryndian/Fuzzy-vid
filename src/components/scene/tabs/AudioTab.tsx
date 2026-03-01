import React from 'react';
import type { Scene } from '../../../types/schema';
import useProjectStore from '../../../store/projectStore';
import { useAudioGenerate } from '../../../hooks/useAudioGenerate';
import { GlassButton } from '../../glass/GlassButton';

interface AudioTabProps {
  scene: Scene;
}

export const AudioTab: React.FC<AudioTabProps> = ({ scene }) => {
  const { project, updateScene } = useProjectStore();

  const { mutate: generateAudio, isPending } = useAudioGenerate();

  const handleGenerateAudio = () => {
    if (!project) return;

    generateAudio({
      scene,
      projectId: project.project_id,
      audioConfig: scene.audio,
    });

    updateScene(scene.scene_id, { 
      status: { ...scene.status, audio: 'generating' } 
    });
  };

  const handleApprove = () => {
    updateScene(scene.scene_id, { 
      status: { ...scene.status, audio: 'approved' } 
    });
  };

  const status = scene.status.audio;

  return (
    <div>
      <p className="text-sm text-text-secondary mb-2">Narrator: {scene.audio.voice_character}</p>
      <p className="text-sm text-text-secondary mb-4">{scene.narrative_voiceover.text_en}</p>

      {status === 'pending' && (
        <GlassButton onClick={handleGenerateAudio} disabled={isPending}>
          {isPending ? 'Generating...' : 'Generate Audio'}
        </GlassButton>
      )}

      {status === 'generating' && <p>Generating audio...</p>}

      {status === 'done' && scene.assets.audio_url && (
        <div className="space-y-4">
          <audio controls src={scene.assets.audio_url} className="w-full" />
          <GlassButton onClick={handleApprove}>Approve Audio</GlassButton>
        </div>
      )}

      {status === 'approved' && <p className="text-accent-blue">Audio Approved!</p>}

      {status === 'failed' && <p className="text-red-500">Audio generation failed.</p>}
    </div>
  );
};
