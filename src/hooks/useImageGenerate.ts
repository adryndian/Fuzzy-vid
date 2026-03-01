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
  const { updateScene } = useProjectStore()

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

  const { data: status, isLoading: isCheckingStatus } = useQuery<ImageStatusResponse>(
    {
      queryKey: ['image-status', mutation.data?.job_id],
      queryFn: () => api.get(`/api/image/status/${mutation.data!.job_id}`),
      enabled: !!mutation.data?.job_id,
      refetchInterval: (query) => {
        const data = query.state.data
        if (data?.status === 'done' || data?.status === 'failed') {
          return false
        }
        return 5000 // 5s
      },
      onSuccess: (data) => {
        if (data.status === 'done') {
          updateScene(sceneId, {
            status: { ...useProjectStore.getState().getScene(sceneId)!.status, image: 'done' },
            assets: { 
              ...useProjectStore.getState().getScene(sceneId)!.assets,
              image_url: data.image_url, 
              image_r2_key: data.r2_key 
            },
          })
        } else if (data.status === 'failed') {
          updateScene(sceneId, {
            status: { ...useProjectStore.getState().getScene(sceneId)!.status, image: 'failed' },
          })
        }
      },
    }
  )

  return {
    generate: mutation.mutate,
    isStarting: mutation.isPending,
    isGenerating: status?.status === 'generating' || isCheckingStatus,
  }
}
