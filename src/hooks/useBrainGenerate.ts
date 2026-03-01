import { useMutation } from '@tanstack/react-query';
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
  // Map fields if needed or pass as is
  return api.post('/api/brain/generate', props);
};

export const useBrainGenerate = () => {
  const setProject = useProjectStore((state) => state.setProject);

  const mutation = useMutation({
    mutationFn: generateBrain,
    onSuccess: (data) => {
      setProject(data);
    },
  });

  return {
    generate: mutation.mutate,
    isLoading: mutation.isPending,
    data: mutation.data,
    error: mutation.error,
  };
};
