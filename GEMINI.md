# Fuzzy Short — Gemini CLI Project Instructions

# Version 3.8 — Updated March 2026

# READ THIS COMPLETELY before starting any task

-----

## PROJECT OVERVIEW

Fuzzy Short is a mobile-first web app for AI-powered short video storyboard generation.
Users input a story idea → AI generates storyboard → generate image/video/audio per scene.

Live URL: https://fuzzystuf.pages.dev
Worker URL: https://fuzzy-vid-worker.officialdian21.workers.dev
Repo: ~/Fuzzy-vid

-----

## TECH STACK

Frontend:  React + TypeScript + Vite → Cloudflare Pages
Backend:   Cloudflare Worker (TypeScript)
Storage:   Cloudflare R2 → bucket: igome-story-storage
Brain AI:  AWS Bedrock (Claude Sonnet 4.6, Llama 4) +
           Dashscope SG (Qwen3-Max, Qwen-Plus, Qwen-Flash, QwQ-Plus) +
           Google Gemini (2.0 Flash, 2.5 Pro) +
           Groq (Llama 3.3 70B, Llama 3.1 8B, Gemma 2 9B, Mixtral 8x7B) +
           OpenRouter (DeepSeek R1/V3, Gemma 3, Llama 3.3, Mistral 7B) +
           ZhipuAI GLM (glm-4-flash, glm-4-flash-250414, glm-z1-flash, glm-4.6v)
Image AI:  AWS Bedrock (Nova Canvas, SD 3.5) + Dashscope (Wanx)
Video AI:  AWS Bedrock Nova Reel (async) + Dashscope Wan2.1 (async)
Audio:     AWS Polly + ElevenLabs

-----

## FILE STRUCTURE

src/
  pages/
    Home.tsx           <- story input form, provider pill + dropdown brain selector
    Storyboard.tsx     <- per-scene cards, image/video/audio gen, Gen All Veo button
    Settings.tsx       <- API keys (6 providers), test buttons, checkmark indicators
    Dashboard.tsx      <- storyboard list, credits badge, tone pills
  lib/
    api.ts             <- all Worker fetch calls; exports WORKER_URL, getApiHeaders()
    providerModels.ts  <- 29 brain models x 6 providers; getModelsByProvider/getModelById/hasRequiredKey
  types/
    schema.ts          <- AppSettings, VideoJob, SceneAssets, buildApiHeaders()
  components/
    VeoPromptSection.tsx <- per-scene Veo 3.1 prompt UI, sub-tone selector, copy/regen

worker/
  index.ts                        <- route handler, extractCredentials(), CORS headers
  brain.ts                        <- storyboard gen (Bedrock), buildBrainSystemPrompt/UserPrompt()
  image.ts                        <- Nova Canvas + SD 3.5 (Bedrock)
  video.ts                        <- Nova Reel async polling (Bedrock)
  audio.ts                        <- AWS Polly
  dashscope.ts                    <- ALL Qwen/Wanx/Wan2.1 (Dashscope Singapore)
  handlers/
    brain-provider.ts             <- /api/brain/provider — universal OpenAI-compat handler
    regenerate-veo-prompt.ts      <- /api/brain/regenerate-veo-prompt — per-scene Veo gen
  lib/
    aws-signature.ts              <- HMAC SigV4 signing — CRITICAL RULE below
    providers.ts                  <- provider registry, callProvider(), getProviderForModel()
    brain-system-prompt.ts        <- buildBrainSystemPrompt() + buildBrainUserPrompt() (8 tones)
    veo-subtones.ts               <- VEO_SUBTONES (8 sub-tones), TONE_TO_SUBTONES, isVeoTone()

-----

## CRITICAL — AWS SIGNATURE RULE (NEVER SKIP)

The #1 bug in this project. AWS SigV4 requires ":" to be encoded as "%3A"
in the canonical URI — NOT a literal colon.

ALWAYS use this exact function in aws-signature.ts:

```typescript
function buildCanonicalUri(rawUrl: string): string {
  const pathname = new URL(rawUrl).pathname
  return pathname
    .split('/')
    .map(segment => {
      let decoded: string
      try { decoded = decodeURIComponent(segment) }
      catch { decoded = segment }
      // CORRECT — ":" must be "%3A" in canonical URI (AWS SigV4 requirement)
      return encodeURIComponent(decoded)
      // NEVER add .replace(/%3A/gi, ':') — this was the old bug that caused Nova Canvas failures
    })
    .join('/')
}
```

signRequest MUST call buildCanonicalUri(url) — NEVER use url.pathname directly.

Same rule applies in video.ts: ARN path must use encodeURIComponent(arn) WITHOUT
.replace(/%3A/gi, ':') — literal colons cause UnknownOperationException on GetAsyncInvoke.

Test before deploying:

```bash
node -e "
function b(u){const p=new URL(u).pathname;return p.split('/').map(s=>{let d;try{d=decodeURIComponent(s)}catch{d=s};return encodeURIComponent(d)}).join('/')}
console.log(b('https://bedrock-runtime.us-east-1.amazonaws.com/model/amazon.nova-canvas-v1%3A0/invoke'))
// MUST print: /model/amazon.nova-canvas-v1%3A0/invoke  ('%3A' encoded, NOT literal colon)
"
```

-----

## VALID MODEL IDs (verified — do not guess or use others)

### AWS Bedrock — Brain (route: /api/brain/generate)

us.anthropic.claude-sonnet-4-6           <- primary brain, best quality
us.anthropic.claude-haiku-4-5-20251001   <- fast/cheap tasks
us.meta.llama4-maverick-17b-instruct-v1:0

### AWS Bedrock — Image

nova_canvas -> amazon.nova-canvas-v1:0 -> us-east-1
sd35        -> stability.sd3-5-large-v1:0 -> us-west-2 ONLY

REMOVED: amazon.titan-image-generator-v2:0 (deprecated)

### AWS Bedrock — Video

nova_reel -> amazon.nova-reel-v1:0 -> us-east-1 ONLY, async 2-6s

### Dashscope Singapore — Brain (route: /api/dashscope/brain)

qwen3-max    <- best quality + reasoning
qwen-plus    <- balanced, recommended
qwen-flash   <- fast
qwq-plus     <- deep reasoning
qwen-turbo   <- cheapest

### Dashscope Singapore — Image (ALL async)

qwen-image-2.0-pro  <- best quality, standard format: input: { prompt }
qwen-image-2.0      <- balanced, standard format: input: { prompt }
wan2.6-image        <- messages[] format: input: { messages: [{role:'user', content:[{text:prompt}]}] }
wanx2.1-t2i-turbo   <- fast (legacy), standard format: input: { prompt }

REMOVED: wanx-v1 (DOES NOT EXIST on dashscope-intl), wanx2.1-t2i-plus (replaced by qwen-image-2.0-pro)

### Dashscope Singapore — Video (ALL async)

wan2.1-i2v-plus, wan2.1-i2v-turbo  <- image->video
wan2.1-t2v-plus, wan2.1-t2v-turbo  <- text->video

### Google Gemini (route: /api/brain/provider, header: X-Gemini-Api-Key)

gemini-2.0-flash           <- default brain model (FREE, fast, env fallback)
gemini-2.0-flash-lite      <- faster/cheaper
gemini-1.5-flash           <- reliable JSON output
gemini-2.5-pro-exp-03-25   <- best reasoning (slow)

Note: Gemini falls back to env GEMINI_API_KEY if no user key supplied. Always unlocked.

### Groq (route: /api/brain/provider, header: X-Groq-Api-Key)

llama-3.3-70b-versatile    <- best brain quality on Groq (FREE)
llama-3.1-8b-instant       <- ultra-fast rewrite tasks (FREE)
gemma2-9b-it               <- Google Gemma via Groq (FREE)
mixtral-8x7b-32768         <- multilingual, large context (FREE)
Rate limit: 30 req/min free tier

### OpenRouter (route: /api/brain/provider, header: X-Openrouter-Api-Key)

google/gemma-3-27b-it:free             <- best JSON output (FREE)
meta-llama/llama-3.3-70b-instruct:free <- large + capable (FREE)
deepseek/deepseek-r1:free              <- deep reasoning (FREE, slow)
deepseek/deepseek-v3-0324:free         <- creative + brain (FREE)
mistralai/mistral-7b-instruct:free     <- fast (FREE)
google/gemini-2.0-flash-exp:free       <- Gemini via OpenRouter (FREE)

### ZhipuAI GLM (route: /api/brain/provider, header: X-Glm-Api-Key)

glm-4-flash         <- unlimited free, multilingual (FREE)
glm-4-flash-250414  <- newer dated version, good JSON output (FREE)
glm-z1-flash        <- reasoning variant, may output <think> blocks (FREE)
glm-4.6v            <- latest GLM model, fast + multilingual (FREE)  [added v3.8]

Note: Reasoning models (glm-z1-flash, deepseek-r1) output <think>...</think> blocks
before JSON. Both brain-provider.ts and regenerate-veo-prompt.ts strip these automatically.

-----

## DASHSCOPE API RULES

Base URL: https://dashscope-intl.aliyuncs.com
Auth: Authorization: Bearer YOUR_KEY  (no AWS signing needed)
Region: Singapore (auto — no region param)

Brain:
POST /compatible-mode/v1/chat/completions
Body: { model, messages: [{role, content}], max_tokens }

Image (wanx2.1 / qwen-image models):
POST /api/v1/services/aigc/text2image/image-synthesis
Header: X-DashScope-Async: enable
Body: { model, input: { prompt }, parameters: { size, n, negative_prompt, watermark: false } }

Image (wan2.6-image ONLY — different format!):
POST /api/v1/services/aigc/text2image/image-synthesis
Header: X-DashScope-Async: enable
Body: { model, input: { messages: [{ role:'user', content:[{text: prompt}] }] }, parameters: {...} }

Video (i2v — image to video):
POST /api/v1/services/aigc/video-generation/video-synthesis
Header: X-DashScope-Async: enable
Body: { model, input: { prompt, img_url: imageUrl }, parameters: { size, duration } }

Video (t2v — text to video):
POST /api/v1/services/aigc/video-generation/video-synthesis
Body: { model, input: { prompt }, parameters: { size, duration } }
NEVER send img_url for t2v models

Poll (shared for image + video):
GET /api/v1/tasks/{task_id}
Statuses: PENDING | RUNNING | SUCCEEDED | FAILED
SUCCEEDED: results[0].url (image) or video_url (video)
URLs expire in 24h — always re-upload to R2!

Size format uses * separator (NOT x):
9:16  -> 768*1280
16:9  -> 1280*768
1:1   -> 1024*1024
4:5   -> 864*1080

-----

## WORKER ROUTES

GET  /api/health
POST /api/brain/generate                   <- AWS Bedrock brain (requireAwsKeys)
POST /api/brain/provider                   <- Groq/OpenRouter/GLM/Gemini brain (no AWS key needed)
POST /api/brain/rewrite-vo                 <- rewrite VO for duration (requireAwsKeys)
POST /api/brain/regenerate-veo-prompt      <- Veo 3.1 per-scene prompt (all providers, no AWS guard)
POST /api/brain/regenerate-video-prompt    <- regen video_prompt (requireAwsKeys)
POST /api/image/generate                   <- Nova Canvas or SD 3.5 (requireAwsKeys)
POST /api/image/enhance-prompt             <- enhance prompt via Claude (requireAwsKeys)
POST /api/video/start                      <- Nova Reel async (requireAwsKeys)
GET  /api/video/status/:jobId              <- Nova Reel poll
POST /api/audio/generate                   <- AWS Polly (requireAwsKeys)
POST /api/dashscope/brain                  <- Qwen brain (requireDashscopeKey)
POST /api/dashscope/image/start            <- Wanx image async (requireDashscopeKey)
POST /api/dashscope/video/start            <- Wan2.1 video async (requireDashscopeKey)
GET  /api/dashscope/task/:taskId           <- poll image/video (no key guard)

GET  /api/user/profile                     <- auth required (Clerk JWT)
PUT  /api/user/profile                     <- auth required
GET  /api/user/keys                        <- get decrypted API keys from D1
POST /api/user/keys                        <- save encrypted API keys to D1
GET  /api/user/usage                       <- credit usage summary
GET  /api/storyboards                      <- list user storyboards
POST /api/storyboards                      <- save/upsert storyboard
GET  /api/storyboards/:id                  <- get single storyboard
DELETE /api/storyboards/:id                <- delete storyboard
POST /api/storyboards/:id/scenes           <- upsert scene asset

Route order in index.ts (CRITICAL — specific routes BEFORE catch-alls):
  /api/brain/provider            (line ~206) — checked BEFORE /api/brain/* catch-all
  /api/brain/regenerate-veo-prompt           — checked BEFORE /api/brain/* catch-all
  /api/brain/rewrite-vo                      — checked BEFORE /api/brain/* catch-all
  /api/brain/regenerate-video-prompt         — checked BEFORE /api/brain/* catch-all
  /api/brain/generate or /api/brain/*        — catch-all with requireAwsKeys guard

/api/brain/provider routing (worker/handlers/brain-provider.ts):
  X-Groq-Api-Key        -> Groq completion API
  X-Openrouter-Api-Key  -> OpenRouter completion API
  X-Glm-Api-Key         -> ZhipuAI GLM API
  X-Gemini-Api-Key      -> Google Gemini API (falls back to env GEMINI_API_KEY)

-----

## REQUEST HEADERS

All headers built from localStorage key: fuzzy_settings_{userId}

AWS Bedrock:
  X-AWS-Access-Key-Id       <- settings.awsAccessKeyId
  X-AWS-Secret-Access-Key   <- settings.awsSecretAccessKey
  X-Brain-Region            <- settings.brainRegion (default: us-east-1)
  X-Image-Region            <- settings.imageRegion (default: us-east-1)

Dashscope:  X-Dashscope-Api-Key   <- settings.dashscopeApiKey
Gemini:     X-Gemini-Api-Key      <- settings.geminiApiKey  [standardized v3.8, was X-Gemini-Key]
Groq:       X-Groq-Api-Key        <- settings.groqApiKey
OpenRouter: X-Openrouter-Api-Key  <- settings.openrouterApiKey
GLM:        X-Glm-Api-Key         <- settings.glmApiKey

getApiHeaders(userId?) in src/lib/api.ts builds all headers from localStorage.
Always pass userId from useUser() hook. Never call getApiHeaders() without userId on
authenticated pages.

extractCredentials() in worker/index.ts:
  geminiApiKey: h.get('X-Gemini-Api-Key') || h.get('X-Gemini-Key') || ''
  (reads both headers for backward compatibility — new standard is X-Gemini-Api-Key)

-----

## WORKER SECRETS (wrangler secret put)

# Internal use only (R2 storage — NOT for user generation routes since v3.3)
AWS_ACCESS_KEY_ID       <- R2 ops only — NOT used in extractCredentials for generation
AWS_SECRET_ACCESS_KEY   <- R2 ops only
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_ACCOUNT_ID
R2_BUCKET_NAME          <- igome-story-storage
R2_PUBLIC_URL           <- https://pub-xxx.r2.dev

# Auth
CLERK_SECRET_KEY        <- from clerk.dev dashboard
CLERK_JWKS_URL          <- https://[app-slug].clerk.accounts.dev/.well-known/jwks.json

# Optional provider fallbacks (shared free-tier keys — env fallback OK for these)
GEMINI_API_KEY          <- fallback for Gemini if user supplies no X-Gemini-Api-Key
GROQ_API_KEY            <- fallback for Groq (free tier shared key)
OPENROUTER_API_KEY      <- fallback for OpenRouter
GLM_API_KEY             <- fallback for GLM

# NOT used as fallback (user must supply their own)
DASHSCOPE_API_KEY       <- kept in env but NOT used in generation routes

## AUTH — Clerk

Use DEVELOPMENT keys (pk_test_) for .pages.dev domains.
pk_live_ requires a custom domain — .pages.dev subdomain cannot be created for Clerk.

Dev VITE_CLERK_PUBLISHABLE_KEY starts with pk_test_
Set in .env.local AND Cloudflare Pages -> Settings -> Environment Variables.
CLERK_JWKS_URL must match key's domain: https://[slug].clerk.accounts.dev/.well-known/jwks.json

-----

## UI DESIGN — iOS 26 Liquid Glass

Background: linear-gradient(145deg, #f2f2f7 0%, #e5e5ea 50%, #f2f2f7 100%)

Glass Card:
  background: rgba(255,255,255,0.75)
  backdropFilter: blur(40px) saturate(200%)
  WebkitBackdropFilter: blur(40px) saturate(200%)
  border: 0.5px solid rgba(255,255,255,0.9)
  borderRadius: 22px
  boxShadow: 0 2px 24px rgba(0,0,0,0.07), 0 0 0 0.5px rgba(255,255,255,0.6) inset

Colors:
  Text primary:   #1d1d1f
  Text secondary: rgba(60,60,67,0.6)
  Text tertiary:  rgba(60,60,67,0.3)
  Orange:  #ff6b35 (generate buttons, gradient to #ff4500)
  Blue:    #007aff (video, links, iOS system)
  Green:   #34c759 (success, download, checkmarks)
  Purple:  #af52de (audio)
  Red:     #ff3b30 (error)
  Qwen:    #ff8c00 (Qwen tag badge)

Tag Badges:
  AWS:  bg rgba(0,122,255,0.15), color #007aff
  Qwen: bg rgba(255,140,0,0.15), color #ff8c00

Button (active/generate):
  background: linear-gradient(135deg, #ff6b35, #ff4500)
  borderRadius: 16px
  boxShadow: 0 4px 20px rgba(255,107,53,0.4)
  color: white

-----

## DESKTOP LAYOUT (>= 768px)

Storyboard: 2-column grid
  Left 320px:  scene thumbnail list (click to activate)
  Right flex:  active scene detail scrollable

Home: max-width 600px centered

Responsive hook:
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768)

-----

## VIDEO POLLING

Both Nova Reel + Wan2.1 are async (2-5 min):

1. POST start -> get job_id/task_id
2. Save to localStorage: key = video_job_{projectId}_{sceneNum}
3. Poll every 10s, timeout 10min
4. On done: download asset -> re-upload to R2 -> return public R2 URL

Nova Reel poll: GET /api/video/status/:jobId (encoded ARN in path)
Dashscope poll: GET /api/dashscope/task/:taskId

-----

## VO DURATION CONSTRAINT

Indonesian: ~15 chars/sec | English: ~18 chars/sec
charLimit = Math.floor(durationSeconds * charsPerSecond)
Brain prompt includes "Max narration: X characters for Y second scene".
POST /api/brain/rewrite-vo -> { rewritten_text, char_count, char_limit, fits }

-----

## LIGHTBOX IMAGE VIEWER

Tap image -> fixed overlay modal (rgba(0,0,0,0.92))
Close X top-right, scene label top-left, download bottom-center.
img: max-width 100%, max-height 90vh, borderRadius 16px.

-----

## BRAIN MODEL SELECTOR (v3.7 — redesigned)

Home.tsx uses a provider pill row + model dropdown (redesigned from chip grid in v3.7).

Structure:
  1. Scrollable provider pill row (aws / dashscope / gemini / groq / openrouter / glm)
  2. <select> dropdown showing only models for the active provider
  3. Info bar below showing: emoji, providerLabel, speedLabel, bestFor[]

Key constants (module-level, outside component):
  PROVIDER_ORDER = ['aws', 'dashscope', 'gemini', 'groq', 'openrouter', 'glm']
  PROVIDER_META: Record<string, { emoji, color, label }> — per-provider display config
  MODEL_GROUPS = getModelsByProvider() — computed once on module load

Component state:
  brainModel: string (default 'gemini-2.0-flash') — changed from union type to plain string v3.7
  userSettings: Record<string, string> — loaded from localStorage in useEffect on user?.id change

Provider pill behavior:
  - Active provider = getModelById(brainModel)?.provider
  - Click provider pill -> handleProviderChange(pid) -> auto-selects first model with a valid key
  - Provider shows "No key" badge (red) if no API key set for that provider
  - Gemini: always available (env GEMINI_API_KEY fallback)

handleSubmit routing:
  getModelById(brainModel) -> selectedModelDef
  modelProvider = selectedModelDef?.provider || 'gemini'
  aws       -> WORKER_URL + /api/brain/generate
  dashscope -> WORKER_URL + /api/dashscope/brain
  all else  -> WORKER_URL + /api/brain/provider

Validation before fetch (returns early with error if key missing):
  aws        -> requires X-AWS-Access-Key-Id
  dashscope  -> requires X-Dashscope-Api-Key
  groq       -> requires X-Groq-Api-Key
  openrouter -> requires X-Openrouter-Api-Key
  glm        -> requires X-Glm-Api-Key
  gemini     -> no validation (env fallback exists)

-----

## /api/brain/provider HANDLER DETAIL (v3.8)

File: worker/handlers/brain-provider.ts

Two modes based on request body:

MODE A — Storyboard generation (body.story is set, body.system_prompt is NOT):
  - Builds system/user prompts internally via buildBrainSystemPrompt() + buildBrainUserPrompt()
  - Calls callProvider() to get AI response string
  - Strips <think>...</think> reasoning blocks (for GLM-Z1, DeepSeek R1)
  - Strips markdown fences (```json / ```)
  - Parses the cleaned string as JSON
  - Returns the storyboard JSON DIRECTLY (same format as /api/brain/generate)
  - Frontend (Home.tsx, Storyboard.tsx) can find scenes at data.scenes

MODE B — Raw prompt mode (body.system_prompt is set):
  - Uses body.system_prompt + body.user_prompt directly
  - Returns { content: string, provider: string, model: string }
  - Used by: Settings test buttons, custom prompt calls

This distinction is CRITICAL. Before v3.8, the handler always returned { content: "..." }
which caused GLM/Groq/OpenRouter storyboards to arrive at Storyboard.tsx with no scenes,
triggering navigate('/') — the "generates then forces back to home" bug.

JSON stripping logic (both modes where applicable):
  const clean = content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')  // reasoning model output
    .replace(/```json|```/g, '')                 // markdown fences
    .trim()

-----

## VEO 3.1 PROMPT ENGINE (v3.6 — updated v3.8)

Veo 3.1 prompts are generated per-scene for Veo-compatible tones.

Veo-compatible tones (isVeoTone() returns true):
  documentary_viral, natural_genz, informative, narrative_storytelling

8 sub-tones (worker/lib/veo-subtones.ts):
  human_story, field_report, day_in_life, social_experiment,
  product_moment, local_hero, ambient_scene, expert_insight

VeoPromptSection component (src/components/VeoPromptSection.tsx):
  Props: sceneNumber, veoPrompt, voScript, imagePrompt, tone, platform, brainModel, apiHeaders, onUpdate
  - apiHeaders: passed from Storyboard.tsx as getApiHeaders(user?.id) — includes all provider keys
  - brainModel: uses storyboard.brain_model (NOT hardcoded 'gemini-2.0-flash' since v3.8 fix)
  - WORKER_URL: imported from '../lib/api' (NOT from import.meta.env.VITE_WORKER_URL)

Per-scene regeneration:
  POST /api/brain/regenerate-veo-prompt
  Body: { scene_number, vo_script, image_prompt, tone, sub_tone, platform, brain_model }
  Handler reads user key from request headers (same pattern as brain-provider.ts)
  Strips <think> blocks before JSON parse (supports reasoning models)
  Returns: { veo_prompt: { sub_tone, camera_locked, camera_instruction, starting_frame,
                           temporal_action, physics_detail, human_element, full_veo_prompt } }

"Gen All Veo" button (added v3.8):
  Location: Storyboard.tsx header, next to "Export Veo" button
  Visible only when isVeoTone(storyboard.tone) === true
  Function: handleGenerateAllVeo()
    - Iterates all scenes sequentially
    - Uses storyboard.brain_model + getApiHeaders(user?.id)
    - Calls /api/brain/regenerate-veo-prompt for each scene
    - Updates store + saves to D1 via saveSceneAsset()
    - Shows toast: "Veo prompts generated for N/total scenes"
  State: generatingAllVeo: boolean (disables button + shows "Generating..." label)

-----

## TONE SYSTEM (v3.7)

8 content tones selectable in Home.tsx:

| ID                     | Emoji | Description                       | Veo |
|------------------------|-------|-----------------------------------|-----|
| narrative_storytelling | ?     | Story arc with emotional beats    | yes |
| documentary_viral      | ?     | Journalistic + trend-focused      | yes |
| natural_genz           | ?     | Casual, relatable, authentic      | yes |
| informative            | ?     | Factual, clear, structured        | yes |
| product_ads            | ?     | Benefit-focused with CTA          | no  |
| educational            | ?     | Step-by-step explanation          | no  |
| entertainment          | ?     | Fun, energetic, surprising        | no  |
| motivational           | ?     | Empowering and uplifting          | no  |

Tone colors used in Dashboard badges and VeoPromptSection:
  documentary_viral      #ff3b30
  natural_genz           #007aff
  informative            #5856d6
  narrative_storytelling #ff6b35
  product_ads            #34c759
  educational            #af52de
  entertainment          #ffcc00
  motivational           #ff9500

-----

## SETTINGS PAGE (v3.7)

SecretInput component:
  - Green border (rgba(52,199,89,0.4)) when field has a saved value
  - Green checkmark "checkmark" at right: 38px when non-empty
  - Eye toggle show/hide at right: 12px
  - paddingRight: value ? '60px' : '44px'

WORKER_URL:
  Imported from src/lib/api.ts (never defined locally in Settings.tsx)
  Line added: import { WORKER_URL } from '../lib/api'

Test button sections (each has TestButton + StatusMsg + rate limit info):

  Gemini:
    testGemini() -> POST /api/brain/provider
    Header: X-Gemini-Api-Key: settings.geminiApiKey
    Body: { brain_model: 'gemini-2.0-flash', system_prompt: ..., user_prompt: 'Reply with: {"ok":true}', max_tokens: 20 }
    Success: res.ok && data.content

  Groq:
    testGroq() -> POST /api/brain/provider
    Header: X-Groq-Api-Key: settings.groqApiKey
    Body: { brain_model: 'llama-3.1-8b-instant', ... }
    Rate info: "30 req/min free tier"

  OpenRouter:
    testOpenRouter() -> POST /api/brain/provider
    Header: X-Openrouter-Api-Key: settings.openrouterApiKey
    Body: { brain_model: 'google/gemma-3-27b-it:free', ... }
    Rate info: "Free models available"

  GLM:
    testGLM() -> POST /api/brain/provider
    Header: X-Glm-Api-Key: settings.glmApiKey
    Body: { brain_model: 'glm-4-flash', ... }
    Rate info: "Unlimited free tier"

All test functions use MODE B (system_prompt set) so response is { content, provider, model }.
Success check: res.ok && data.content (truthy string returned).

-----

## DASHBOARD PAGE (v3.7)

StoryboardRow interface: includes tone?: string

Tone badge renders before platform badge in each card:
  Condition: board.tone && TONE_BADGES[board.tone]
  Style: bg = TONE_BADGES[tone].color + '15', border = color + '30'
  Text: "{emoji} {tone.replace(/_/g, ' ')}"

TONE_BADGES constant: defined at module level (same 8 tones as Home.tsx)

-----

## DEPLOYMENT

npm run build          <- must show 0 TypeScript errors (npx tsc --noEmit first)
wrangler deploy        <- deploy Worker (takes ~10s)
git push origin main   <- triggers Cloudflare Pages auto-deploy (~1-2 min)
wrangler tail          <- live Worker logs for debugging

After deploy, hard-refresh browser (Cmd+Shift+R / Ctrl+F5) to bypass CDN cache.

-----

## CODING RULES

1.  TypeScript strict — run npx tsc --noEmit, fix ALL errors before deploy
2.  ALWAYS use buildCanonicalUri() — never url.pathname directly
3.  buildCanonicalUri: encodeURIComponent(decoded) ONLY — NO .replace(/%3A/gi, ':')
4.  NEVER send img_url to Dashscope t2i or t2v models
5.  NEVER use invalid model IDs — verify against list above
6.  NEVER hardcode API keys — use wrangler secrets or localStorage
7.  wan2.6-image uses messages[] format in input — not input.prompt
8.  Dashscope size: use * not x (768*1280 not 768x1280)
9.  Dashscope URLs expire 24h — always re-upload to R2
10. Nova Reel: us-east-1 ONLY | SD 3.5: us-west-2 ONLY
11. After every change: npm run build -> 0 errors required before deploy
12. video_prompt.full_prompt max 200 chars — starts with camera movement
13. video.ts ARN path: encodeURIComponent(arn) WITHOUT .replace — colons must be %3A
14. NEVER use env.AWS_ACCESS_KEY_ID as fallback in extractCredentials
15. All Bedrock/Dashscope generation routes must call requireAwsKeys/requireDashscopeKey
16. localStorage per user: key = fuzzy_settings_{userId} NOT 'fuzzy_short_settings'
17. getApiHeaders(userId?) — always pass userId from useUser() hook
18. WORKER_URL is exported from src/lib/api.ts — import it, never hardcode inline
19. brainModel state is string (not union type) since v3.7 — default 'gemini-2.0-flash'
20. Brain routing: aws->/api/brain/generate, dashscope->/api/dashscope/brain, else->/api/brain/provider
21. Gemini header is X-Gemini-Api-Key (not X-Gemini-Key) — standardized v3.8
22. brain-provider.ts MODE A (body.story) returns JSON directly — NOT { content: "..." }
23. Strip <think>...</think> from reasoning model outputs before JSON.parse
24. VeoPromptSection must receive apiHeaders prop from getApiHeaders(user?.id)
25. hasRequiredKey(model, userSettings) from providerModels.ts — use for UI key gating

-----

## COMMON ERRORS & FIXES

"signature does not match" / canonical URI mismatch
-> aws-signature.ts: buildCanonicalUri must use encodeURIComponent(decoded) WITHOUT .replace(/%3A/gi, ':')
-> ":" MUST be "%3A" in canonical URI — the .replace was the old bug

Nova Reel "UnknownOperationException"
-> video.ts ARN path: use encodeURIComponent(arn) WITHOUT .replace(/%3A/gi, ':')
-> Literal colons in URL path break AWS routing to GetAsyncInvoke

"Model not exist" (Dashscope)
-> Wrong model ID. Check valid list above. wanx-v1 does not exist on dashscope-intl.
-> wanx2.1-t2i-plus removed — use qwen-image-2.0-pro instead

"url error, please check url" (Dashscope image)
-> Remove img_url from t2i requests. Only i2v needs img_url.

"InvalidParameter" from Dashscope wan2.6
-> Use messages[] format: input: { messages: [{role:'user', content:[{text:prompt}]}] }

"AWS credentials required" (401 from Worker)
-> User must provide AWS keys in Settings for Bedrock routes.
-> Worker no longer falls back to env.AWS_ACCESS_KEY_ID since v3.3.
-> If using Gemini/Groq/GLM/OpenRouter, ensure routing hits /api/brain/provider not /api/brain/generate.
-> Check: getModelById(brainModel)?.provider must return 'gemini'/'groq'/'glm'/'openrouter'

Storyboard generates but immediately redirects back to homepage (GLM/Groq/OpenRouter)
-> brain-provider.ts was returning { content: "..." } instead of JSON directly.
-> Fixed in v3.8: MODE A (body.story set) now parses and returns storyboard JSON directly.
-> Storyboard.tsx line 338: navigate('/') fires when data.scenes is missing or empty.

Veo 3.1 prompt generation fails or returns garbled JSON
-> For reasoning models (glm-z1-flash, deepseek-r1): <think> blocks before JSON break JSON.parse.
-> Fixed in v3.8: regenerate-veo-prompt.ts strips <think>...</think> before parsing.
-> Ensure apiHeaders is passed to VeoPromptSection (includes X-Glm-Api-Key etc.)

VeoPromptSection shows no response / fetch fails silently
-> Old bug: WORKER_URL was import.meta.env.VITE_WORKER_URL (undefined). Fixed: import { WORKER_URL } from '../lib/api'
-> Ensure brainModel prop is storyboard.brain_model (not hardcoded 'gemini-2.0-flash')

Gemini key shows "AWS credentials required" in Settings test
-> Old testGemini() was calling /api/brain/generate (Bedrock route). Fixed in ea4a629.
-> Now calls /api/brain/provider with X-Gemini-Api-Key header.

Header name mismatch (Gemini key not forwarded)
-> Home.tsx was sending X-Gemini-Key (old), brain-provider.ts expected X-Gemini-Api-Key.
-> Fixed in 0bd0f94: all frontend code now sends X-Gemini-Api-Key.
-> Worker extractCredentials accepts both for backward compat: X-Gemini-Api-Key || X-Gemini-Key

"Clerk: Failed to load Clerk" / failed_to_load_clerk_js
-> Use pk_test_ keys for .pages.dev deployments (pk_live_ needs a real custom domain).
-> CLERK_JWKS_URL must match key's domain.

AWSCompromisedKeyQuarantineV3
-> AWS IAM Console -> Users -> Xklaa-pmpt -> Permissions -> Detach quarantine policy
-> Create new key. Never share keys in chat/screenshots.

-----

## CHANGELOG

### v3.8 (2026-03-07) — Bug Fixes + GLM-4.6V + Gen All Veo

Commits: 0bd0f94, 03ed7e4, 96c6870

#### Fix 1 — Gemini header standardized (0bd0f94)

Problem: Home.tsx and schema.ts buildApiHeaders() sent X-Gemini-Key (legacy name).
api.ts and Settings.tsx sent X-Gemini-Api-Key (standard name). Mixed headers caused
confusion even though brain-provider.ts had a fallback for both.

Fix:
  src/pages/Home.tsx line 176:   X-Gemini-Key -> X-Gemini-Api-Key
  src/types/schema.ts line 334:  buildApiHeaders() X-Gemini-Key -> X-Gemini-Api-Key
  worker/index.ts line 85:       extractCredentials now reads both:
    geminiApiKey: h.get('X-Gemini-Api-Key') || h.get('X-Gemini-Key') || ''

All code now consistently uses X-Gemini-Api-Key. Legacy X-Gemini-Key still accepted
in the worker for any cached/old frontend versions.

#### Fix 2 — GLM/all providers storyboard forced back to homepage (03ed7e4)

Problem: brain-provider.ts ALWAYS returned { content: "...json string...", provider, model }.
When Home.tsx received this, it stored it as the session rawJson. When Storyboard.tsx
loaded the session, it parsed rawJson, found no .scenes property at the top level,
and called navigate('/') — sending the user back to the homepage with no storyboard shown.
Affected: ALL non-AWS/Dashscope providers (GLM, Groq, OpenRouter, Gemini via /api/brain/provider).

Fix: brain-provider.ts now has two modes:
  MODE A (body.story set, body.system_prompt not set) — storyboard generation:
    Strips <think> blocks + markdown fences, parses content as JSON, returns JSON directly.
    Response format now matches /api/brain/generate (Bedrock) — scenes at top level.
  MODE B (body.system_prompt set) — raw prompt:
    Returns { content, provider, model } as before.
    Used by: Settings test buttons (they set system_prompt explicitly).

Code change in brain-provider.ts:
  if (body.story && !body.system_prompt) {
    const clean = content
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/```json|```/g, '')
      .trim()
    const storyboardData = JSON.parse(clean)
    return Response.json(storyboardData, { headers: corsHeaders })
  }
  return Response.json({ content, provider: provider.id, model: brain_model }, { headers: corsHeaders })

#### Fix 3 — Veo 3.1 reasoning model output breaks JSON parse (03ed7e4)

Problem: GLM-Z1-Flash (reasoning model) outputs <think>...</think> blocks before
the actual JSON response. The existing code only stripped markdown fences (```json),
so JSON.parse() would receive the think block text and throw a SyntaxError.

Fix: regenerate-veo-prompt.ts now strips think blocks before parsing:
  const clean = content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json|```/g, '')
    .trim()

#### Fix 4 — "Gen All Veo" button added (03ed7e4)

Added handleGenerateAllVeo() function and "Gen All Veo" button in Storyboard.tsx header.
Visible only on Veo-compatible tones. Uses storyboard.brain_model + getApiHeaders(user?.id).
Iterates all scenes sequentially, generates Veo prompts, saves to store + D1.
State: generatingAllVeo: boolean (button disabled + shows "Generating..." while running).

#### Feature — GLM-4.6V model added (96c6870)

Added glm-4.6v (GLM-4.6V) to both:
  worker/lib/providers.ts  — provider registry (GLM section)
  src/lib/providerModels.ts — frontend model list (GLM section)

Model auto-detected under GLM provider via startsWith('glm') in getProviderForModel().
Model properties: free: true, speed: 'fast', bestFor: ['brain', 'multilingual', 'json']

-----

### v3.7 (2026-03-07) — Multi-Provider Brain + UI Redesign

Commits: 6e8a77b, 69e1484, 72b94b9, ea4a629

Files changed:
  src/pages/Home.tsx      <- 6-provider routing, provider pill+dropdown selector, userSettings state
  src/pages/Settings.tsx  <- SecretInput checkmark, Groq/OR/GLM test buttons, WORKER_URL import
  src/pages/Dashboard.tsx <- tone?: string field, TONE_BADGES, tone pill in card
  src/lib/providerModels.ts <- created: 28 models x 6 providers
  CLAUDE.md, GEMINI.md    <- v3.7 documentation

Brain selector redesigned (69e1484):
  Initial design was chip grid per model. Redesigned to provider pill row + model <select> dropdown.
  Simpler UX, less visual clutter, easier to scan available models per provider.

Bug fix — testGemini wrong endpoint (ea4a629):
  Old: POST /api/brain/generate with brain_model:'gemini' -> hit requireAwsKeys -> "AWS credentials required"
  New: POST /api/brain/provider with brain_model:'gemini-2.0-flash' + X-Gemini-Api-Key

Bug fix — VeoPromptSection WORKER_URL undefined (ea4a629):
  VITE_WORKER_URL env variable not set -> resolved to undefined at runtime.
  Fixed: import { WORKER_URL } from '../lib/api'

Bug fix — Veo prompt generation ignoring user API keys (ea4a629):
  regenerate-veo-prompt.ts only called getProviderApiKey(env) (env secrets only).
  VeoPromptSection sent no auth headers at all.
  Fixed: handler reads user headers first (same pattern as brain-provider.ts).
  Fixed: Storyboard.tsx passes apiHeaders={getApiHeaders(user?.id)} to VeoPromptSection.
  Fixed: Storyboard.tsx passes brainModel={storyboard.brain_model} (not hardcoded).

Worker deployed: 2026-03-07

-----

### v3.6 (2026-03) — Veo 3.1 Prompt Engine

Commits: 353802e

Added:
  worker/lib/veo-subtones.ts      <- 8 sub-tones, TONE_TO_SUBTONES, isVeoTone(), getDefaultSubTone()
  src/components/VeoPromptSection.tsx <- collapsible Veo prompt UI per scene
  worker/handlers/regenerate-veo-prompt.ts <- /api/brain/regenerate-veo-prompt handler
  src/lib/veoSubtones.ts          <- frontend mirror of veo-subtones

Brain system prompt updated to generate veo_prompt field per scene for Veo tones.
VeoPromptSection shows in scene cards when isVeoTone(storyboard.tone) is true.

-----

### v3.5 (2026-03) — Brain System Prompt Rebuild

Commits: 10ffdb1

Added:
  worker/lib/brain-system-prompt.ts  <- buildBrainSystemPrompt() + buildBrainUserPrompt() (8 tones)
  worker/handlers/brain-provider.ts  <- universal /api/brain/provider route handler

Tone system introduced: 8 tones with distinct VO style, pacing, scene structure.
brain-provider.ts supports Option A (raw prompts) and Option B (story params) modes.

-----

### v3.4 (2026-03) — Multi-Provider Foundation

Commits: ad8ab7f

Added:
  src/lib/providerModels.ts  <- 28 models, 6 providers, getModelsByProvider/getModelById/hasRequiredKey
  worker/lib/providers.ts    <- PROVIDERS registry, callProvider(), getProviderForModel()

Groq, OpenRouter, GLM, Gemini all wired to /api/brain/provider.
Worker route /api/brain/provider added in index.ts BEFORE /api/brain/* catch-all.

-----

### v3.3 (2026-03) — Security Fix

Commits: d817858

Block Worker key fallback: env.AWS_ACCESS_KEY_ID no longer used in extractCredentials.
All generation routes now call requireAwsKeys(creds) or requireDashscopeKey(creds).
Clear session on user change. API key warnings added to UI.

-----

## GEMINI CLI USAGE TIPS

When given a task file (.md):
  Read task file -> execute tasks in order -> report after each task

For TypeScript errors:
  npx tsc --noEmit 2>&1 | head -30
  Fix all errors before proceeding to next task

For Worker deployment:
  wrangler deploy 2>&1 | tail -10
  Test with curl before marking task complete:
  curl -s -X POST https://fuzzy-vid-worker.officialdian21.workers.dev/api/brain/provider \
    -H "Content-Type: application/json" \
    -H "X-Gemini-Api-Key: YOUR_KEY" \
    -d '{"brain_model":"gemini-2.0-flash","system_prompt":"You are helpful.","user_prompt":"Reply ok","max_tokens":10}' | python3 -m json.tool

Always commit after all tasks complete:
  git add <specific files> && git commit -m "feat/fix: description" && git push origin main
  Never use git add -A or git add . (risk of committing secrets or large binaries)
