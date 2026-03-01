import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../lib/api';
import { useProjectStore } from '../store/projectStore';
import type { ProjectSchema, BrainModel, ArtStyle } from '../types/schema';

interface GenerateBrainProps {
  title: string;
  story: string;
  platform: 'youtube_shorts' | 'reels' | 'tiktok';
  brain_model: BrainModel;
  language: 'id' | 'en';
  art_style: ArtStyle;
  total_scenes: number;
}

const generateBrain = async (props: GenerateBrainProps): Promise<ProjectSchema> => {
  return api.post('/api/brain/generate', props);
};

export const useBrainGenerate = () => {
  const setProject = useProjectStore((state) => state.setProject);

  const mutation = useMutation({
    mutationFn: generateBrain,
  });

  useEffect(() => {
    if (mutation.data) {
      setProject(mutation.data);
    }
  }, [mutation.data, setProject]);

  return {
    generate: mutation.mutate,
    isLoading: mutation.isPending,
    data: mutation.data,
    error: mutation.error,
  };
};
