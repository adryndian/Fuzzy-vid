import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { api } from '../lib/api'
import type { ImageModel } from '../types/schema'

interface GenerateImageProps {
  project_id: string
  scene_id: number
  image_prompt: unknown
  model: ImageModel
  character_ref_url?: string
}

interface ImageStatusResponse {
  status: 'processing' | 'done' | 'failed'
  r2_key?: string
  image_url?: string
  error?: string
}

export function useImageGenerate() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (props: GenerateImageProps) => {
      return api.post('/api/image/generate', props) as Promise<{ job_id: string }>
    }
  })

  return { generate: mutation.mutate, isLoading: mutation.isPending, error: mutation.error, jobId: mutation.data?.job_id }
}

export function useImageStatus(jobId: string | undefined, enabled: boolean) {
  const query = useQuery({
    queryKey: ['image-status', jobId],
    queryFn: () => api.get(`/api/image/status/${jobId}`) as Promise<ImageStatusResponse>,
    enabled: !!jobId && enabled,
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.status === 'done' || data?.status === 'failed') return false
      return 5000
    }
  })

  return query
}
