# Fuzzy-vid — Complete Architecture Reference

## 1. Project Overview

AI-powered short video production app. Users describe a story; the app generates a full storyboard with AI-written scenes, then generates images, videos, and narration per scene.

| Layer | Technology | URL |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | https://fuzzystuf.pages.dev |
| Backend | Cloudflare Worker (plain fetch, no framework) | https://fuzzy-vid-worker.officialdian21.workers.dev |
| Storage | Cloudflare R2 (`igome-story-storage`) | via Worker proxy |
| AI Brain | AWS Bedrock — Claude Sonnet 4.6 + Llama 4 Maverick | us-east-1 |
| AI Image | AWS Bedrock — Nova Canvas + Titan V2 | configurable |
| AI Video | AWS Bedrock — Nova Reel (async) | us-east-1 fixed |
| AI Audio | AWS Polly + ElevenLabs | Polly: us-west-2 |

---

## 2. Directory Structure

```
/
├── src/                          # React frontend
│   ├── main.tsx                  # Entry point, QueryClient + Router setup
│   ├── App.tsx                   # Route definitions
│   ├── index.css                 # Global reset + iOS Liquid Glass variables
│   ├── styles/glass.css          # Glass morphism component styles
│   ├── pages/
│   │   ├── Home.tsx              # Main form: title, story, config, generate
│   │   ├── Storyboard.tsx        # Per-scene workspace with image/video/audio
│   │   ├── Settings.tsx          # API key management UI
│   │   └── History.tsx           # Saved storyboard list
│   ├── components/
│   │   ├── GenerationOverlay.tsx # Animated overlay during brain generation
│   │   ├── GenTaskBar.tsx        # Bottom bar for minimized sessions
│   │   ├── ErrorBoundary.tsx
│   │   ├── forms/
│   │   │   └── StoryInputForm.tsx
│   │   ├── glass/                # iOS Liquid Glass primitives
│   │   │   ├── GlassBadge.tsx
│   │   │   ├── GlassButton.tsx
│   │   │   ├── GlassCard.tsx
│   │   │   ├── GlassInput.tsx
│   │   │   └── GlassModal.tsx
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Header.tsx
│   │   │   └── ProjectHeader.tsx
│   │   ├── scene/
│   │   │   ├── SceneCard.tsx     # Collapsible scene card, editable prompts
│   │   │   ├── SceneWorkspace.tsx
│   │   │   └── tabs/
│   │   │       ├── ImageTab.tsx
│   │   │       ├── VideoTab.tsx
│   │   │       └── AudioTab.tsx
│   │   ├── storyboard/
│   │   │   ├── ProgressBar.tsx
│   │   │   └── StoryboardGrid.tsx
│   │   ├── skeletons/
│   │   │   ├── AudioWaveformSkeleton.tsx
│   │   │   ├── ImageSkeleton.tsx
│   │   │   ├── StoryboardGridSkeleton.tsx
│   │   │   └── VideoProgressBar.tsx
│   │   └── ui/
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── SegmentedControl.tsx
│   │       ├── tabs.tsx
│   │       └── Toaster.tsx
│   ├── hooks/
│   │   ├── useBrainGenerate.ts   # TanStack Query mutation for /api/brain/generate
│   │   ├── useImageGenerate.ts   # Mutation + polling for image generation
│   │   ├── useVideoGenerate.ts   # Mutation + polling for video generation
│   │   ├── useAudioGenerate.ts   # Mutation for audio TTS
│   │   ├── useElapsedTimer.ts    # ms timer for generation overlay
│   │   └── useNotify.ts          # Toast wrapper
│   ├── store/                    # Zustand state management
│   │   ├── storyboardSessionStore.ts  # persisted — sessions with assets
│   │   ├── genTaskStore.ts            # in-memory — brain task tracking
│   │   ├── costStore.ts               # in-memory — session cost tracking
│   │   ├── historyStore.ts            # persisted — saved storyboard list
│   │   ├── projectStore.ts            # in-memory — active project + scene
│   │   └── settingsStore.ts           # settings (mirror of localStorage)
│   ├── lib/
│   │   ├── api.ts                # Worker endpoint wrappers + credential injection
│   │   ├── costEstimate.ts       # Per-model cost estimation functions
│   │   └── utils.ts              # Generic helpers
│   └── types/
│       └── schema.ts             # Shared types: ProjectSchema, Scene, VideoJob, etc.
│
├── worker/                       # Cloudflare Worker backend
│   ├── index.ts                  # Router, CORS, extractCredentials, Env interface
│   ├── brain.ts                  # Storyboard generation + VO rewrite
│   ├── image.ts                  # Nova Canvas + Titan V2 + enhance-prompt
│   ├── video.ts                  # Nova Reel async-invoke + ARN polling
│   ├── audio.ts                  # Polly + ElevenLabs TTS
│   ├── project.ts                # Project CRUD routes
│   ├── storage.ts                # R2 file serve + presign + test
│   └── lib/
│       ├── aws-signature.ts      # AwsV4Signer class + signRequest function
│       └── cors.ts               # CORS header constants
│
├── wrangler.toml                 # Worker config: R2, KV, ASSETS bindings
├── vite.config.ts                # Vite build config
├── tsconfig.app.json             # Frontend TypeScript config
├── worker/tsconfig.json          # Worker TypeScript config
└── package.json
```

---

## 3. Frontend Architecture

### Pages

| Page | Route | Responsibility |
|---|---|---|
| `Home` | `/` | Story input form, AI model selection, aspect ratio, duration slider, trigger brain generation |
| `Storyboard` | `/storyboard?id=SESSION_ID` | Per-scene generation workspace: view scenes, generate image/video/audio, rewrite VO |
| `Settings` | `/settings` | AWS keys, ElevenLabs key, region selection per service |
| `History` | `/history` | List of saved storyboards from `historyStore` |

### Component Hierarchy

```
AppLayout
├── Header (nav: Home / Settings / History)
│   └── GenTaskBar (bottom bar, minimized sessions with Resume button)
└── <Outlet>
    ├── Home
    │   ├── StoryInputForm
    │   ├── SegmentedControl (aspect ratio)
    │   └── GenerationOverlay (animated steps during brain generate)
    ├── Storyboard
    │   ├── ProjectHeader (title, metadata)
    │   ├── ProgressBar
    │   └── [SceneCard × N]
    │       ├── ImageTab  → useImageGenerate → /api/image/generate
    │       ├── VideoTab  → useVideoGenerate → /api/video/start + /api/video/status/:id
    │       └── AudioTab  → useAudioGenerate → /api/audio/generate
    ├── Settings (GlassCard, GlassInput per key)
    └── History (list of HistoryItem)
```

### Glass UI Components

All components use inline styles (no Tailwind). The design is iOS 26 Liquid Glass light theme:
- `GlassCard` — `background: rgba(255,255,255,0.72)`, `backdropFilter: blur(20px) saturate(180%)`
- `GlassButton` — primary orange `#F05A25`, secondary white glass
- `GlassInput` — glass background, border on focus
- `GlassBadge` — small label with pill shape
- `GlassModal` — fullscreen overlay for image lightbox / video preview

### Custom Hooks

| Hook | Pattern | Notes |
|---|---|---|
| `useBrainGenerate` | TanStack Query `useMutation` | Posts to `/api/brain/generate`, sets project in `projectStore` |
| `useImageGeneration(sceneId)` | mutation + polling query | Polls `/api/image/status/:jobId` every 5s until done/failed |
| `useVideoGeneration(sceneId)` | mutation + polling query | Polls `/api/video/status/:jobId` every 5s until done/failed |
| `useAudioGenerate` | `useMutation` only | Synchronous — no polling needed |

### API Layer (`src/lib/api.ts`)

Credential injection pattern — all API calls inject credentials from `localStorage`:

```typescript
function getApiHeaders(): Record<string, string> {
  const stored = localStorage.getItem('fuzzy_short_settings')
  const keys = stored ? JSON.parse(stored) : {}
  return {
    ...(keys.awsAccessKeyId && { 'X-AWS-Access-Key-Id': keys.awsAccessKeyId }),
    ...(keys.awsSecretAccessKey && { 'X-AWS-Secret-Access-Key': keys.awsSecretAccessKey }),
    ...(keys.imageRegion && { 'X-Image-Region': keys.imageRegion }),
    ...(keys.audioRegion && { 'X-Audio-Region': keys.audioRegion }),
    ...(keys.elevenLabsApiKey && { 'X-ElevenLabs-Key': keys.elevenLabsApiKey }),
  }
}
```

Exported functions: `generateImage`, `checkVideoStatus`, `generateVideo`, `startVideoJob`, `pollVideoStatus`, `enhancePrompt`, `rewriteVO`, `generateAudio`

---

## 4. State Management (Zustand)

### `storyboardSessionStore` — persisted (`fuzzy_storyboard_sessions`)

```typescript
interface StoryboardSession {
  id: string           // nanoid(8)
  rawJson: string      // raw storyboard JSON from brain
  title: string
  imageModel: 'nova_canvas' | 'titan_v2'
  audioEngine: 'polly' | 'elevenlabs'
  audioVoice: string
  language: string
  assets: SceneAssetsMap   // Record<sceneNumber, SceneAssets>
  isMinimized: boolean     // true = session running in background
  createdAt: string
}
```

- Max 5 sessions — oldest pruned on create
- URL uses `?id=SESSION_ID` for routing
- `updateAsset(id, sceneNum, partial)` — merges per-scene asset state
- `updateSession(id, partial)` — updates session fields (e.g. `isMinimized`)

### `genTaskStore` — in-memory only

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

Tracks active brain generation tasks. Used by `GenTaskBar` to show minimized sessions.

### `costStore` — in-memory only

```typescript
interface CostEntry {
  service: string
  model: string
  cost: number
  timestamp: string
}
// sessionTotal: number — running sum
```

Cost added after each generation action. Cleared on page reload (not persisted).

### `historyStore` — persisted (`fuzzy-short-history`)

```typescript
interface HistoryItem {
  id: string
  title: string
  platform: string
  art_style: string
  language: string
  brain_model: string
  scenes_count: number
  created_at: string
  storyboard_data: string  // raw JSON of the full storyboard
}
```

### `projectStore` — in-memory (devtools enabled)

```typescript
// project: ProjectSchema | null
// activeSceneId: number | null
// setProject, setActiveSceneId, updateScene(sceneId, partial), getScene(sceneId)
```

Holds the currently active project during the Storyboard session. Not persisted.

---

## 5. Type System (`src/types/schema.ts`)

### Core Enums

```typescript
type ArtStyle    = 'cinematic_realistic' | 'anime_stylized' | 'comic_book' | 'oil_painting' | 'watercolor' | 'pixel_art' | '3d_render'
type AspectRatio = '9_16' | '16_9' | '1_1' | '4_5'
type BrainModel  = 'gemini' | 'llama4_maverick' | 'claude_sonnet'
type ImageModel  = 'gemini' | 'nova_canvas' | 'titan_v2'
type VideoModel  = 'nova_reel' | 'runway_gen4' | 'runway_gen4_turbo'
type AudioModel  = 'polly' | 'gemini_tts' | 'elevenlabs'
type AssetStatus = 'pending' | 'generating' | 'done' | 'approved' | 'failed'
```

### Key Interfaces

```typescript
interface SceneAssets {
  imageUrl?: string; imageStatus: GenerationStatus; imageError?: string
  enhancedPrompt?: string
  videoUrl?: string; videoJobId?: string; videoStatus: GenerationStatus; videoError?: string
  audioUrl?: string; audioStatus: GenerationStatus; audioError?: string
  audioHistory: AudioHistoryItem[]
}

type SceneAssetsMap = Record<number, SceneAssets>  // keyed by scene number

interface VideoJob {
  jobId: string           // invocationArn (ARN-based) or KV short-key (legacy)
  sceneNumber: number
  projectId: string
  startedAt: number       // Date.now()
  status: 'processing' | 'done' | 'error'
  videoUrl?: string
  durationSeconds: number
}
```

### VideoJob Persistence (localStorage)

```typescript
videoJobKey(projectId, sceneNum) → `video_job_${projectId}_${sceneNum}`
saveVideoJob(job)    // localStorage.setItem
loadVideoJob(id, n)  // localStorage.getItem + parse
clearVideoJob(id, n) // localStorage.removeItem
```

### Duration Helpers

```typescript
redistributeDurations(sceneCount, totalTarget): SceneDuration[]
// Calculates perScene = clamp(round(total/count), 2, 6) for each scene
```

### Settings

```typescript
interface AppSettings {
  geminiApiKey: string
  awsAccessKeyId: string; awsSecretAccessKey: string
  brainRegion: 'us-east-1' | 'us-west-2' | 'ap-southeast-1'
  imageRegion: 'us-east-1' | 'us-west-2' | 'ap-southeast-1'
  audioRegion: 'us-east-1' | 'us-west-2' | 'ap-southeast-1'
  videoRegion: 'us-east-1'   // always fixed
  elevenLabsApiKey: string; runwayApiKey: string
}

buildApiHeaders(settings): Record<string, string>  // converts to X-* headers
SETTINGS_STORAGE_KEY = 'fuzzy_short_settings'
```

---

## 6. Worker Backend Architecture

### `worker/index.ts` — Router

**Env bindings:**
```typescript
interface Env {
  JOB_STATUS: KVNamespace          // video job polling state
  STORY_STORAGE: R2Bucket          // image/audio/video file storage
  ASSETS: { fetch: typeof fetch }  // SPA static files (ASSETS binding)
  GEMINI_API_KEY, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
  RUNWAY_API_KEY, ELEVENLABS_API_KEY, ENVIRONMENT: string
}
```

**Route table:**

| Method | Path | Handler |
|---|---|---|
| POST | `/api/brain/rewrite-vo` | `handleRewriteVO` |
| POST | `/api/brain/generate` | `handleBrainRequest` |
| POST | `/api/image/enhance-prompt` | `handleEnhancePrompt` |
| POST | `/api/image/generate` | `handleImageRequest` |
| POST | `/api/video/start` | `handleVideoStart` |
| GET  | `/api/video/status/:jobId` | `handleVideoStatus` |
| POST | `/api/video/generate` | `handleVideoRequest` (legacy) |
| POST | `/api/audio/generate` | `handleAudioRequest` |
| * | `/api/project/*` | `handleProjectRequest` |
| GET  | `/api/storage/file/:key` | `handleStorageRequest` |
| GET  | `/api/storage/test` | `handleStorageRequest` |
| GET  | `/api/storage/presign` | `handleStorageRequest` |
| GET  | `/api/health` | inline `{ status: 'ok' }` |
| * | non-/api/* | ASSETS fallback (SPA index.html) |

**Credential extraction** — header-first, env fallback:
```typescript
extractCredentials(request, env): Credentials
// X-AWS-Access-Key-Id || env.AWS_ACCESS_KEY_ID
// X-Brain-Region      || 'us-east-1'
// X-Image-Region      || 'us-east-1'
// X-Audio-Region      || 'us-west-2'
// videoRegion         = 'us-east-1' (hardcoded — Nova Reel only in us-east-1)
```

### `worker/brain.ts`

**POST `/api/brain/generate`** — Storyboard generation

Request body:
```typescript
{
  title: string, story: string, platform: string,
  brain_model: 'claude_sonnet' | 'llama4_maverick' | 'gemini',
  language: 'id' | 'en', art_style: string, total_scenes: number,
  aspect_ratio: string, resolution: string,
  total_duration: number, scene_durations: number[]
}
```

- `gemini` and `claude_sonnet` both route to Claude Sonnet 4.6 (Gemini is down)
- `llama4_maverick` uses Llama 4 chat template format
- Response: raw JSON string (AI-generated storyboard, stripped of markdown fences)
- Duration-aware prompting: `getVoCharLimit(durationSeconds, language)` → ID=15 chars/s, EN=18 chars/s

**POST `/api/brain/rewrite-vo`** — VO rewrite to fit duration

```typescript
// Request: { original_text, duration_seconds, language, scene_context, art_style }
// Response: { rewritten_text, char_count, char_limit, fits }
```

### `worker/image.ts`

**POST `/api/image/generate`** — Synchronous image generation

- Nova Canvas: `amazon.nova-canvas-v1:0` — standard dimensions
- Titan V2: `amazon.titan-image-generator-v2:0` — preset dimensions only

Dimension maps:
```
Nova Canvas:  9:16→720×1280  16:9→1280×720  1:1→1024×1024  4:5→896×1120
Titan V2:     9:16→768×1280  16:9→1280×768  1:1→1024×1024  4:5→896×1152
```

Bedrock body:
```typescript
{ taskType: 'TEXT_IMAGE', textToImageParams: { text, negativeText }, imageGenerationConfig: { numberOfImages:1, height, width, cfgScale:8.0, seed } }
```

Returns base64 → decoded → uploaded to R2 → returns `{ image_url }` pointing to `/api/storage/file/...`

**POST `/api/image/enhance-prompt`** — Claude-powered prompt enhancement

Uses Claude Sonnet 4.6 to add cinematography terms, lighting, camera specs. Falls back to `${rawPrompt}, ${artStyle}, cinematic lighting, 8k UHD` on error.

### `worker/video.ts`

Nova Reel is always `us-east-1`, model `amazon.nova-reel-v1:0`, fixed `durationSeconds: 6`.

**POST `/api/video/start`** (new flow) — Returns `invocationArn` as `job_id`:
```typescript
// Request: { prompt, image_url?, scene_number, project_id, aspect_ratio, duration_seconds }
// Body: { modelInput: { taskType:'TEXT_VIDEO', textToVideoParams:{text}, videoGenerationConfig:{durationSeconds:6, fps:24, dimension, seed} }, outputDataConfig:{s3OutputDataConfig:{s3Uri}} }
// Response: { job_id: invocationArn, scene_number, status:'processing' }
```

**GET `/api/video/status/:jobId`** (unified) — Routes by jobId type:
- `arn:aws:*` → polls Bedrock `GET /async-invoke/{encodedArn}` directly
- Other → KV short-key lookup (legacy `generateVideo` flow)

ARN encoding for URL: `encodeURIComponent(arn).replace(/%3A/gi, ':')` — keep colons literal.

KV polling flow: tracks `errorCount`; after 5 consecutive Bedrock errors → marks job `failed`.

Status mapping:
```
Bedrock "Completed" → { status: 'done', video_url }
Bedrock "Failed"    → { status: 'error', message }
Bedrock "InProgress"→ { status: 'processing' }
```

**POST `/api/video/generate`** (legacy) — Creates KV job, returns `job_id` (short key).

### `worker/audio.ts`

**POST `/api/audio/generate`**

```typescript
// Request: { text, language, scene_number, project_id, engine?:'polly'|'elevenlabs', voice? }
// Response: { audio_url }  (R2 path proxied via /api/storage/file/)
```

**Polly:**
- Endpoint: `https://polly.{audioRegion}.amazonaws.com/v1/speech`
- Default voice: `Ruth`; generative engine for `Ruth`, `Danielle`; neural for others
- Language code: `id-ID` | `en-US`

**ElevenLabs:**
- Model: `eleven_multilingual_v2`
- Voice map: `Adam`, `Rachel`, `Antoni`, `Bella` → resolved voice IDs
- Language fallback: `id` → Arnold voice ID, `en` → Bella voice ID

Both return `ArrayBuffer` → uploaded to R2 as `audio/mpeg`.

### `worker/storage.ts`

| Route | Action |
|---|---|
| `GET /api/storage/file/:key` | Serve R2 object with `Cache-Control: public, max-age=86400` |
| `GET /api/storage/test` | Test R2 connectivity via S3-compatible list |
| `GET /api/storage/presign?key=...` | Generate presigned URL for R2 object |

R2 is accessed via Cloudflare ASSETS binding (native) for direct reads; S3-compatible API (signed with AwsV4Signer, region `'auto'`, service `'s3'`) for test/presign.

### `worker/lib/aws-signature.ts`

**`AwsV4Signer` class:**
- `sign(request: Request): Promise<Request>` — adds `x-amz-date`, `Authorization`, optional session token
- `createCanonicalRequest` — uses `encodeURIPath` for path normalization

**Critical `encodeURIPath` implementation:**
```typescript
function encodeURIPath(path: string): string {
  return decodeURIComponent(path)
    .split('/')
    .map(segment =>
      encodeURIComponent(segment)
        .replace(/[!*'()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
        .replace(/%2F/gi, '/')   // keep slash literal
        .replace(/%3A/gi, ':')   // keep colon literal — CRITICAL for ARN paths
    )
    .join('/')
}
```

**`signRequest(params)` function** — convenience wrapper, used by `brain.ts` (older code):
```typescript
signRequest({ method, url, region, service, accessKeyId, secretAccessKey, body, headers }): Promise<Headers>
```

---

## 7. AI Models & API Formats

### Claude Sonnet 4.6 (via Bedrock)

```
Model ID:  us.anthropic.claude-sonnet-4-6
Endpoint:  POST https://bedrock-runtime.{region}.amazonaws.com/model/{modelId}/invoke
```

```typescript
// Request body
{
  anthropic_version: "bedrock-2023-05-31",
  max_tokens: 8192,
  system: systemPrompt,
  messages: [{ role: "user", content: prompt }]
}
// Response
data.content[0].text
```

### Llama 4 Maverick (via Bedrock)

```
Model ID:  us.meta.llama4-maverick-17b-instruct-v1:0
Endpoint:  POST https://bedrock-runtime.{region}.amazonaws.com/model/{modelId}/invoke
```

```typescript
// Request body — chat template format
{
  prompt: "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n"
    + systemPrompt
    + "<|eot_id|><|start_header_id|>user<|end_header_id|>\n"
    + userPrompt
    + "<|eot_id|><|start_header_id|>assistant<|end_header_id|>",
  max_gen_len: 8192,
  temperature: 0.7
}
// Response
data.generation
```

### Nova Canvas (Image)

```
Model ID:  amazon.nova-canvas-v1:0
Region:    configurable (imageRegion)
```

```typescript
{
  taskType: 'TEXT_IMAGE',
  textToImageParams: { text: string, negativeText: string },
  imageGenerationConfig: { numberOfImages: 1, height, width, cfgScale: 8.0, seed }
}
// Response: { images: string[] }  — base64 PNG
```

### Nova Reel (Video, async)

```
Model ID:  amazon.nova-reel-v1:0
Region:    us-east-1 ONLY
Duration:  6 seconds ONLY (v1:0 constraint)
```

```typescript
// StartAsyncInvoke — POST /model/{modelId}/async-invoke
{
  modelInput: {
    taskType: 'TEXT_VIDEO',
    textToVideoParams: { text: string },
    videoGenerationConfig: { durationSeconds: 6, fps: 24, dimension: '720x1280'|'1280x720', seed }
  },
  outputDataConfig: { s3OutputDataConfig: { s3Uri: 's3://igome-story-storage/...' } }
}
// Response: { invocationArn: string }

// GetAsyncInvoke — GET /async-invoke/{encodedArn}
// Response: { status: 'InProgress'|'Completed'|'Failed', failureMessage?, outputDataConfig? }
```

### Polly (Audio TTS)

```
Endpoint:  POST https://polly.{audioRegion}.amazonaws.com/v1/speech
```

```typescript
{
  Engine: 'generative' | 'neural',  // generative for Ruth/Danielle, neural otherwise
  LanguageCode: 'en-US' | 'id-ID',
  OutputFormat: 'mp3',
  Text: string,
  TextType: 'text',
  VoiceId: string
}
// Response: binary MP3 ArrayBuffer
```

---

## 8. Data Flow

```
Home.tsx
  └─ User fills: title, story, platform, brainModel, language, artStyle,
                 aspectRatio, scenes count, totalDuration, scene durations
  └─ POST /api/brain/generate → brain.ts
       └─ Claude Sonnet 4.6 → raw JSON storyboard
       └─ Response parsed, session created in storyboardSessionStore
       └─ navigate('/storyboard?id=SESSION_ID')

Storyboard.tsx (per scene)
  ├─ ImageTab
  │   └─ POST /api/image/enhance-prompt → enhanced prompt
  │   └─ POST /api/image/generate → Nova Canvas → R2 → image_url
  │
  ├─ VideoTab
  │   └─ POST /api/video/start → Nova Reel async-invoke → invocationArn
  │   └─ GET  /api/video/status/{arn} (poll every ~10s) → done → video_url
  │   └─ video_url = /api/storage/file/projects/{id}/scene_{n}/video_{ts}/output.mp4
  │
  └─ AudioTab
      └─ POST /api/audio/generate → Polly|ElevenLabs → R2 → audio_url
      └─ Optional: POST /api/brain/rewrite-vo → rewritten VO text

Storage layer
  └─ All assets stored in R2 bucket: igome-story-storage
  └─ R2 keys: projects/{project_id}/scene_{n}/{img|video|audio}_{timestamp}.{ext}
  └─ Served via: GET /api/storage/file/{key}
```

---

## 9. Critical Rules & Patterns

### AWS Sig V4 Colon Encoding (CRITICAL)

ARN contains colons (e.g. `arn:aws:bedrock:us-east-1:123:async-invoke/xyz`). These MUST remain literal in the canonical URI path — never `%3A`.

```typescript
// In encodeURIPath (aws-signature.ts)
.replace(/%3A/gi, ':')  // keep colon literal

// In handleVideoStatus (video.ts) when building status URL
const arnForUrl = encodeURIComponent(jobId).replace(/%3A/gi, ':')
```

### Named Exports Only

```typescript
// CORRECT
export function Home() { ... }

// WRONG — never do this
export default function Home() { ... }
```

### Inline Styles Only

No Tailwind classes in JSX. All styles via `style={{ }}` or CSS variables in `glass.css`.

### CORS Headers

Applied in `index.ts` wrapper to ALL responses:
```typescript
'Access-Control-Allow-Origin': '*'
'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
'Access-Control-Allow-Headers': 'Content-Type, X-Gemini-Key, X-AWS-Access-Key-Id, X-AWS-Secret-Access-Key, X-Brain-Region, X-Image-Region, X-Audio-Region, X-ElevenLabs-Key, X-Runway-Key, X-R2-Account-Id, X-R2-Access-Key-Id, X-R2-Secret-Access-Key, X-R2-Bucket'
```

OPTIONS preflight handled first in fetch handler.

### Video Region Fixed

`videoRegion` is always `'us-east-1'` — hardcoded in `extractCredentials`, not user-configurable. Nova Reel is only available in us-east-1.

### Credential Passthrough Pattern

User keys stored in `localStorage('fuzzy_short_settings')` → injected as `X-*` headers on every API call → Worker reads from headers first, falls back to Wrangler env secrets.

### Duration-Aware VO Prompting

```typescript
function getVoCharLimit(durationSeconds: number, language: string): number {
  const charsPerSecond = language === 'id' ? 15 : 18
  return Math.floor(durationSeconds * charsPerSecond)
}
```

Used in: brain system prompt, scene-level char limit, rewrite-vo endpoint.

### Queue Mode (Minimize/Resume)

1. User clicks "Minimize" on Storyboard → `updateSession(id, { isMinimized: true })` + `navigate('/')`
2. `GenTaskBar` renders at bottom of `AppLayout` for all minimized sessions
3. User clicks "Resume" → `updateSession(id, { isMinimized: false })` + `navigate('/storyboard?id=ID')`
4. On Storyboard mount: video polling auto-restarts for any `videoStatus: 'generating'` assets

---

## 10. Infrastructure & Deployment

### Wrangler Bindings (`wrangler.toml`)

```toml
name = "fuzzy-vid-worker"
main = "worker/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

[[r2_buckets]]
binding = "STORY_STORAGE"
bucket_name = "igome-story-storage"

[[kv_namespaces]]
binding = "JOB_STATUS"
id = "fc732a268ca9435b8de8e50f34a35365"

[assets]
binding = "ASSETS"
not_found_handling = "single-page-application"   # SPA fallback
```

### Wrangler Secrets

| Secret | Status | Usage |
|---|---|---|
| `GEMINI_API_KEY` | set | Gemini Brain (currently unused, API down) |
| `AWS_SECRET_ACCESS_KEY` | set | Bedrock + Polly auth |
| `ELEVENLABS_API_KEY` | set | ElevenLabs TTS |
| `R2_ACCESS_KEY_ID` | set | R2 S3-compatible API |
| `R2_ACCOUNT_ID` | set | R2 account |
| `R2_SECRET_ACCESS_KEY` | set | R2 S3-compatible API |
| `AWS_ACCESS_KEY_ID` | verify | Bedrock + Polly auth |

### Deploy Commands

```bash
# Deploy Worker
wrangler deploy

# Build + Deploy Frontend (auto-deploys via Cloudflare Pages on push)
npm run build
git add .
git commit -m "feat/fix: description"
git push origin main

# Test worker endpoint
curl -X POST https://fuzzy-vid-worker.officialdian21.workers.dev/api/brain/generate \
  -H "Content-Type: application/json" \
  -H "X-AWS-Access-Key-Id: YOUR_KEY" \
  -H "X-AWS-Secret-Access-Key: YOUR_SECRET" \
  -H "X-Brain-Region: us-east-1" \
  -d '{"title":"test","story":"test story","platform":"youtube_shorts","brain_model":"claude_sonnet","language":"id","art_style":"cinematic_realistic","total_scenes":3,"total_duration":30}'

# Verify build before commit
npm run build 2>&1 | tail -20
```

### Regional Strategy

| Service | Region | Rationale |
|---|---|---|
| Bedrock Brain (Claude/Llama) | `us-east-1` default | User-configurable |
| Bedrock Image (Nova Canvas / Titan V2) | `us-east-1` default | User-configurable |
| Nova Reel Video | `us-east-1` **fixed** | Only region with Nova Reel |
| Polly Audio | `us-west-2` default | User-configurable |
| R2 | `auto` | Cloudflare-managed |

---

## 11. Cost Estimates

| Service | Model | Rate | Notes |
|---|---|---|---|
| Brain | Claude Sonnet 4.6 | $0.003/1K input + $0.015/1K output | ~$0.005–0.01 per storyboard |
| Brain | Llama 4 Maverick | ~$0.0002/1K tokens | Very cheap |
| Brain | Gemini | Free (tier) | Currently API down |
| Image | Nova Canvas | ~$0.04 per image | Per scene |
| Image | Titan V2 | ~$0.008 per image | Cheaper but smaller resolution options |
| Video | Nova Reel | ~$0.80 per 6s clip | Main cost driver |
| Audio | Polly (neural) | $0.004/1K chars | Very cheap |
| Audio | Polly (generative) | Higher | Ruth, Danielle voices |
| Audio | ElevenLabs | $0.18/1K chars | High quality |

Typical 5-scene production cost estimate:
- Brain: ~$0.01
- Images (Nova Canvas × 5): ~$0.20
- Videos (Nova Reel × 5): ~$4.00
- Audio (Polly × 5): ~$0.02
- **Total: ~$4.23 per video**
