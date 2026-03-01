import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { api } from '../lib/api'
import { useProjectStore } from '../store/projectStore'
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
  const { updateScene, getScene } = useProjectStore()

  const mutation = useMutation({
    mutationFn: async (props: GenerateVideoProps) => {
      return api.post('/api/video/generate', props) as Promise<{ job_id: string }>
    },
  })

  useEffect(() => {
    if (mutation.data) {
      queryClient.setQueryData(['video-status', mutation.data.job_id], { status: 'processing', progress: 0 })
      const currentScene = getScene(sceneId);
      if (currentScene) {
        updateScene(sceneId, {
          status: { ...currentScene.status, video: 'generating' },
        })
      }
    }
  }, [mutation.data, queryClient, sceneId, getScene, updateScene])

  const { data: statusResponse, isLoading: isCheckingStatus } = useQuery<VideoStatusResponse>({
    queryKey: ['video-status', mutation.data?.job_id],
    queryFn: () => api.get(`/api/video/status/${mutation.data!.job_id}`),
    enabled: !!mutation.data?.job_id,
    refetchInterval: (query) => (query.state.data?.status === 'done' || query.state.data?.status === 'failed') ? false : 5000,
  })

  useEffect(() => {
    if (statusResponse?.status === 'done') {
      const currentScene = getScene(sceneId);
      if (currentScene) {
        updateScene(sceneId, {
          status: { ...currentScene.status, video: 'done' },
          assets: { 
            ...currentScene.assets, 
            video_url: statusResponse.video_url, 
            video_r2_key: statusResponse.r2_key 
          },
        })
      }
    } else if (statusResponse?.status === 'failed') {
      const currentScene = getScene(sceneId);
      if (currentScene) {
        updateScene(sceneId, {
          status: { ...currentScene.status, video: 'failed' },
        })
      }
    }
  }, [statusResponse, sceneId, updateScene, getScene])

  return {
    generate: mutation.mutate,
    isStarting: mutation.isPending,
    isGenerating: statusResponse?.status === 'processing' || isCheckingStatus,
    progress: statusResponse?.progress,
  }
}
