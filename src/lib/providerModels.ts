// src/lib/providerModels.ts
// Frontend model registry — mirrors worker/lib/providers.ts

export interface FrontendModel {
  id: string          // used as brain_model value
  label: string       // display name
  provider: string    // groq | openrouter | glm | gemini | aws | dashscope | cerebras | mistral | siliconflow
  providerLabel: string
  providerColor: string
  providerEmoji: string
  free: boolean
  speed: 'fast' | 'medium' | 'slow'
  speedLabel: string
  bestFor: string[]
  requiresKey: 'groq' | 'openrouter' | 'glm' | 'gemini' | 'aws' | 'dashscope' | 'cerebras' | 'mistral' | 'siliconflow'
}

export const ALL_BRAIN_MODELS: FrontendModel[] = [
  // ── AWS Bedrock ──────────────────────────────────────────
  {
    id: 'us.anthropic.claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    provider: 'aws', providerLabel: 'AWS Bedrock',
    providerColor: '#ff9900', providerEmoji: '☁️',
    free: false, speed: 'medium', speedLabel: '●●○',
    bestFor: ['brain', 'quality', 'json'],
    requiresKey: 'aws',
  },
  {
    id: 'us.anthropic.claude-haiku-4-5-20251001',
    label: 'Claude Haiku 4.5',
    provider: 'aws', providerLabel: 'AWS Bedrock',
    providerColor: '#ff9900', providerEmoji: '☁️',
    free: false, speed: 'fast', speedLabel: '●●●',
    bestFor: ['rewrite', 'vo', 'fast'],
    requiresKey: 'aws',
  },
  {
    id: 'us.meta.llama4-maverick-17b-instruct-v1:0',
    label: 'Llama 4 Maverick 17B',
    provider: 'aws', providerLabel: 'AWS Bedrock',
    providerColor: '#ff9900', providerEmoji: '☁️',
    free: false, speed: 'fast', speedLabel: '●●●',
    bestFor: ['brain', 'creative'],
    requiresKey: 'aws',
  },
  {
    id: 'us.meta.llama4-scout-17b-instruct-v1:0',
    label: 'Llama 4 Scout 17B',
    provider: 'aws', providerLabel: 'AWS Bedrock',
    providerColor: '#ff9900', providerEmoji: '☁️',
    free: false, speed: 'fast', speedLabel: '●●●',
    bestFor: ['brain', 'fast', 'json'],
    requiresKey: 'aws',
  },
  // ── Dashscope ─────────────────────────────────────────────
  {
    id: 'qwen3-max',
    label: 'Qwen3 Max',
    provider: 'dashscope', providerLabel: 'Dashscope',
    providerColor: '#ff8c00', providerEmoji: '🧠',
    free: false, speed: 'medium', speedLabel: '●●○',
    bestFor: ['brain', 'multilingual', 'json'],
    requiresKey: 'dashscope',
  },
  {
    id: 'qwen-plus',
    label: 'Qwen Plus',
    provider: 'dashscope', providerLabel: 'Dashscope',
    providerColor: '#ff8c00', providerEmoji: '🧠',
    free: false, speed: 'fast', speedLabel: '●●●',
    bestFor: ['brain', 'creative'],
    requiresKey: 'dashscope',
  },
  {
    id: 'qwen-flash',
    label: 'Qwen Flash ⚡',
    provider: 'dashscope', providerLabel: 'Dashscope',
    providerColor: '#ff8c00', providerEmoji: '🧠',
    free: false, speed: 'fast', speedLabel: '●●●',
    bestFor: ['rewrite', 'vo'],
    requiresKey: 'dashscope',
  },
  {
    id: 'qwq-plus',
    label: 'QwQ Plus 🧠',
    provider: 'dashscope', providerLabel: 'Dashscope',
    providerColor: '#ff8c00', providerEmoji: '🧠',
    free: false, speed: 'slow', speedLabel: '●○○',
    bestFor: ['reasoning', 'complex'],
    requiresKey: 'dashscope',
  },
  // ── Groq ──────────────────────────────────────────────────
  {
    id: 'llama-3.3-70b-versatile',
    label: 'Llama 3.3 70B',
    provider: 'groq', providerLabel: 'Groq',
    providerColor: '#f97316', providerEmoji: '⚡',
    free: true, speed: 'fast', speedLabel: '●●●',
    bestFor: ['brain', 'creative', 'json'],
    requiresKey: 'groq',
  },
  {
    id: 'llama-3.1-8b-instant',
    label: 'Llama 3.1 8B Instant',
    provider: 'groq', providerLabel: 'Groq',
    providerColor: '#f97316', providerEmoji: '⚡',
    free: true, speed: 'fast', speedLabel: '●●●',
    bestFor: ['rewrite', 'short_tasks'],
    requiresKey: 'groq',
  },
  {
    id: 'gemma2-9b-it',
    label: 'Gemma 2 9B',
    provider: 'groq', providerLabel: 'Groq',
    providerColor: '#f97316', providerEmoji: '⚡',
    free: true, speed: 'fast', speedLabel: '●●●',
    bestFor: ['rewrite', 'vo'],
    requiresKey: 'groq',
  },
  {
    id: 'qwen-qwq-32b',
    label: 'QwQ 32B 🧠',
    provider: 'groq', providerLabel: 'Groq',
    providerColor: '#f97316', providerEmoji: '⚡',
    free: true, speed: 'fast', speedLabel: '●●●',
    bestFor: ['reasoning', 'complex', 'brain'],
    requiresKey: 'groq',
  },
  {
    id: 'deepseek-r1-distill-llama-70b',
    label: 'DeepSeek R1 Distill 70B',
    provider: 'groq', providerLabel: 'Groq',
    providerColor: '#f97316', providerEmoji: '⚡',
    free: true, speed: 'medium', speedLabel: '●●○',
    bestFor: ['reasoning', 'brain', 'json'],
    requiresKey: 'groq',
  },
  // ── OpenRouter ────────────────────────────────────────────
  {
    id: 'google/gemma-3-27b-it:free',
    label: 'Gemma 3 27B',
    provider: 'openrouter', providerLabel: 'OpenRouter',
    providerColor: '#8b5cf6', providerEmoji: '🔀',
    free: true, speed: 'medium', speedLabel: '●●○',
    bestFor: ['brain', 'creative', 'json'],
    requiresKey: 'openrouter',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    label: 'Llama 3.3 70B',
    provider: 'openrouter', providerLabel: 'OpenRouter',
    providerColor: '#8b5cf6', providerEmoji: '🔀',
    free: true, speed: 'medium', speedLabel: '●●○',
    bestFor: ['brain', 'json'],
    requiresKey: 'openrouter',
  },
  {
    id: 'deepseek/deepseek-r1:free',
    label: 'DeepSeek R1 🧠',
    provider: 'openrouter', providerLabel: 'OpenRouter',
    providerColor: '#8b5cf6', providerEmoji: '🔀',
    free: true, speed: 'slow', speedLabel: '●○○',
    bestFor: ['complex_reasoning', 'long_form'],
    requiresKey: 'openrouter',
  },
  {
    id: 'deepseek/deepseek-v3-0324:free',
    label: 'DeepSeek V3',
    provider: 'openrouter', providerLabel: 'OpenRouter',
    providerColor: '#8b5cf6', providerEmoji: '🔀',
    free: true, speed: 'medium', speedLabel: '●●○',
    bestFor: ['brain', 'creative'],
    requiresKey: 'openrouter',
  },
  {
    id: 'mistralai/mistral-small-3.1-24b-instruct:free',
    label: 'Mistral Small 3.1 24B',
    provider: 'openrouter', providerLabel: 'OpenRouter',
    providerColor: '#8b5cf6', providerEmoji: '🔀',
    free: true, speed: 'fast', speedLabel: '●●●',
    bestFor: ['brain', 'multilingual'],
    requiresKey: 'openrouter',
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    label: 'Gemini 2.0 Flash Exp',
    provider: 'openrouter', providerLabel: 'OpenRouter',
    providerColor: '#8b5cf6', providerEmoji: '🔀',
    free: true, speed: 'fast', speedLabel: '●●●',
    bestFor: ['brain', 'multilingual'],
    requiresKey: 'openrouter',
  },
  {
    id: 'meta-llama/llama-4-scout:free',
    label: 'Llama 4 Scout 🆕',
    provider: 'openrouter', providerLabel: 'OpenRouter',
    providerColor: '#8b5cf6', providerEmoji: '🔀',
    free: true, speed: 'fast', speedLabel: '●●●',
    bestFor: ['brain', 'creative', 'json'],
    requiresKey: 'openrouter',
  },
  {
    id: 'meta-llama/llama-4-maverick:free',
    label: 'Llama 4 Maverick 🆕',
    provider: 'openrouter', providerLabel: 'OpenRouter',
    providerColor: '#8b5cf6', providerEmoji: '🔀',
    free: true, speed: 'medium', speedLabel: '●●○',
    bestFor: ['brain', 'complex', 'json'],
    requiresKey: 'openrouter',
  },
  // ── GLM ───────────────────────────────────────────────────
  {
    id: 'glm-4-flash',
    label: 'GLM-4-Flash',
    provider: 'glm', providerLabel: 'ZhipuAI',
    providerColor: '#06b6d4', providerEmoji: '🌐',
    free: true, speed: 'fast', speedLabel: '●●●',
    bestFor: ['brain', 'multilingual'],
    requiresKey: 'glm',
  },
  {
    id: 'glm-4-flash-250414',
    label: 'GLM-4-Flash 250414',
    provider: 'glm', providerLabel: 'ZhipuAI',
    providerColor: '#06b6d4', providerEmoji: '🌐',
    free: true, speed: 'fast', speedLabel: '●●●',
    bestFor: ['brain', 'json'],
    requiresKey: 'glm',
  },
  {
    id: 'glm-z1-flash',
    label: 'GLM-Z1-Flash 🧠',
    provider: 'glm', providerLabel: 'ZhipuAI',
    providerColor: '#06b6d4', providerEmoji: '🌐',
    free: true, speed: 'medium', speedLabel: '●●○',
    bestFor: ['reasoning', 'complex'],
    requiresKey: 'glm',
  },
  {
    id: 'glm-4.6v',
    label: 'GLM-4.6V',
    provider: 'glm', providerLabel: 'ZhipuAI',
    providerColor: '#06b6d4', providerEmoji: '🌐',
    free: true, speed: 'fast', speedLabel: '●●●',
    bestFor: ['brain', 'multilingual', 'json'],
    requiresKey: 'glm',
  },
  // ── Gemini ────────────────────────────────────────────────
  {
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    provider: 'gemini', providerLabel: 'Google Gemini',
    providerColor: '#4285f4', providerEmoji: '✨',
    free: true, speed: 'fast', speedLabel: '●●●',
    bestFor: ['brain', 'creative', 'json', 'multilingual'],
    requiresKey: 'gemini',
  },
  {
    id: 'gemini-2.0-flash-lite',
    label: 'Gemini 2.0 Flash Lite',
    provider: 'gemini', providerLabel: 'Google Gemini',
    providerColor: '#4285f4', providerEmoji: '✨',
    free: true, speed: 'fast', speedLabel: '●●●',
    bestFor: ['rewrite', 'vo'],
    requiresKey: 'gemini',
  },
  {
    id: 'gemini-1.5-flash',
    label: 'Gemini 1.5 Flash',
    provider: 'gemini', providerLabel: 'Google Gemini',
    providerColor: '#4285f4', providerEmoji: '✨',
    free: true, speed: 'fast', speedLabel: '●●●',
    bestFor: ['brain', 'json'],
    requiresKey: 'gemini',
  },
  {
    id: 'gemini-2.5-pro-exp-03-25',
    label: 'Gemini 2.5 Pro Exp 🧠',
    provider: 'gemini', providerLabel: 'Google Gemini',
    providerColor: '#4285f4', providerEmoji: '✨',
    free: true, speed: 'slow', speedLabel: '●○○',
    bestFor: ['complex_reasoning', 'long_form', 'brain'],
    requiresKey: 'gemini',
  },
  // ─── CEREBRAS ───────────────────────────────────────────────────────
  {
    id: 'llama-4-scout-17b-16e-instruct',
    label: 'Llama 4 Scout 17B',
    provider: 'cerebras', providerLabel: 'Cerebras',
    providerColor: '#ff9500', providerEmoji: '⚡',
    free: true, speed: 'fast', speedLabel: '2,600 tok/s (FASTEST)',
    bestFor: ['storyboard', 'creative', 'speed'],
    requiresKey: 'cerebras',
  },
  {
    id: 'llama-3.3-70b',
    label: 'Llama 3.3 70B',
    provider: 'cerebras', providerLabel: 'Cerebras',
    providerColor: '#ff9500', providerEmoji: '⚡',
    free: true, speed: 'fast', speedLabel: 'Ultra-fast 70B',
    bestFor: ['quality', 'reasoning', 'json'],
    requiresKey: 'cerebras',
  },
  {
    id: 'qwen-3-32b',
    label: 'Qwen3 32B',
    provider: 'cerebras', providerLabel: 'Cerebras',
    providerColor: '#ff9500', providerEmoji: '⚡',
    free: true, speed: 'fast', speedLabel: 'Fast multilingual',
    bestFor: ['multilingual', 'indonesian'],
    requiresKey: 'cerebras',
  },
  // ─── MISTRAL ────────────────────────────────────────────────────────
  {
    id: 'mistral-small-latest',
    label: 'Mistral Small 3.1',
    provider: 'mistral', providerLabel: 'Mistral AI',
    providerColor: '#5856d6', providerEmoji: '🌊',
    free: true, speed: 'fast', speedLabel: 'Fast + JSON reliable',
    bestFor: ['json', 'structured', 'efficient'],
    requiresKey: 'mistral',
  },
  {
    id: 'open-mistral-nemo',
    label: 'Mistral Nemo',
    provider: 'mistral', providerLabel: 'Mistral AI',
    providerColor: '#5856d6', providerEmoji: '🌊',
    free: true, speed: 'fast', speedLabel: 'Free multilingual',
    bestFor: ['multilingual', 'free', 'json'],
    requiresKey: 'mistral',
  },
  {
    id: 'mistral-large-latest',
    label: 'Mistral Large',
    provider: 'mistral', providerLabel: 'Mistral AI',
    providerColor: '#5856d6', providerEmoji: '🌊',
    free: false, speed: 'medium', speedLabel: 'High quality (paid)',
    bestFor: ['quality', 'reasoning', 'complex'],
    requiresKey: 'mistral',
  },
  // ─── SILICONFLOW ────────────────────────────────────────────────────
  {
    id: 'Qwen/Qwen2.5-7B-Instruct',
    label: 'Qwen2.5 7B',
    provider: 'siliconflow', providerLabel: 'SiliconFlow',
    providerColor: '#ff6b35', providerEmoji: '🔥',
    free: true, speed: 'fast', speedLabel: 'Free + fast',
    bestFor: ['free', 'indonesian', 'fast'],
    requiresKey: 'siliconflow',
  },
  {
    id: 'Qwen/Qwen2.5-72B-Instruct',
    label: 'Qwen2.5 72B',
    provider: 'siliconflow', providerLabel: 'SiliconFlow',
    providerColor: '#ff6b35', providerEmoji: '🔥',
    free: false, speed: 'medium', speedLabel: 'High quality Qwen',
    bestFor: ['quality', 'indonesian', 'multilingual'],
    requiresKey: 'siliconflow',
  },
  {
    id: 'deepseek-ai/DeepSeek-V3',
    label: 'DeepSeek V3',
    provider: 'siliconflow', providerLabel: 'SiliconFlow',
    providerColor: '#ff6b35', providerEmoji: '🔥',
    free: false, speed: 'medium', speedLabel: 'Creative reasoning',
    bestFor: ['quality', 'creative', 'reasoning'],
    requiresKey: 'siliconflow',
  },
  {
    id: 'deepseek-ai/DeepSeek-R1',
    label: 'DeepSeek R1',
    provider: 'siliconflow', providerLabel: 'SiliconFlow',
    providerColor: '#ff6b35', providerEmoji: '🔥',
    free: false, speed: 'slow', speedLabel: 'Deep reasoning (slow)',
    bestFor: ['reasoning', 'complex', 'analysis'],
    requiresKey: 'siliconflow',
  },
  {
    id: 'THUDM/glm-4-9b-chat',
    label: 'GLM-4 9B',
    provider: 'siliconflow', providerLabel: 'SiliconFlow',
    providerColor: '#ff6b35', providerEmoji: '🔥',
    free: true, speed: 'fast', speedLabel: 'Free Chinese/multilingual',
    bestFor: ['free', 'chinese', 'multilingual'],
    requiresKey: 'siliconflow',
  },
]

// Helper: get model by id
export function getModelById(id: string): FrontendModel | undefined {
  return ALL_BRAIN_MODELS.find(m => m.id === id)
}

// Helper: check if user has the required key
export function hasRequiredKey(model: FrontendModel, settings: Record<string, string>): boolean {
  switch (model.requiresKey) {
    case 'aws': return !!(settings.awsAccessKeyId && settings.awsSecretAccessKey)
    case 'dashscope': return !!settings.dashscopeApiKey
    case 'groq': return !!settings.groqApiKey
    case 'openrouter': return !!settings.openrouterApiKey
    case 'glm': return !!settings.glmApiKey
    case 'gemini': return !!settings.geminiApiKey
    case 'cerebras': return !!settings.cerebrasApiKey
    case 'mistral': return !!settings.mistralApiKey
    case 'siliconflow': return !!settings.siliconflowApiKey
    default: return false
  }
}

// Group models by provider for selector UI
export function getModelsByProvider() {
  const groups: Record<string, FrontendModel[]> = {}
  for (const model of ALL_BRAIN_MODELS) {
    if (!groups[model.provider]) groups[model.provider] = []
    groups[model.provider].push(model)
  }
  return groups
}
