# Fuzzy-vid — Complete Architecture Reference

# Version 4.0 — Updated 2026-03-08

---

## 1. Project Overview

AI-powered short video production app. Users describe a story; the app generates a full storyboard with AI-written scenes, then generates images, videos, and narration per scene.

| Layer | Technology | URL |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | https://fuzzystuf.pages.dev |
| Backend | Cloudflare Worker (TypeScript) | https://fuzzy-vid-worker.officialdian21.workers.dev |
| Storage | Cloudflare R2 (`igome-story-storage`) | via Worker proxy |
| DB | Cloudflare D1 (`fuzzy-short-db`) | 5 tables (auth required routes) |
| Auth | Clerk (Email OTP + Google OAuth) | pk_test_ for .pages.dev |
| Brain AI | AWS Bedrock + Dashscope SG + Gemini + Groq + OpenRouter + ZhipuAI GLM | 6 providers, 29+ models |
| Image AI | AWS Bedrock (Nova Canvas, SD 3.5) + Dashscope (Qwen-Image, Wanx) + ZhipuAI GLM (CogView) | |
| Video AI | AWS Bedrock Nova Reel (async) + Dashscope Wan2.1/2.6 (async) + ZhipuAI GLM CogVideoX-2 (async) | |
| Audio | AWS Polly + ElevenLabs | |

---

## 2. Directory Structure

```
/
├── src/                              # React frontend
│   ├── main.tsx                      # Entry point — ClerkProvider + ThemeProvider + Router
│   ├── App.tsx                       # Routes: / /storyboard /settings /dashboard /auth
│   ├── index.css                     # Global reset
│   ├── pages/
│   │   ├── Home.tsx                  # Story input form, 6-provider brain selector, generate
│   │   ├── Storyboard.tsx            # Per-scene workspace: image/video/audio/Veo prompts
│   │   ├── Settings.tsx              # API keys (6 providers), dark mode, test buttons
│   │   ├── Dashboard.tsx             # Cloud storyboard list, local history, credits badge
│   │   └── Auth.tsx                  # Clerk SignIn/SignUp (routing="hash")
│   ├── components/
│   │   ├── BottomNav.tsx             # 5-button nav (Create/Projects/Settings/Queue/Dark) + Queue popup
│   │   ├── GenTaskBar.tsx            # UNUSED — file exists but NOT rendered (removed in v4.0)
│   │   ├── VeoPromptSection.tsx      # Per-scene Veo 3.1 prompt UI, sub-tone, copy/regen
│   │   └── ErrorBoundary.tsx
│   ├── lib/
│   │   ├── api.ts                    # Worker fetch calls; exports WORKER_URL, getApiHeaders(userId?)
│   │   ├── theme.tsx                 # ThemeProvider, useTheme(), tk(isDark) token function
│   │   ├── providerModels.ts         # 29 brain models x 6 providers, getModelsByProvider/getModelById/hasRequiredKey
│   │   ├── userApi.ts                # useUserApi() hook — Clerk JWT calls for D1 routes
│   │   ├── costEstimate.ts           # Per-model cost estimation, timeAgo()
│   │   └── veoSubtones.ts            # Frontend mirror of veo-subtones.ts (8 sub-tones)
│   ├── store/
│   │   ├── storyboardSessionStore.ts # persisted — multi-session with assets (max 5)
│   │   ├── genTaskStore.ts           # in-memory — brain task tracking
│   │   ├── costStore.ts              # in-memory — session cost tracking
│   │   └── historyStore.ts           # persisted — local storyboard history
│   └── types/
│       └── schema.ts                 # AppSettings, SceneAssets, VideoJob, buildApiHeaders()
│
├── worker/                           # Cloudflare Worker backend
│   ├── index.ts                      # Router, extractCredentials(), CORS, requireAwsKeys/requireDashscopeKey
│   ├── brain.ts                      # Bedrock storyboard gen, buildBrainPrompts()
│   ├── image.ts                      # Nova Canvas + SD 3.5 + enhance-prompt (Bedrock)
│   ├── video.ts                      # Nova Reel async-invoke + ARN polling (Bedrock)
│   ├── audio.ts                      # AWS Polly + ElevenLabs TTS
│   ├── dashscope.ts                  # ALL Qwen/Wanx/Wan2.1/2.6 (Dashscope Singapore)
│   ├── glm.ts                        # ZhipuAI GLM image (CogView-3-Flash sync) + video (CogVideoX-2 async)
│   ├── handlers/
│   │   ├── brain-provider.ts         # /api/brain/provider — Gemini/Groq/OpenRouter/GLM
│   │   └── regenerate-veo-prompt.ts  # /api/brain/regenerate-veo-prompt
│   ├── lib/
│   │   ├── aws-signature.ts          # signRequest() + buildCanonicalUri() — CRITICAL
│   │   ├── providers.ts              # PROVIDERS registry, callProvider(), getProviderForModel()
│   │   ├── brain-system-prompt.ts    # buildBrainSystemPrompt() + buildBrainUserPrompt() (8 tones)
│   │   ├── veo-subtones.ts           # VEO_SUBTONES (8), TONE_TO_SUBTONES, isVeoTone()
│   │   └── auth.ts                   # verifyClerkJWT (JWKS cached 1hr), ensureUser (D1 upsert)
│   └── db.ts                         # D1 operations, AES-GCM key encryption, CREDIT_COSTS
│
├── wrangler.toml                     # Worker config: R2, KV, D1, ASSETS bindings
├── vite.config.ts
├── tsconfig.app.json
└── worker/tsconfig.json
```

---

## 3. Frontend Architecture

### Pages

| Page | Route | Responsibility |
|---|---|---|
| `Home` | `/` | Story input form, 6-provider brain selector, tone/style/model pickers, generate |
| `Storyboard` | `/storyboard?id=SESSION_ID` | Per-scene generation workspace: image/video/audio/Veo prompt per scene |
| `Settings` | `/settings` | API keys for all 6 providers, dark mode toggle, test buttons |
| `Dashboard` | `/dashboard` | Cloud storyboard list (D1) + local history (historyStore), credits badge |
| `Auth` | `/auth` | Clerk SignIn/SignUp with hash routing |

### Component Hierarchy

```
App.tsx
├── ClerkProvider
└── ThemeProvider
    ├── Auth (public route)
    └── (protected routes — auth guard in App.tsx)
        ├── Home
        ├── Storyboard
        │   ├── [SceneCard × N]
        │   │   ├── Image section (generate, preview, download)
        │   │   ├── Video section (generate async, poll, download)
        │   │   ├── Audio section (Polly/ElevenLabs, history)
        │   │   └── VeoPromptSection (Veo 3.1 prompt, sub-tone, copy/regen)
        │   └── Scene Navigation Bar (mobile, above BottomNav)
        ├── Settings
        └── Dashboard
        └── BottomNav (fixed, all protected pages)
```

### Theme System (src/lib/theme.tsx)

`ThemeProvider` wraps app in `main.tsx`. Provides `isDark` + `toggleTheme` via context.
`useTheme()` — hook to read theme in any component.
`tk(isDark)` — returns token object (15 tokens) for current mode.

Tokens: `pageBg, cardBg, cardBorder, cardShadow, headerBg, navBg, navBorder,
         textPrimary, textSecondary, textTertiary, inputBg, inputBorder,
         pillInactive, sectionBg, labelColor`

Persisted to `localStorage('fuzzy_theme')`.

Rules:
- ALL page components use `const { isDark } = useTheme()` + `const t = tk(isDark)`
- `dropdownStyle` must be defined INSIDE the component (after `tk()`) — never at module level
- `.map(t => ...)` / `.filter(t => ...)` iterators must NOT shadow outer `t = tk(isDark)` — rename to `tn`, `task`, `tone`, etc.
- `select option` bg: use `<style>` JSX tag (inline styles can't target option elements)
- Interactive buttons in scene cards: `background: 'var(--input-bg)'`, `color: 'var(--text-primary)'` — never hardcode `rgba(255,255,255,...)`

### Brain Model Selector (Home.tsx)

1. Provider pill row: `aws / dashscope / gemini / groq / openrouter / glm`
2. `<select>` dropdown showing models for the active provider
3. Info bar: providerEmoji, providerLabel, speedLabel, bestFor

Constants (module-level, outside component):
- `PROVIDER_ORDER`, `PROVIDER_META`, `MODEL_GROUPS = getModelsByProvider()`
- `brainModel: string` (default `'gemini-2.0-flash'`) — NOT a union type

Submit routing:
- `aws` → `/api/brain/generate`
- `dashscope` → `/api/dashscope/brain`
- all others → `/api/brain/provider`

### API Layer (src/lib/api.ts)

`WORKER_URL` exported constant — imported by all pages and VeoPromptSection.

`getApiHeaders(userId?)` — reads `localStorage('fuzzy_settings_{userId}')`, returns:
```typescript
{
  'X-AWS-Access-Key-Id': settings.awsAccessKeyId,
  'X-AWS-Secret-Access-Key': settings.awsSecretAccessKey,
  'X-Brain-Region': settings.brainRegion,
  'X-Image-Region': settings.imageRegion,
  'X-Dashscope-Api-Key': settings.dashscopeApiKey,
  'X-Gemini-Api-Key': settings.geminiApiKey,
  'X-Groq-Api-Key': settings.groqApiKey,
  'X-Openrouter-Api-Key': settings.openrouterApiKey,
  'X-Glm-Api-Key': settings.glmApiKey,
}
```

IMPORTANT: localStorage key is `fuzzy_settings_{userId}` — NOT `fuzzy_short_settings`.
Always pass `userId` from `useUser()` hook when calling `getApiHeaders()`.

---

## 4. State Management (Zustand)

### `storyboardSessionStore` — persisted (`fuzzy_storyboard_sessions`)

```typescript
interface StoryboardSession {
  id: string           // nanoid(8)
  rawJson: string      // raw storyboard JSON from brain
  title: string
  imageModel: string   // any valid image model ID (widened from union)
  audioEngine: 'polly' | 'elevenlabs'
  audioVoice: string
  language: string
  assets: SceneAssetsMap   // Record<sceneNumber, SceneAssets>
  isMinimized: boolean
  createdAt: string
}
```

- Max 5 sessions — oldest pruned on create
- URL uses `?id=SESSION_ID`
- `updateAssetInStore(id, sceneNum, partial)` — merges per-scene asset state
- `updateSession(id, partial)` — updates session fields

### `genTaskStore` — in-memory

```typescript
interface GenTask {
  id: string
  title: string
  status: 'running' | 'done' | 'error'
  currentStep: number
  resultJson?: string
  sessionId?: string   // links to storyboardSessionStore
  error?: string
  startedAt: string
}
```

Used by BottomNav Queue popup to show minimized brain generation sessions.

### `costStore` — in-memory

Per-session cost tracking. Cleared on reload.

### `historyStore` — persisted (`fuzzy-short-history`)

```typescript
interface HistoryItem {
  id: string; title: string; platform: string
  art_style: string; language: string; brain_model: string
  scenes_count: number; created_at: string
  storyboard_data: string  // raw JSON of full storyboard
}
```

---

## 5. Type System (src/types/schema.ts)

### AppSettings

```typescript
interface AppSettings {
  awsAccessKeyId: string; awsSecretAccessKey: string
  brainRegion: string; imageRegion: string
  dashscopeApiKey: string
  geminiApiKey: string
  groqApiKey: string
  openrouterApiKey: string
  glmApiKey: string
  elevenLabsApiKey: string
}

buildApiHeaders(settings, userId?): Record<string, string>
// localStorage key: fuzzy_settings_{userId}
```

### SceneAssets

```typescript
interface SceneAssets {
  imageUrl?: string; imageStatus: GenerationStatus; imageError?: string
  enhancedPrompt?: string
  videoUrl?: string; videoJobId?: string; videoStatus: GenerationStatus; videoError?: string
  videoPrompt?: VideoPromptData; customVideoPrompt?: string
  audioUrl?: string; audioStatus: GenerationStatus; audioError?: string
  audioHistory: AudioHistoryItem[]
}

type SceneAssetsMap = Record<number, SceneAssets>  // keyed by scene number
```

### VideoJob

```typescript
interface VideoJob {
  jobId: string; sceneNumber: number; projectId: string
  startedAt: number; status: 'processing' | 'done' | 'error'
  videoUrl?: string; durationSeconds: number
}

videoJobKey(projectId, sceneNum)  // localStorage key
saveVideoJob(job) / loadVideoJob(id, n) / clearVideoJob(id, n)
```

### VideoPromptData

```typescript
interface VideoPromptData {
  sub_tone: string; camera_locked: boolean; camera_instruction: string
  starting_frame: string; temporal_action: string; physics_detail: string
  human_element: string; full_veo_prompt: string  // max 200 chars
}
```

---

## 6. Worker Backend Architecture

### `worker/index.ts` — Router + Auth

**Env bindings:**
```typescript
interface Env {
  JOB_STATUS: KVNamespace        // video job polling state
  R2_BUCKET_NAME: string         // 'igome-story-storage'
  DB: D1Database                 // Cloudflare D1 (users, api_keys, storyboards, scene_assets, usage_log)
  ASSETS: { fetch: typeof fetch } // SPA static files
  GEMINI_API_KEY: string          // env fallback for Gemini
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL: string
  CLERK_SECRET_KEY, CLERK_JWKS_URL: string
}
```

**Route table (order matters — specific before catch-all):**

| Method | Path | Handler | Auth |
|---|---|---|---|
| POST | `/api/brain/provider` | `brain-provider.ts` | none (provider key in headers) |
| POST | `/api/brain/regenerate-veo-prompt` | `regenerate-veo-prompt.ts` | none |
| POST | `/api/brain/rewrite-vo` | `brain.ts` | requireAwsKeys |
| POST | `/api/brain/regenerate-video-prompt` | `brain.ts` | requireAwsKeys |
| POST | `/api/brain/generate` | `brain.ts` | requireAwsKeys |
| POST | `/api/image/generate` | `image.ts` | requireAwsKeys |
| POST | `/api/image/enhance-prompt` | `image.ts` | requireAwsKeys |
| POST | `/api/video/start` | `video.ts` | requireAwsKeys |
| GET | `/api/video/status/:jobId` | `video.ts` | requireAwsKeys |
| POST | `/api/audio/generate` | `audio.ts` | requireAwsKeys |
| POST | `/api/dashscope/brain` | `dashscope.ts` | requireDashscopeKey |
| POST | `/api/dashscope/image/start` | `dashscope.ts` | requireDashscopeKey |
| POST | `/api/dashscope/video/start` | `dashscope.ts` | requireDashscopeKey |
| GET | `/api/dashscope/task/:taskId` | `dashscope.ts` | none |
| POST | `/api/glm/image/generate` | `glm.ts` | requireGlmKey |
| POST | `/api/glm/video/start` | `glm.ts` | requireGlmKey |
| GET | `/api/glm/video/status/:taskId` | `glm.ts` | requireGlmKey |
| GET | `/api/user/*` | `db.ts` handlers | Clerk JWT |
| GET/POST/DELETE | `/api/storyboards/*` | `db.ts` handlers | Clerk JWT |
| GET | `/api/health` | inline | none |
| * | non-`/api/*` | ASSETS (SPA) | none |

**Credential extraction:**
```typescript
extractCredentials(request, env): Credentials
// awsAccessKeyId: h.get('X-AWS-Access-Key-Id') — NO env fallback (security)
// geminiApiKey: h.get('X-Gemini-Api-Key') || h.get('X-Gemini-Key') (backward compat)
// dashscopeApiKey: h.get('X-Dashscope-Api-Key')
// groqApiKey: h.get('X-Groq-Api-Key'), openrouterApiKey: ..., glmApiKey: ...
```

### `worker/brain.ts`

POST `/api/brain/generate` — AWS Bedrock only (requireAwsKeys).
POST `/api/brain/rewrite-vo` → `{ rewritten_text, char_count, char_limit, fits }`
POST `/api/brain/regenerate-video-prompt` → regenerates `video_prompt` for one scene.

VO char limits: `id = 15 chars/sec`, `en = 18 chars/sec`

### `worker/handlers/brain-provider.ts`

POST `/api/brain/provider` — handles Gemini, Groq, OpenRouter, GLM.

Two modes based on request body:
- **MODE A** (`body.story` set, `body.system_prompt` NOT set): storyboard generation.
  Strips `<think>...</think>` + markdown fences, parses JSON, returns storyboard directly.
  Response format matches `/api/brain/generate` — `scenes` at top level.
- **MODE B** (`body.system_prompt` set): raw prompt. Returns `{ content, provider, model }`.
  Used by Settings test buttons.

### `worker/image.ts`

POST `/api/image/generate` — Nova Canvas (`us-east-1`) or SD 3.5 (`us-west-2`).
POST `/api/image/enhance-prompt` — Claude Sonnet enhancement, fallback to basic concatenation.

Dimension maps:
```
Nova Canvas:  9:16→720×1280  16:9→1280×720  1:1→1024×1024  4:5→896×1120
SD 3.5:       9:16→768×1280  16:9→1280×768  1:1→1024×1024  4:5→864×1080
```

REMOVED: `amazon.titan-image-generator-v2:0` (deprecated, no longer in code).

### `worker/video.ts`

Nova Reel: `us-east-1` ONLY, model `amazon.nova-reel-v1:0`, async.

POST `/api/video/start` — StartAsyncInvoke, returns `{ job_id: invocationArn, status: 'processing' }`.
GET `/api/video/status/:jobId` — polls GetAsyncInvoke. ARN path must use `encodeURIComponent(arn)` WITHOUT `.replace(/%3A/gi, ':')`.

Status: `InProgress → processing`, `Completed → done + video_url`, `Failed → error`.
On complete: download from S3 → upload to R2 → return public URL.
Error tracking: `errorCount` in KV; 5 consecutive errors → marks job `failed`.

### `worker/audio.ts`

POST `/api/audio/generate`
```typescript
{ text, language, scene_number, project_id, engine?:'polly'|'elevenlabs', voice? }
→ { audio_url }
```

Polly: endpoint `https://polly.{audioRegion}.amazonaws.com/v1/speech`
Voices (id-ID): Marlene, Andika (neural)
Voices (en-US): Ruth, Danielle (generative), Joanna, Kimberly, Salli, Matthew, Joey, etc. (neural)

ElevenLabs: model `eleven_multilingual_v2`, 9 voices (Bella, Adam, Rachel, etc.)

### `worker/dashscope.ts`

Brain: POST `/compatible-mode/v1/chat/completions` (OpenAI-compat)
Image: POST `/api/v1/services/aigc/text2image/image-synthesis` (async, X-DashScope-Async: enable)
Video: POST `/api/v1/services/aigc/video-generation/video-synthesis` (async)
Poll: GET `/api/v1/tasks/{task_id}` (shared for image + video)

CRITICAL image parameter rule:
- `qwen-image-2.0-pro`, `qwen-image-2.0`: only `{ size, n, negative_prompt }` — NO `prompt_extend`, NO `watermark`
- `wanx2.1-t2i-turbo`, `wan2.6-image`: also add `prompt_extend: true, watermark: false`
- `wan2.6-image` uses messages[] input format (not `{ prompt }`)

On SUCCEEDED: download URL → re-upload to R2 (Dashscope URLs expire in 24h).

### `worker/lib/aws-signature.ts` — CRITICAL

**`buildCanonicalUri` MUST use `encodeURIComponent(decoded)` ONLY:**
```typescript
function buildCanonicalUri(rawUrl: string): string {
  const pathname = new URL(rawUrl).pathname
  return pathname.split('/').map(segment => {
    let decoded: string
    try { decoded = decodeURIComponent(segment) } catch { decoded = segment }
    return encodeURIComponent(decoded)  // ":" → "%3A" — REQUIRED by AWS SigV4
    // NEVER add .replace(/%3A/gi, ':') — this was the old bug
  }).join('/')
}
```

`signRequest(params)` — convenience wrapper, always calls `buildCanonicalUri(url)`.
ARN in video.ts URL path: also `encodeURIComponent(arn)` WITHOUT `.replace` — literal colons cause `UnknownOperationException`.

### `worker/db.ts` — D1 Operations

5 tables: `users`, `api_keys`, `storyboards`, `scene_assets`, `usage_log`
API keys encrypted at rest with AES-GCM.
`CREDIT_COSTS = { brain:20, image:10, video:50, audio:5, enhance:2 }`
500 free credits on first login via `ensureUser()`.

### `worker/lib/auth.ts` — Clerk JWT

`verifyClerkJWT(token, env)` — JWKS fetched from `CLERK_JWKS_URL`, cached 1 hour.
`ensureUser(userId, db)` — upsert user, grant credits on first login.

---

## 6. AI Models & API Formats

### AWS Bedrock Brain — Claude Sonnet 4.6

```
Model: us.anthropic.claude-sonnet-4-6
Endpoint: POST https://bedrock-runtime.{region}.amazonaws.com/model/{modelId}/invoke
Body: { anthropic_version:"bedrock-2023-05-31", max_tokens:8192, system, messages:[{role:"user",content}] }
Response: data.content[0].text
```

### AWS Bedrock Image — Nova Canvas

```
Model: amazon.nova-canvas-v1:0  (literal colon in fetch URL, %3A in canonical URI only)
Region: us-east-1 (or user-configured)
Body: { taskType:'TEXT_IMAGE', textToImageParams:{text,negativeText}, imageGenerationConfig:{numberOfImages:1,height,width,cfgScale:8.0,seed} }
Response: { images: string[] }  — base64 PNG → decoded → uploaded to R2
```

### AWS Bedrock Video — Nova Reel (async)

```
Model: amazon.nova-reel-v1:0  Region: us-east-1 ONLY
StartAsyncInvoke: POST /model/{modelId}/async-invoke
GetAsyncInvoke:   GET  /async-invoke/{encodeURIComponent(arn)}
Body: { modelInput:{taskType:'TEXT_VIDEO', textToVideoParams:{text}, videoGenerationConfig:{durationSeconds,fps:24,dimension,seed}},
        outputDataConfig:{s3OutputDataConfig:{s3Uri}} }
```

### Dashscope Brain (Qwen)

```
Base: https://dashscope-intl.aliyuncs.com
Auth: Authorization: Bearer {apiKey}
POST /compatible-mode/v1/chat/completions
Body: { model, messages:[{role,content}], max_tokens }
Models: qwen3-max, qwen-plus, qwen-flash, qwen-turbo, qwq-plus
```

### Dashscope Image (async)

```
POST /api/v1/services/aigc/text2image/image-synthesis
Header: X-DashScope-Async: enable
Body (qwen-image-2.0-pro, qwen-image-2.0, wanx2.1-t2i-turbo): { model, input:{prompt}, parameters:{size,n,negative_prompt} }
  + for wanx: also parameters.prompt_extend=true, parameters.watermark=false
Body (wan2.6-image ONLY): { model, input:{messages:[{role:'user',content:[{text:prompt}]}]}, parameters:{...} }
Response: { output:{task_id} }
Size uses * separator: 9:16→768*1280  16:9→1280*768  1:1→1024*1024  4:5→864*1080
```

### Dashscope Video (async)

```
POST /api/v1/services/aigc/video-generation/video-synthesis
Header: X-DashScope-Async: enable
i2v body: { model, input:{prompt, img_url}, parameters:{size,duration} }
t2v body: { model, input:{prompt}, parameters:{size,duration} }  — NEVER send img_url for t2v
Models: wan2.6-i2v-flash, wanx2.1-i2v-turbo, wan2.6-t2v-flash, wan2.1-t2v-turbo
Size uses * separator: 9:16→720*1280  16:9→1280*720  1:1→960*960  4:5→864*1080
```

### GLM Image — CogView

```
Endpoint: POST https://open.bigmodel.cn/api/paas/v4/images/generations
Auth: Authorization: Bearer {glmApiKey}
Body: { model:'cogview-3-flash', prompt:string, size:'1024x1024'|'720x1280'|'1280x720' }
Response: { data:[{url:string}] }  — synchronous (no polling needed)
VALID MODEL: cogview-3-flash  (cogview-4-flash does NOT exist — returns "模型不存在")
```

### Google Gemini (via /api/brain/provider)

```
Header: X-Gemini-Api-Key (env GEMINI_API_KEY as fallback)
Models: gemini-2.0-flash (default, FREE), gemini-2.0-flash-lite, gemini-1.5-flash, gemini-2.5-pro-exp-03-25
Always unlocked — env fallback exists.
```

### Groq (via /api/brain/provider)

```
Header: X-Groq-Api-Key
Models: llama-3.3-70b-versatile, llama-3.1-8b-instant, gemma2-9b-it, mixtral-8x7b-32768
Rate limit: 30 req/min free tier
```

### OpenRouter (via /api/brain/provider)

```
Header: X-Openrouter-Api-Key
Models: google/gemma-3-27b-it:free, meta-llama/llama-3.3-70b-instruct:free,
        deepseek/deepseek-r1:free, deepseek/deepseek-v3-0324:free, mistralai/mistral-7b-instruct:free
```

### ZhipuAI GLM (via /api/brain/provider)

```
Header: X-Glm-Api-Key
Models: glm-4-flash, glm-4-flash-250414, glm-z1-flash (reasoning), glm-4.6v
glm-z1-flash outputs <think>...</think> blocks — stripped before JSON.parse in worker
```

---

## 7. Data Flow

```
Home.tsx
  └─ User fills: title, story, platform, tone, brainModel, language, artStyle,
                 aspectRatio, scenes count, image/video model defaults
  └─ POST /api/brain/generate (aws) | /api/dashscope/brain (dashscope) | /api/brain/provider (others)
       └─ AI generates storyboard JSON with scenes, video_prompt per scene (Veo tones)
       └─ Response parsed, session created in storyboardSessionStore (nanoid ID)
       └─ saveStoryboard() to D1 (non-blocking)
       └─ navigate('/storyboard?id=SESSION_ID')

Storyboard.tsx (per scene)
  ├─ Image: POST /api/image/generate (Bedrock) | /api/dashscope/image/start (Dashscope)
  │   └─ Dashscope: poll GET /api/dashscope/task/:taskId until SUCCEEDED
  │   └─ Nova Canvas: synchronous → R2 → image_url
  │
  ├─ Video: POST /api/video/start (Nova Reel) | /api/dashscope/video/start (Wan)
  │   └─ Returns job_id/task_id → saved to localStorage video_job_{projectId}_{sceneNum}
  │   └─ Poll every 10s, timeout 10min
  │   └─ On done: video downloaded → uploaded to R2 → R2 public URL
  │
  ├─ Audio: POST /api/audio/generate → Polly | ElevenLabs → R2 → audio_url
  │   └─ Optional rewrite: POST /api/brain/rewrite-vo → rewritten VO text
  │
  └─ Veo Prompt (VeoPromptSection): POST /api/brain/regenerate-veo-prompt
      └─ Supports all providers (headers forwarded)
      └─ Strips <think> blocks for reasoning models
      └─ Copy button: copies JSON when raw view active, plain text when breakdown view

Auth-protected D1 routes:
  GET/PUT /api/user/profile    <- credits, preferences
  GET/POST /api/user/keys      <- encrypted API keys (AES-GCM)
  GET /api/user/usage          <- credit usage log
  GET/POST/DELETE /api/storyboards/*   <- cloud storyboard CRUD
  POST /api/storyboards/:id/scenes     <- upsert scene asset
```

---

## 8. Queue Mode (Minimize/Resume)

1. User clicks "Minimize" → `updateSession(id, { isMinimized: true })` + `navigate('/')`
2. BottomNav Queue button (4th slot) shows badge with running/done count
3. Tapping Queue → opens popup panel (`bottom: 70px`, `zIndex: 199`) listing minimized sessions + brain tasks
4. "Resume" → `updateSession(id, { isMinimized: false })` + `navigate('/storyboard?id=ID')`
5. "View" (done tasks with sessionId) → navigates to storyboard
6. On Storyboard mount: video polling auto-restarts for any `videoStatus: 'generating'` assets
7. `activeSessionIdRef` (useRef) in Storyboard.tsx — avoids stale closures in polling callbacks

`GenTaskBar.tsx` file still exists in `src/components/` but is NOT imported or rendered anywhere (removed from `App.tsx` in v4.0).

---

## 9. Critical Rules & Patterns

### AWS Sig V4 Canonical URI — THE #1 BUG SOURCE

`:` MUST be `%3A` in the canonical URI. NEVER use `.replace(/%3A/gi, ':')`.

```typescript
// CORRECT in buildCanonicalUri (aws-signature.ts)
return encodeURIComponent(decoded)  // ":" encodes to "%3A" — AWS requires this

// WRONG — old bug that caused Nova Canvas signature failures
return encodeURIComponent(decoded).replace(/%3A/gi, ':')  // NEVER DO THIS
```

Same rule for ARN in video.ts URL path:
```typescript
const arnForUrl = encodeURIComponent(arn)  // CORRECT
// NOT: encodeURIComponent(arn).replace(/%3A/gi, ':')  // WRONG
```

### No env.AWS_ACCESS_KEY_ID Fallback (Security)

`extractCredentials()` does NOT fall back to `env.AWS_ACCESS_KEY_ID` for generation routes.
All routes call `requireAwsKeys(creds)` → 401 if keys not supplied by user.

### Named Exports Only

```typescript
export function Home() { ... }   // CORRECT
export default function Home() { ... }  // WRONG
```

### Inline Styles Only

No Tailwind. All styles via `style={{ }}` using `tk(isDark)` tokens.

### CORS Headers

Applied to ALL Worker responses. Includes all `X-*` header names.

### Video Prompt Priority (Storyboard.tsx)

`customVideoPrompt || videoPrompt.full_prompt || editedPrompts[sceneNum] || image_prompt`

### localStorage Keys

- User settings: `fuzzy_settings_{userId}` (NOT `fuzzy_short_settings`)
- Video jobs: `video_job_{projectId}_{sceneNum}`
- Sessions: `fuzzy_storyboard_sessions` (Zustand persist)
- History: `fuzzy-short-history` (Zustand persist)
- Theme: `fuzzy_theme`

---

## 10. Infrastructure & Deployment

### Wrangler Bindings (wrangler.toml)

```toml
name = "fuzzy-vid-worker"
main = "worker/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

[[r2_buckets]]
binding = "STORY_STORAGE"  # legacy binding
bucket_name = "igome-story-storage"

[[kv_namespaces]]
binding = "JOB_STATUS"
id = "fc732a268ca9435b8de8e50f34a35365"

[[d1_databases]]
binding = "DB"
database_name = "fuzzy-short-db"
database_id = "YOUR_DATABASE_ID"

[assets]
binding = "ASSETS"
not_found_handling = "single-page-application"
```

### Worker Secrets (wrangler secret put)

| Secret | Usage |
|---|---|
| `GEMINI_API_KEY` | Gemini fallback if user provides no key |
| `R2_ACCESS_KEY_ID` | R2 S3-compatible API |
| `R2_SECRET_ACCESS_KEY` | R2 S3-compatible API |
| `R2_ACCOUNT_ID` | R2 account ID |
| `R2_BUCKET_NAME` | `igome-story-storage` |
| `R2_PUBLIC_URL` | `https://pub-xxx.r2.dev` |
| `CLERK_SECRET_KEY` | Clerk server-side verification |
| `CLERK_JWKS_URL` | `https://[slug].clerk.accounts.dev/.well-known/jwks.json` |
| `AWS_ACCESS_KEY_ID` | R2 ops only — NOT used in extractCredentials for generation |
| `AWS_SECRET_ACCESS_KEY` | R2 ops only |

### Auth — Clerk

Use `pk_test_` keys for `.pages.dev` domains — `pk_live_` requires a real custom domain.
Set `VITE_CLERK_PUBLISHABLE_KEY` in `.env.local` AND Cloudflare Pages environment variables.
`CLERK_JWKS_URL` must match the key's domain.

### Deploy Commands

```bash
# TypeScript check (must be 0 errors)
npx tsc --noEmit

# Build frontend
npm run build

# Deploy Worker
wrangler deploy

# Push frontend (Cloudflare Pages auto-deploys on push to main)
git add src/... worker/...   # specific files only — never git add -A
git commit -m "feat/fix: description"
git push origin main

# Live Worker logs
wrangler tail
```

### Regional Strategy

| Service | Region | Notes |
|---|---|---|
| Bedrock Brain | `us-east-1` default | User-configurable |
| Bedrock Image — Nova Canvas | `us-east-1` default | User-configurable |
| Bedrock Image — SD 3.5 | `us-west-2` ONLY | Hard requirement |
| Nova Reel Video | `us-east-1` ONLY | Hard requirement |
| Polly Audio | User-configurable | Default varies |
| Dashscope | Singapore (auto) | No region param needed |
| R2 | `auto` | Cloudflare-managed |

---

## 11. Common Errors & Fixes

**"signature does not match"**
→ `buildCanonicalUri` in `aws-signature.ts`: ensure `encodeURIComponent(decoded)` with NO `.replace(/%3A/gi, ':')`
→ `:` MUST be `%3A` in canonical URI

**Nova Reel "UnknownOperationException"**
→ `video.ts` ARN path: use `encodeURIComponent(arn)` WITHOUT `.replace(/%3A/gi, ':')`.
→ Literal colons in URL path break AWS routing to `GetAsyncInvoke`.

**"url error, please check url！" (Dashscope image)**
→ `prompt_extend: true` (boolean) was passed to `qwen-image-2.0-pro` or `qwen-image-2.0`.
→ These models treat `prompt_extend` as a URL string field — boolean causes "url error".
→ Fix: skip `prompt_extend` and `watermark` for `isQwenImage` models.

**"模型不存在" (GLM image)**
→ `cogview-4` and `cogview-4-flash` do not exist. Use `cogview-3-flash` only.
→ `worker/glm.ts` default must be `'cogview-3-flash'`. Remove `cogview-4` from `IMAGE_MODELS` arrays in `Home.tsx` and `Storyboard.tsx`.

**Queue badge always shows 0 (BottomNav)**
→ `tasks.filter(t => t.status === 'running')` shadows `t = tk(isDark)` — filter returns token object, `.status` is undefined.
→ Fix: `tasks.filter(task => task.status === 'running').length`

**Expand/Collapse button invisible in dark mode (Storyboard scene cards)**
→ `background: rgba(255,255,255,0.8)` hardcoded white blends with light text in dark mode.
→ Fix: `background: 'var(--input-bg)'`, `color: 'var(--text-primary)'`, `fontWeight: 600`

**Dashscope video "Model not exist" / invalid fallback model**
→ `wan2.1-i2v-plus` is an invalid obsolete ID. Fallback must be `wan2.6-i2v-flash`.
→ Fix in `worker/dashscope.ts`: `body.video_model || 'wan2.6-i2v-flash'`

**GLM/Groq/OpenRouter storyboard generates then redirects to homepage**
→ `brain-provider.ts` was returning `{ content: "..." }` instead of parsed JSON.
→ Fixed in v3.8: MODE A (`body.story` set) returns storyboard JSON directly.

**"AWS credentials required" on non-AWS brain routes**
→ `getModelById(brainModel)?.provider` must return `'gemini'/'groq'/'glm'/'openrouter'`
→ Check `providerModels.ts` model definition and Home.tsx routing logic.

**Clerk "failed_to_load_clerk_js"**
→ Using `pk_live_` key on `.pages.dev` — switch to `pk_test_` (development key).

---

## 12. Cost Estimates

| Service | Model | Rate |
|---|---|---|
| Brain | Claude Sonnet 4.6 | ~$0.005–0.01 per storyboard |
| Brain | Gemini 2.0 Flash | Free (default) |
| Brain | Groq Llama 3.3 | Free |
| Brain | GLM-4-Flash | Unlimited free |
| Image | Nova Canvas | ~$0.04 per image |
| Image | SD 3.5 | ~$0.065 per image |
| Image | Qwen Image 2.0 Pro | ~$0.02 per image |
| Image | CogView-3-Flash | Free |
| Video | Nova Reel (6s) | ~$0.80 per clip |
| Video | Wan 2.6 | ~$0.10–0.20 per clip |
| Audio | Polly neural | $0.004/1K chars |
| Audio | ElevenLabs | $0.18/1K chars |

D1 credit costs: brain=20, image=10, video=50, audio=5, enhance=2
