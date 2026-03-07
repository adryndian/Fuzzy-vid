# Phase A: Multi-Provider Foundation

# Patch: v3.4

# Read CLAUDE.md first. YOLO mode.

# After ALL tasks: npm run build && wrangler deploy && git push

-----

## OVERVIEW

Add 4 new brain providers (all OpenAI-compatible):

- Groq (llama-3.3-70b, llama-3.1-8b, gemma2-9b, mixtral-8x7b)
- OpenRouter (gemma-3-27b, llama-3.3-70b, deepseek-r1, deepseek-v3, mistral-7b)
- GLM-4-Flash / ZhipuAI (glm-4-flash, glm-4-flash-250414)
- Gemini (gemini-2.0-flash, gemini-2.0-flash-lite, gemini-1.5-flash, gemini-1.5-flash-8b)

All use OpenAI-compatible format → 1 universal handler.
New Worker secrets: GROQ_API_KEY, OPENROUTER_API_KEY, GLM_API_KEY, GEMINI_API_KEY

-----

## TASK 1 — Add Worker Secrets

Run these commands one by one in terminal:

```bash
cd ~/Fuzzy-vid

wrangler secret put GROQ_API_KEY
# paste your Groq API key from console.groq.com

wrangler secret put OPENROUTER_API_KEY
# paste your OpenRouter API key from openrouter.ai/keys

wrangler secret put GLM_API_KEY
# paste your ZhipuAI API key from open.bigmodel.cn

wrangler secret put GEMINI_API_KEY
# paste your Google AI Studio API key from aistudio.google.com/apikey

# Verify all secrets
wrangler secret list
```

-----

## TASK 2 — Update Env Interface in worker/index.ts

Read worker/index.ts. Find the Env interface. Add:

```typescript
interface Env {
  // ... existing fields ...
  GROQ_API_KEY: string
  OPENROUTER_API_KEY: string
  GLM_API_KEY: string
  GEMINI_API_KEY: string
}
```

-----

## TASK 3 — Create worker/lib/providers.ts

Create new file worker/lib/providers.ts:

```typescript
// worker/lib/providers.ts
// Universal OpenAI-compatible provider handler

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
        id: 'mixtral-8x7b-32768',
        label: 'Mixtral 8x7B',
        contextWindow: 32768,
        free: true,
        speed: 'medium',
        bestFor: ['brain', 'multilingual'],
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
        id: 'mistralai/mistral-7b-instruct:free',
        label: 'Mistral 7B 🆓',
        contextWindow: 32768,
        free: true,
        speed: 'fast',
        bestFor: ['rewrite', 'short_tasks'],
      },
      {
        id: 'google/gemini-2.0-flash-exp:free',
        label: 'Gemini 2.0 Flash Exp 🆓',
        contextWindow: 1048576,
        free: true,
        speed: 'fast',
        bestFor: ['brain', 'multilingual', 'json'],
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
}

// Get provider config by model ID prefix or explicit provider
export function getProviderForModel(modelId: string): ProviderConfig | null {
  // Check explicit provider prefix: "groq:llama-3.3-70b-versatile"
  if (modelId.includes(':')) {
    const [providerId] = modelId.split(':')
    return PROVIDERS[providerId] || null
  }

  // Auto-detect by model ID patterns
  if (modelId.startsWith('llama') || modelId.startsWith('gemma2') || modelId.startsWith('mixtral')) {
    return PROVIDERS.groq
  }
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

  // Strip provider prefix if present
  const cleanModelId = modelId.includes(':') && !modelId.endsWith(':free')
    ? modelId.split(':').slice(1).join(':')
    : modelId

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
```

-----

## TASK 4 — Create worker/handlers/brain-provider.ts

Create new file worker/handlers/brain-provider.ts:

```typescript
// worker/handlers/brain-provider.ts
// Generic brain handler for all OpenAI-compat providers

import {
  PROVIDERS,
  getProviderForModel,
  getProviderApiKey,
  callProvider,
} from '../lib/providers'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Brain-Provider, X-Brain-Model',
}

export async function handleProviderBrain(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.json() as {
    brain_model: string          // e.g. "llama-3.3-70b-versatile" or "groq:llama-3.3-70b"
    system_prompt: string
    user_prompt: string
    temperature?: number
    max_tokens?: number
    response_format?: { type: 'json_object' }
  }

  const { brain_model, system_prompt, user_prompt } = body

  // Find provider
  const provider = getProviderForModel(brain_model)
  if (!provider) {
    return Response.json(
      { error: `Unknown model: ${brain_model}. Supported: groq, openrouter, glm, gemini` },
      { status: 400, headers: corsHeaders }
    )
  }

  // Get API key
  const apiKey = getProviderApiKey(provider, env)
  if (!apiKey) {
    return Response.json(
      { error: `${provider.name} API key not configured. Add GROQ/OPENROUTER/GLM/GEMINI key in Settings.` },
      { status: 401, headers: corsHeaders }
    )
  }

  try {
    const content = await callProvider(
      provider,
      apiKey,
      brain_model,
      [
        { role: 'system', content: system_prompt },
        { role: 'user', content: user_prompt },
      ],
      {
        temperature: body.temperature,
        max_tokens: body.max_tokens || 4096,
        response_format: body.response_format,
      }
    )

    return Response.json({ content, provider: provider.id, model: brain_model }, {
      headers: corsHeaders,
    })
  } catch (e: any) {
    return Response.json(
      { error: e.message || 'Provider call failed' },
      { status: 500, headers: corsHeaders }
    )
  }
}
```

-----

## TASK 5 — Add Provider Routes to worker/index.ts

Read worker/index.ts. Add import and routes:

```typescript
import { handleProviderBrain } from './handlers/brain-provider'
import { getAllModelsForFrontend } from './lib/providers'

// Add these routes in the fetch handler:

// GET /api/providers/models — return all available models for frontend
if (path === '/api/providers/models' && method === 'GET') {
  return Response.json(
    { providers: getAllModelsForFrontend() },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  )
}

// POST /api/brain/provider — universal provider brain endpoint
if (path === '/api/brain/provider' && method === 'POST') {
  return handleProviderBrain(request, env)
}
```

-----

## TASK 6 — Update Settings.tsx — Add 4 New API Key Fields

Read src/pages/Settings.tsx completely.

Add 4 new fields to the settings state:

```typescript
// In settings state interface/initial value, add:
groqApiKey: '',
openrouterApiKey: '',
glmApiKey: '',
geminiApiKey: '',
```

Add to handleSave → saveApiKeys call:

```typescript
await saveApiKeys({
  // ... existing keys ...
  groq_api_key: settings.groqApiKey || '',
  openrouter_api_key: settings.openrouterApiKey || '',
  glm_api_key: settings.glmApiKey || '',
  gemini_api_key: settings.geminiApiKey || '',
})
```

Add 4 new input sections in the UI.
Place them AFTER the existing Dashscope section, BEFORE ElevenLabs.
Use this pattern for each (adjust color per provider):

```typescript
{/* ─── GROQ ─────────────────────────────────────────────── */}
<div style={{ ...sectionCard }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
    <div style={{
      width: '32px', height: '32px', borderRadius: '8px',
      background: 'rgba(249,115,22,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '16px',
    }}>⚡</div>
    <div>
      <div style={{ fontWeight: 700, fontSize: '14px', color: '#1d1d1f' }}>Groq</div>
      <div style={{ fontSize: '10px', color: 'rgba(60,60,67,0.5)' }}>
        Free • Fastest inference • console.groq.com
      </div>
    </div>
    <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer"
      style={{ marginLeft: 'auto', fontSize: '11px', color: '#007aff', textDecoration: 'none' }}>
      Get Key →
    </a>
  </div>
  <input
    type="password"
    value={settings.groqApiKey || ''}
    onChange={e => setSettings(prev => ({ ...prev, groqApiKey: e.target.value }))}
    placeholder="gsk_xxxxxxxxxxxxxxxxxxxx"
    style={{ ...inputStyle }}
  />
</div>

{/* ─── OPENROUTER ─────────────────────────────────────────── */}
<div style={{ ...sectionCard }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
    <div style={{
      width: '32px', height: '32px', borderRadius: '8px',
      background: 'rgba(139,92,246,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '16px',
    }}>🔀</div>
    <div>
      <div style={{ fontWeight: 700, fontSize: '14px', color: '#1d1d1f' }}>OpenRouter</div>
      <div style={{ fontSize: '10px', color: 'rgba(60,60,67,0.5)' }}>
        Free models • DeepSeek, Gemma, Llama • openrouter.ai
      </div>
    </div>
    <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer"
      style={{ marginLeft: 'auto', fontSize: '11px', color: '#007aff', textDecoration: 'none' }}>
      Get Key →
    </a>
  </div>
  <input
    type="password"
    value={settings.openrouterApiKey || ''}
    onChange={e => setSettings(prev => ({ ...prev, openrouterApiKey: e.target.value }))}
    placeholder="sk-or-xxxxxxxxxxxxxxxxxxxx"
    style={{ ...inputStyle }}
  />
</div>

{/* ─── GLM / ZHIPUAI ──────────────────────────────────────── */}
<div style={{ ...sectionCard }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
    <div style={{
      width: '32px', height: '32px', borderRadius: '8px',
      background: 'rgba(6,182,212,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '16px',
    }}>🌐</div>
    <div>
      <div style={{ fontWeight: 700, fontSize: '14px', color: '#1d1d1f' }}>GLM-4-Flash</div>
      <div style={{ fontSize: '10px', color: 'rgba(60,60,67,0.5)' }}>
        Free unlimited • ZhipuAI • open.bigmodel.cn
      </div>
    </div>
    <a href="https://open.bigmodel.cn/usercenter/apikeys" target="_blank" rel="noreferrer"
      style={{ marginLeft: 'auto', fontSize: '11px', color: '#007aff', textDecoration: 'none' }}>
      Get Key →
    </a>
  </div>
  <input
    type="password"
    value={settings.glmApiKey || ''}
    onChange={e => setSettings(prev => ({ ...prev, glmApiKey: e.target.value }))}
    placeholder="xxxxxxxxxxxxxxxxxxxx.xxxxxxxxxxxx"
    style={{ ...inputStyle }}
  />
</div>

{/* ─── GEMINI ─────────────────────────────────────────────── */}
<div style={{ ...sectionCard }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
    <div style={{
      width: '32px', height: '32px', borderRadius: '8px',
      background: 'rgba(66,133,244,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '16px',
    }}>✨</div>
    <div>
      <div style={{ fontWeight: 700, fontSize: '14px', color: '#1d1d1f' }}>Google Gemini</div>
      <div style={{ fontSize: '10px', color: 'rgba(60,60,67,0.5)' }}>
        Free tier • Gemini 2.0 Flash • aistudio.google.com
      </div>
    </div>
    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer"
      style={{ marginLeft: 'auto', fontSize: '11px', color: '#007aff', textDecoration: 'none' }}>
      Get Key →
    </a>
  </div>
  <input
    type="password"
    value={settings.geminiApiKey || ''}
    onChange={e => setSettings(prev => ({ ...prev, geminiApiKey: e.target.value }))}
    placeholder="AIzaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    style={{ ...inputStyle }}
  />
</div>
```

Also update getApiKeys() load handler to map new keys:

```typescript
getApiKeys().then(keys => {
  setSettings(prev => ({
    ...prev,
    // ... existing mappings ...
    groqApiKey: keys.groq_api_key || '',
    openrouterApiKey: keys.openrouter_api_key || '',
    glmApiKey: keys.glm_api_key || '',
    geminiApiKey: keys.gemini_api_key || '',
  }))
})
```

-----

## TASK 7 — Update src/lib/api.ts — Add Provider Brain Call

Read src/lib/api.ts.

Add new function:

```typescript
export async function callProviderBrain(
  systemPrompt: string,
  userPrompt: string,
  brainModel: string,
  userId?: string
): Promise<string> {
  const storageKey = userId ? `fuzzy_settings_${userId}` : 'fuzzy_short_settings'
  const settings = JSON.parse(localStorage.getItem(storageKey) || '{}')

  const WORKER_URL = import.meta.env.VITE_WORKER_URL

  const res = await fetch(`${WORKER_URL}/api/brain/provider`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      brain_model: brainModel,
      system_prompt: systemPrompt,
      user_prompt: userPrompt,
      max_tokens: 4096,
    }),
  })

  if (!res.ok) {
    const err = await res.json() as { error: string }
    throw new Error(err.error || `Provider brain failed: ${res.status}`)
  }

  const data = await res.json() as { content: string }
  return data.content
}
```

-----

## TASK 8 — Add Provider Keys to getApiHeaders

Read src/lib/api.ts. Update getApiHeaders to include new keys:

```typescript
export function getApiHeaders(userId?: string): Record<string, string> {
  const storageKey = userId ? `fuzzy_settings_${userId}` : 'fuzzy_short_settings'
  const settings = JSON.parse(localStorage.getItem(storageKey) || '{}')
  return {
    'X-AWS-Access-Key-Id': settings.awsAccessKeyId || '',
    'X-AWS-Secret-Access-Key': settings.awsSecretAccessKey || '',
    'X-Brain-Region': settings.brainRegion || 'us-east-1',
    'X-Image-Region': settings.imageRegion || 'us-east-1',
    'X-Dashscope-Api-Key': settings.dashscopeApiKey || '',
    // New provider keys — sent as headers for Worker to validate
    'X-Groq-Api-Key': settings.groqApiKey || '',
    'X-Openrouter-Api-Key': settings.openrouterApiKey || '',
    'X-Glm-Api-Key': settings.glmApiKey || '',
    'X-Gemini-Api-Key': settings.geminiApiKey || '',
  }
}
```

Also update worker/index.ts credentials extraction to read new headers:

```typescript
// In credentials extraction section:
const groqApiKey = request.headers.get('X-Groq-Api-Key') || env.GROQ_API_KEY || ''
const openrouterApiKey = request.headers.get('X-Openrouter-Api-Key') || env.OPENROUTER_API_KEY || ''
const glmApiKey = request.headers.get('X-Glm-Api-Key') || env.GLM_API_KEY || ''
const geminiApiKey = request.headers.get('X-Gemini-Api-Key') || env.GEMINI_API_KEY || ''
```

NOTE: For provider keys, user’s header key takes priority, but
env fallback is OK (these are not the same as AWS keys — they cost
per token on paid tiers but free tier is shared across all users).
Add comment explaining this distinction.

-----

## TASK 9 — Create src/lib/providerModels.ts (Frontend Model Registry)

```typescript
// src/lib/providerModels.ts
// Frontend model registry — mirrors worker/lib/providers.ts

export interface FrontendModel {
  id: string          // used as brain_model value
  label: string       // display name
  provider: string    // groq | openrouter | glm | gemini | aws | dashscope
  providerLabel: string
  providerColor: string
  providerEmoji: string
  free: boolean
  speed: 'fast' | 'medium' | 'slow'
  speedLabel: string
  bestFor: string[]
  requiresKey: 'groq' | 'openrouter' | 'glm' | 'gemini' | 'aws' | 'dashscope'
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
    id: 'mixtral-8x7b-32768',
    label: 'Mixtral 8x7B',
    provider: 'groq', providerLabel: 'Groq',
    providerColor: '#f97316', providerEmoji: '⚡',
    free: true, speed: 'medium', speedLabel: '●●○',
    bestFor: ['brain', 'multilingual'],
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
    id: 'google/gemini-2.0-flash-exp:free',
    label: 'Gemini 2.0 Flash Exp',
    provider: 'openrouter', providerLabel: 'OpenRouter',
    providerColor: '#8b5cf6', providerEmoji: '🔀',
    free: true, speed: 'fast', speedLabel: '●●●',
    bestFor: ['brain', 'multilingual'],
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
```

-----

## TASK 10 — Build, Deploy, Test

```bash
npx tsc --noEmit 2>&1 | head -20
npm run build 2>&1 | tail -20

wrangler deploy

# Test provider models endpoint
curl https://fuzzy-vid-worker.officialdian21.workers.dev/api/providers/models
# Expected: {"providers":[{"provider":"groq","models":[...]},...]

# Test Groq (replace with real key)
curl -X POST https://fuzzy-vid-worker.officialdian21.workers.dev/api/brain/provider \
  -H "Content-Type: application/json" \
  -d '{
    "brain_model": "llama-3.3-70b-versatile",
    "system_prompt": "You are a helpful assistant.",
    "user_prompt": "Say hello in JSON: {\"message\": \"...\"}"
  }'
# If GROQ_API_KEY set in wrangler secrets: Expected: {"content":"{\"message\":\"Hello!\"}"}

git add .
git commit -m "feat(v3.4): multi-provider foundation — Groq, OpenRouter, GLM, Gemini"
git push origin main
```