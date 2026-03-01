import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { api } from '../lib/api'
import type { ImageModel, Scene } from '../types/schema'
import useProjectStore from '../store/projectStore'

interface GenerateImageProps {
  projectId: string
  scene: Scene
  imageModel: ImageModel
  awsRegion: string
}

interface ImageStatusResponse {
  status: 'generating' | 'done' | 'failed'
  r2_key?: string
  image_url?: string
  error?: string
}

export function useImageGeneration(sceneId: number) {
  const queryClient = useQueryClient()
  const { updateScene, getScene } = useProjectStore()

  const mutation = useMutation({
    mutationFn: async (props: GenerateImageProps) => {
      return api.post('/api/image/generate', props) as Promise<{ job_id: string }>
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['image-status', data.job_id], { status: 'generating' })
      updateScene(variables.scene.scene_id, {
        status: { ...variables.scene.status, image: 'generating' },
      })
    },
  })

  const { data: statusResponse, isLoading: isCheckingStatus } = useQuery<ImageStatusResponse>(
    {
      queryKey: ['image-status', mutation.data?.job_id],
      queryFn: () => api.get(`/api/image/status/${mutation.data!.job_id}`),
      enabled: !!mutation.data?.job_id,
      refetchInterval: (query) => (query.state.data?.status === 'done' || query.state.data?.status === 'failed') ? false : 5000,
    }
  )

  useEffect(() => {
    if (statusResponse?.status === 'done') {
      const currentScene = getScene(sceneId);
      if (currentScene) {
        updateScene(sceneId, {
          status: { ...currentScene.status, image: 'done' },
          assets: { 
            ...currentScene.assets,
            image_url: statusResponse.image_url, 
            image_r2_key: statusResponse.r2_key 
          },
        })
      }
    } else if (statusResponse?.status === 'failed') {
      const currentScene = getScene(sceneId);
      if (currentScene) {
        updateScene(sceneId, {
          status: { ...currentScene.status, image: 'failed' },
        })
      }
    }
  }, [statusResponse, sceneId, updateScene, getScene])

  return {
    generate: mutation.mutate,
    isStarting: mutation.isPending,
    isGenerating: statusResponse?.status === 'generating' || isCheckingStatus,
  }
}
