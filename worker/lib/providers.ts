// worker/lib/providers.ts
// Universal OpenAI-compatible provider handler

import type { Env } from '../index'

export interface ProviderConfig {
  id: string
  name: string
  baseUrl: string
  models: ModelInfo[]
  authHeader: (apiKey: string) => Record<string, string>
  extraHeaders?: Record<string, string>
}

export interface ModelInfo {
  id: string
  label: string
  contextWindow: number
  free: boolean
  speed: 'fast' | 'medium' | 'slow'
  bestFor: string[]
}

// ─── PROVIDER REGISTRY ────────────────────────────────────────────

export const PROVIDERS: Record<string, ProviderConfig> = {

  groq: {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    authHeader: (key) => ({ 'Authorization': `Bearer ${key}` }),
    models: [
      {
        id: 'llama-3.3-70b-versatile',
        label: 'Llama 3.3 70B ⚡',
        contextWindow: 128000,
        free: true,
        speed: 'fast',
        bestFor: ['brain', 'creative', 'json'],
      },
      {
        id: 'llama-3.1-8b-instant',
        label: 'Llama 3.1 8B Instant ⚡⚡',
        contextWindow: 128000,
        free: true,
        speed: 'fast',
        bestFor: ['rewrite', 'short_tasks'],
      },
      {
        id: 'gemma2-9b-it',
        label: 'Gemma 2 9B ⚡',
        contextWindow: 8192,
        free: true,
        speed: 'fast',
        bestFor: ['rewrite', 'vo'],
      },
      {
        id: 'qwen-qwq-32b',
        label: 'QwQ 32B 🧠⚡',
        contextWindow: 131072,
        free: true,
        speed: 'fast',
        bestFor: ['reasoning', 'complex', 'brain'],
      },
      {
        id: 'deepseek-r1-distill-llama-70b',
        label: 'DeepSeek R1 Distill 70B 🧠',
        contextWindow: 131072,
        free: true,
        speed: 'medium',
        bestFor: ['reasoning', 'brain', 'json'],
      },
    ],
  },

  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    authHeader: (key) => ({
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': 'https://fuzzystuf.pages.dev',
      'X-Title': 'Fuzzy Short',
    }),
    models: [
      {
        id: 'google/gemma-3-27b-it:free',
        label: 'Gemma 3 27B 🆓',
        contextWindow: 96000,
        free: true,
        speed: 'medium',
        bestFor: ['brain', 'creative', 'json'],
      },
      {
        id: 'meta-llama/llama-3.3-70b-instruct:free',
        label: 'Llama 3.3 70B 🆓',
        contextWindow: 131072,
        free: true,
        speed: 'medium',
        bestFor: ['brain', 'json'],
      },
      {
        id: 'deepseek/deepseek-r1:free',
        label: 'DeepSeek R1 🆓🧠',
        contextWindow: 163840,
        free: true,
        speed: 'slow',
        bestFor: ['complex_reasoning', 'long_form'],
      },
      {
        id: 'deepseek/deepseek-v3-0324:free',
        label: 'DeepSeek V3 🆓',
        contextWindow: 131072,
        free: true,
        speed: 'medium',
        bestFor: ['brain', 'creative'],
      },
      {
        id: 'mistralai/mistral-small-3.1-24b-instruct:free',
        label: 'Mistral Small 3.1 24B 🆓',
        contextWindow: 96000,
        free: true,
        speed: 'fast',
        bestFor: ['brain', 'multilingual'],
      },
      {
        id: 'google/gemini-2.0-flash-exp:free',
        label: 'Gemini 2.0 Flash Exp 🆓',
        contextWindow: 1048576,
        free: true,
        speed: 'fast',
        bestFor: ['brain', 'multilingual', 'json'],
      },
      {
        id: 'meta-llama/llama-4-scout:free',
        label: 'Llama 4 Scout 🆕🆓',
        contextWindow: 131072,
        free: true,
        speed: 'fast',
        bestFor: ['brain', 'creative', 'json'],
      },
      {
        id: 'meta-llama/llama-4-maverick:free',
        label: 'Llama 4 Maverick 🆕🆓',
        contextWindow: 131072,
        free: true,
        speed: 'medium',
        bestFor: ['brain', 'complex', 'json'],
      },
    ],
  },

  glm: {
    id: 'glm',
    name: 'GLM (ZhipuAI)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    authHeader: (key) => ({ 'Authorization': `Bearer ${key}` }),
    models: [
      {
        id: 'glm-4-flash',
        label: 'GLM-4-Flash 🆓',
        contextWindow: 128000,
        free: true,
        speed: 'fast',
        bestFor: ['brain', 'multilingual', 'chinese'],
      },
      {
        id: 'glm-4-flash-250414',
        label: 'GLM-4-Flash 250414 🆓',
        contextWindow: 128000,
        free: true,
        speed: 'fast',
        bestFor: ['brain', 'json', 'multilingual'],
      },
      {
        id: 'glm-z1-flash',
        label: 'GLM-Z1-Flash 🆓🧠',
        contextWindow: 128000,
        free: true,
        speed: 'medium',
        bestFor: ['reasoning', 'complex'],
      },
      {
        id: 'glm-4.6v',
        label: 'GLM-4.6V 🆓',
        contextWindow: 128000,
        free: true,
        speed: 'fast',
        bestFor: ['brain', 'multilingual', 'json'],
      },
    ],
  },

  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    authHeader: (key) => ({ 'Authorization': `Bearer ${key}` }),
    models: [
      {
        id: 'gemini-2.0-flash',
        label: 'Gemini 2.0 Flash ⚡',
        contextWindow: 1048576,
        free: true,
        speed: 'fast',
        bestFor: ['brain', 'creative', 'json', 'multilingual'],
      },
      {
        id: 'gemini-2.0-flash-lite',
        label: 'Gemini 2.0 Flash Lite ⚡⚡',
        contextWindow: 1048576,
        free: true,
        speed: 'fast',
        bestFor: ['rewrite', 'short_tasks', 'vo'],
      },
      {
        id: 'gemini-1.5-flash',
        label: 'Gemini 1.5 Flash',
        contextWindow: 1048576,
        free: true,
        speed: 'fast',
        bestFor: ['brain', 'json'],
      },
      {
        id: 'gemini-1.5-flash-8b',
        label: 'Gemini 1.5 Flash 8B ⚡⚡',
        contextWindow: 1048576,
        free: true,
        speed: 'fast',
        bestFor: ['rewrite', 'short_tasks'],
      },
      {
        id: 'gemini-2.5-pro-exp-03-25',
        label: 'Gemini 2.5 Pro Exp 🧠',
        contextWindow: 1048576,
        free: true,
        speed: 'slow',
        bestFor: ['complex_reasoning', 'long_form', 'brain'],
      },
    ],
  },

  cerebras: {
    id: 'cerebras',
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1/chat/completions',
    authHeader: (key) => ({ 'Authorization': `Bearer ${key}` }),
    models: [
      {
        id: 'llama-4-scout-17b-16e-instruct',
        label: 'Llama 4 Scout 17B ⚡⚡',
        contextWindow: 131072,
        free: true,
        speed: 'fast',
        bestFor: ['storyboard', 'creative', 'fast']
      },
      {
        id: 'llama-3.3-70b',
        label: 'Llama 3.3 70B',
        contextWindow: 131072,
        free: true,
        speed: 'fast',
        bestFor: ['quality', 'reasoning', 'json']
      },
      {
        id: 'qwen-3-32b',
        label: 'Qwen3 32B',
        contextWindow: 131072,
        free: true,
        speed: 'fast',
        bestFor: ['multilingual', 'indonesian', 'reasoning']
      }
    ]
  },

  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1/chat/completions',
    authHeader: (key) => ({ 'Authorization': `Bearer ${key}` }),
    models: [
      {
        id: 'mistral-small-latest',
        label: 'Mistral Small 3.1',
        contextWindow: 32768,
        free: true,
        speed: 'fast',
        bestFor: ['json', 'structured', 'efficient']
      },
      {
        id: 'mistral-large-latest',
        label: 'Mistral Large',
        contextWindow: 131072,
        free: false,
        speed: 'medium',
        bestFor: ['quality', 'complex', 'reasoning']
      },
      {
        id: 'open-mistral-nemo',
        label: 'Mistral Nemo (Free)',
        contextWindow: 131072,
        free: true,
        speed: 'fast',
        bestFor: ['json', 'multilingual', 'efficient']
      }
    ]
  },

  siliconflow: {
    id: 'siliconflow',
    name: 'SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1/chat/completions',
    authHeader: (key) => ({ 'Authorization': `Bearer ${key}` }),
    models: [
      {
        id: 'Qwen/Qwen2.5-72B-Instruct',
        label: 'Qwen2.5 72B',
        contextWindow: 131072,
        free: false,
        speed: 'medium',
        bestFor: ['quality', 'indonesian', 'multilingual']
      },
      {
        id: 'Qwen/Qwen2.5-7B-Instruct',
        label: 'Qwen2.5 7B (Free)',
        contextWindow: 32768,
        free: true,
        speed: 'fast',
        bestFor: ['fast', 'indonesian', 'efficient']
      },
      {
        id: 'deepseek-ai/DeepSeek-V3',
        label: 'DeepSeek V3',
        contextWindow: 131072,
        free: false,
        speed: 'medium',
        bestFor: ['quality', 'reasoning', 'creative']
      },
      {
        id: 'deepseek-ai/DeepSeek-R1',
        label: 'DeepSeek R1 (Reasoning)',
        contextWindow: 65536,
        free: false,
        speed: 'slow',
        bestFor: ['reasoning', 'complex', 'analysis']
      },
      {
        id: 'THUDM/glm-4-9b-chat',
        label: 'GLM-4 9B (Free)',
        contextWindow: 131072,
        free: true,
        speed: 'fast',
        bestFor: ['chinese', 'multilingual', 'free']
      }
    ]
  },
}

// Get provider config by model ID prefix or explicit provider
export function getProviderForModel(modelId: string): ProviderConfig | null {
  // Check explicit provider prefix: "groq:llama-3.3-70b-versatile"
  if (modelId.includes(':') && !modelId.endsWith(':free')) {
    const [providerId] = modelId.split(':')
    return PROVIDERS[providerId] || null
  }

  // Auto-detect by model ID patterns
  if (modelId.startsWith('llama-4') || modelId.startsWith('llama-3.3') || modelId.startsWith('qwen-3')) {
    // Could be cerebras or groq — check by prefix
    if (['llama-4-scout-17b-16e-instruct', 'llama-3.3-70b', 'qwen-3-32b'].includes(modelId)) return PROVIDERS.cerebras
    return PROVIDERS.groq
  }
  if (modelId.startsWith('gemma2') || modelId.startsWith('qwen-qwq') || modelId.startsWith('deepseek-r1-distill')) {
    return PROVIDERS.groq
  }
  if (modelId.startsWith('mistral-') || modelId.startsWith('open-mistral-')) return PROVIDERS.mistral
  if (modelId.includes('/')) return PROVIDERS.siliconflow  // SiliconFlow uses org/model format
  if (modelId.includes('/') || modelId.endsWith(':free')) {
    return PROVIDERS.openrouter
  }
  if (modelId.startsWith('glm') || modelId.startsWith('chatglm')) {
    return PROVIDERS.glm
  }
  if (modelId.startsWith('gemini')) {
    return PROVIDERS.gemini
  }

  return null
}

// Get API key for provider from env
export function getProviderApiKey(provider: ProviderConfig, env: Env): string {
  switch (provider.id) {
    case 'groq': return env.GROQ_API_KEY || ''
    case 'openrouter': return env.OPENROUTER_API_KEY || ''
    case 'glm': return env.GLM_API_KEY || ''
    case 'gemini': return env.GEMINI_API_KEY || ''
    case 'cerebras': return env.CEREBRAS_API_KEY || ''
    case 'mistral': return env.MISTRAL_API_KEY || ''
    case 'siliconflow': return env.SILICONFLOW_API_KEY || ''
    default: return ''
  }
}

// Universal OpenAI-compat completion call
export async function callProvider(
  provider: ProviderConfig,
  apiKey: string,
  modelId: string,
  messages: { role: string; content: string }[],
  options?: {
    temperature?: number
    max_tokens?: number
    response_format?: { type: 'json_object' }
  }
): Promise<string> {
  if (!apiKey) {
    throw new Error(`API key required for ${provider.name}. Add it in Settings.`)
  }

  // Strip provider prefix if present (but not :free suffixes)
  const cleanModelId = modelId.includes(':') && !modelId.endsWith(':free')
    ? modelId.split(':').slice(1).join(':')
    : modelId

  // Native Gemini API integration
  if (provider.id === 'gemini') {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelId}:generateContent?key=${apiKey}`
    const systemMessage = messages.find(m => m.role === 'system')?.content || ''
    const userMessages = messages.filter(m => m.role !== 'system')

    const body: Record<string, unknown> = {
      contents: userMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      })),
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.max_tokens ?? 4096,
        responseMimeType: options?.response_format?.type === 'json_object' ? 'application/json' : 'text/plain',
      }
    }
    
    if (systemMessage) {
      body.systemInstruction = {
        parts: [{ text: systemMessage }]
      }
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 200)}`)
    }

    const data = await res.json() as {
      candidates?: { content: { parts: { text: string }[] } }[]
      error?: { message: string }
    }

    if (data.error) throw new Error(`Gemini: ${data.error.message}`)
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }

  const body: Record<string, unknown> = {
    model: cleanModelId,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.max_tokens ?? 4096,
  }

  // response_format not supported by all providers
  if (options?.response_format && provider.id !== 'glm') {
    body.response_format = options.response_format
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...provider.authHeader(apiKey),
    ...(provider.extraHeaders || {}),
  }

  const res = await fetch(provider.baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`${provider.name} API error ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json() as {
    choices: { message: { content: string } }[]
    error?: { message: string }
  }

  if (data.error) throw new Error(`${provider.name}: ${data.error.message}`)

  return data.choices?.[0]?.message?.content || ''
}

// Export model list for frontend
export function getAllModelsForFrontend() {
  return Object.values(PROVIDERS).map(p => ({
    provider: p.id,
    providerName: p.name,
    models: p.models,
  }))
}
