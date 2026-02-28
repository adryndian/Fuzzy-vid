import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { VideoModel } from '../types/schema'

interface GenerateVideoProps {
  project_id: string
  scene_id: number
  video_prompt: unknown
  model: VideoModel
  image_r2_key: string
}

interface VideoStatusResponse {
  status: 'processing' | 'done' | 'failed'
  r2_key?: string
  video_url?: string
  error?: string
}

export function useVideoGenerate() {
  const mutation = useMutation({
    mutationFn: async (props: GenerateVideoProps) => {
      return api.post('/api/video/generate', props) as Promise<{ job_id: string }>
    }
  })

  return { generate: mutation.mutate, isLoading: mutation.isPending, error: mutation.error, jobId: mutation.data?.job_id }
}

export function useVideoStatus(jobId: string | undefined, enabled: boolean) {
  const query = useQuery({
    queryKey: ['video-status', jobId],
    queryFn: () => api.get(`/api/video/status/${jobId}`) as Promise<VideoStatusResponse>,
    enabled: !!jobId && enabled,
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.status === 'done' || data?.status === 'failed') return false
      return 30000
    }
  })

  return query
}
