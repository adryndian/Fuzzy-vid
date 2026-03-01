type BrainModel = 'gemini' | 'llama4_maverick' | 'claude_sonnet'
type ImageModel = 'nova_canvas' | 'gemini' | 'titan_v2'
type AudioModel = 'polly' | 'elevenlabs' | 'gemini_tts'

export function estimateBrainCost(model: BrainModel, scenesCount: number): number {
  // Rough estimate based on typical prompt/response sizes per scene
  const inputTokensPerScene = 200
  const outputTokensPerScene = 300
  const totalInput = inputTokensPerScene * scenesCount + 500 // system prompt overhead
  const totalOutput = outputTokensPerScene * scenesCount

  switch (model) {
    case 'claude_sonnet':
      // $0.003/1K input + $0.015/1K output
      return (totalInput / 1000) * 0.003 + (totalOutput / 1000) * 0.015
    case 'llama4_maverick':
      // ~$0.0002/1K tokens
      return ((totalInput + totalOutput) / 1000) * 0.0002
    case 'gemini':
      return 0 // free tier
    default:
      return 0
  }
}

export function estimateImageCost(_model?: ImageModel): number {
  // Nova Canvas: ~$0.04 per image
  return 0.04
}

export function estimateVideoCost(_model?: string, durationSec = 6): number {
  // Nova Reel: ~$0.80 per 6sec
  return (durationSec / 6) * 0.80
}

export function estimateAudioCost(model: AudioModel, charCount: number): number {
  switch (model) {
    case 'polly':
      return (charCount / 1000) * 0.004
    case 'elevenlabs':
      return (charCount / 1000) * 0.18
    case 'gemini_tts':
      return 0
    default:
      return 0
  }
}

export function formatCost(cost: number): string {
  if (cost === 0) return 'Free'
  if (cost < 0.01) return '<$0.01'
  return `~$${cost.toFixed(2)}`
}

export function timeAgo(isoDate: string): string {
  const now = Date.now()
  const then = new Date(isoDate).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 30) return `${diffDay}d ago`
  return new Date(isoDate).toLocaleDateString()
}
