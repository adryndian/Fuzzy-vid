import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import useProjectStore from '../store/projectStore'
import type { VideoModel } from '../types/schema'

interface GenerateVideoProps {
  project_id: string
  scene_id: number
  image_r2_key: string
  model: VideoModel
}

interface VideoStatusResponse {
  status: 'processing' | 'done' | 'failed'
  video_url?: string
  r2_key?: string
  error?: string
  progress?: number
}

export function useVideoGeneration(sceneId: number) {
  const queryClient = useQueryClient()
  const { updateScene } = useProjectStore()

  const mutation = useMutation({
    mutationFn: async (props: GenerateVideoProps) => {
      return api.post('/api/video/generate', props) as Promise<{ job_id: string }>
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['video-status', data.job_id], { status: 'processing', progress: 0 })
      updateScene(sceneId, {
        status: { ...useProjectStore.getState().getScene(sceneId)!.status, video: 'generating' },
      })
    },
  })

  const { data, isLoading: isCheckingStatus } = useQuery<VideoStatusResponse>({
    queryKey: ['video-status', mutation.data?.job_id],
    queryFn: () => api.get(`/api/video/status/${mutation.data!.job_id}`),
    enabled: !!mutation.data?.job_id,
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.status === 'done' || data?.status === 'failed') {
        return false
      }
      return 30000 // 30s
    },
    onSuccess: (data) => {
      if (data.status === 'done') {
        updateScene(sceneId, {
          status: { ...useProjectStore.getState().getScene(sceneId)!.status, video: 'done' },
          assets: { 
            ...useProjectStore.getState().getScene(sceneId)!.assets, 
            video_url: data.video_url, 
            video_r2_key: data.r2_key 
          },
        })
      } else if (data.status === 'failed') {
        updateScene(sceneId, {
          status: { ...useProjectStore.getState().getScene(sceneId)!.status, video: 'failed' },
        })
      } else if (data.status === 'processing' && data.progress) {
        // You might want to update a progress indicator here, maybe in a different store
      }
    },
  })

  return {
    generate: mutation.mutate,
    isStarting: mutation.isPending,
    isGenerating: data?.status === 'processing' || isCheckingStatus,
    progress: data?.progress,
  }
}
