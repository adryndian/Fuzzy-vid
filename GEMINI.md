# Fuzzy Short — Gemini CLI Project Instructions

# Version 4.0 — Updated 2026-03-08

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
Image AI:  AWS Bedrock (Nova Canvas, SD 3.5) + Dashscope (Wanx/Qwen-Image) + ZhipuAI GLM (CogView-3-Flash)
Video AI:  AWS Bedrock Nova Reel (async) + Dashscope Wan2.1/2.6 (async)
Audio:     AWS Polly + ElevenLabs

-----

## FILE STRUCTURE

src/
  pages/
    Home.tsx           <- story input form, provider pill + dropdown brain selector
    Storyboard.tsx     <- per-scene cards, image/video/audio gen, Gen All Veo button, scene nav bar
    Settings.tsx       <- API keys (6 providers), test buttons, checkmark indicators, dark mode
    Dashboard.tsx      <- storyboard list, credits badge, tone pills
  lib/
    api.ts             <- all Worker fetch calls; exports WORKER_URL, getApiHeaders()
    providerModels.ts  <- 29 brain models x 6 providers; getModelsByProvider/getModelById/hasRequiredKey
    theme.tsx          <- ThemeProvider context, useTheme() hook, tk(isDark) token function
  types/
    schema.ts          <- AppSettings, VideoJob, SceneAssets, buildApiHeaders()
  components/
    VeoPromptSection.tsx <- per-scene Veo 3.1 prompt UI, sub-tone selector, copy/regen, JSON copy fix
    BottomNav.tsx        <- 3-tab bottom navigation (Home/Dashboard/Settings), rounded top corners

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

wan2.6-i2v-flash   <- image->video, best quality  [added v3.9]
wanx2.1-i2v-turbo  <- image->video, fast
wan2.6-t2v-flash   <- text->video, best quality   [added v3.9]
wan2.1-t2v-turbo   <- text->video, fast

UPDATED IDs in dashscope.ts QWEN_VIDEO_MODELS (v3.9):
  wan2.6-i2v-flash  (was wan2.1-i2v-plus label)
  wan2.6-t2v-flash  (was wan2.1-t2v-plus label)

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

### ZhipuAI GLM — Image (route: /api/glm/image/generate, provider: glm)

cogview-3-flash  <- FREE, fast image generation (only valid free model)  [confirmed v4.0]

CRITICAL: cogview-4 and cogview-4-flash do NOT exist on ZhipuAI API → "模型不存在" error.
Only cogview-3-flash is valid as a free GLM image model.
cogview-4 (paid) and cogview-4-plus (paid) exist but are NOT integrated.
worker/glm.ts default: body.image_model || 'cogview-3-flash'  (NOT cogview-4)
IMAGE_MODELS in Home.tsx and Storyboard.tsx: only cogview-3-flash listed (cogview-4 removed)

GLM image endpoint: https://open.bigmodel.cn/api/paas/v4/images/generations
Auth: Authorization: Bearer {glmApiKey}
Body: { model: 'cogview-3-flash', prompt: string, size: '1024x1024' | '720x1280' | '1280x720' }
Response: { data: [{ url: string }] } — URL is synchronous (no polling needed)

### Cerebras (route: /api/brain/provider, header: X-Cerebras-Api-Key)

llama-4-scout-17b-16e-instruct  <- fastest inference (2,600 tok/s), free tier
llama-3.3-70b                   <- quality balance, free tier  
qwen-3-32b                      <- multilingual + Indonesian, free tier
Free tier: 1M tokens/day, 30 RPM (requests per minute)

### Mistral AI (route: /api/brain/provider, header: X-Mistral-Api-Key)

mistral-small-latest            <- fast, reliable JSON output (free tier)
open-mistral-nemo               <- free multilingual, large context (free tier)
mistral-large-latest            <- best quality (paid)
Free tier: rate-limited, great for structured output

### SiliconFlow (route: /api/brain/provider, header: X-Siliconflow-Api-Key)

Qwen/Qwen2.5-7B-Instruct        <- free tier model, good for Indonesian
Qwen/Qwen2.5-72B-Instruct       <- high quality, paid
deepseek-ai/DeepSeek-V3         <- creative reasoning, paid
deepseek-ai/DeepSeek-R1         <- deep reasoning (slow), paid
THUDM/glm-4-9b-chat             <- free Chinese/multilingual model
Note: SiliconFlow uses org/model format (Qwen/Qwen2.5-7B-Instruct), not just model names

-----

## DASHSCOPE API RULES

Base URL: https://dashscope-intl.aliyuncs.com
Auth: Authorization: Bearer YOUR_KEY  (no AWS signing needed)
Region: Singapore (auto — no region param)

Brain:
POST /compatible-mode/v1/chat/completions
Body: { model, messages: [{role, content}], max_tokens }

Image (wanx2.1-t2i-turbo — standard format):
POST /api/v1/services/aigc/text2image/image-synthesis
Header: X-DashScope-Async: enable
Body: { model, input: { prompt }, parameters: { size, n, negative_prompt, watermark: false, prompt_extend: true } }

Image (qwen-image-2.0-pro / qwen-image-2.0 — NO prompt_extend, NO watermark!):
POST /api/v1/services/aigc/text2image/image-synthesis
Header: X-DashScope-Async: enable
Body: { model, input: { prompt }, parameters: { size, n, negative_prompt } }
CRITICAL: Do NOT pass prompt_extend (boolean) or watermark to qwen-image models.
These models treat prompt_extend as a URL string field — passing true causes "url error, please check url".

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
CEREBRAS_API_KEY        <- fallback for Cerebras (free tier shared key)
MISTRAL_API_KEY         <- fallback for Mistral (rate-limited free tier)
SILICONFLOW_API_KEY     <- fallback for SiliconFlow

# NOT used as fallback (user must supply their own)
DASHSCOPE_API_KEY       <- kept in env but NOT used in generation routes

## AUTH — Clerk

Use DEVELOPMENT keys (pk_test_) for .pages.dev domains.
pk_live_ requires a custom domain — .pages.dev subdomain cannot be created for Clerk.

Dev VITE_CLERK_PUBLISHABLE_KEY starts with pk_test_
Set in .env.local AND Cloudflare Pages -> Settings -> Environment Variables.
CLERK_JWKS_URL must match key's domain: https://[slug].clerk.accounts.dev/.well-known/jwks.json

-----

## UI DESIGN — iOS 26 Liquid Glass + Dark Mode (v3.9)

### Light Mode Base

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

### Dark Mode System (v3.9)

File: src/lib/theme.tsx

ThemeProvider: wraps app in App.tsx, provides isDark boolean from localStorage('fuzzy_theme').
useTheme() hook: returns { isDark, toggleTheme } from context.
tk(isDark) function: returns token object based on current mode.

All pages import:
  import { useTheme, tk } from '../lib/theme'
  const { isDark } = useTheme()
  const t = tk(isDark)   // or thm = tk(isDark) — same thing

Token reference (tk(isDark) return values):

  Token           | Light value                          | Dark value
  ----------------|--------------------------------------|----------------------------------------
  pageBg          | linear-gradient(145deg,#f2f2f7...)   | linear-gradient(145deg,#1c1c1e,#2c2c2e)
  cardBg          | rgba(255,255,255,0.75)                | rgba(44,44,46,0.85)
  cardBorder      | 0.5px solid rgba(255,255,255,0.9)    | 0.5px solid rgba(255,255,255,0.08)
  cardShadow      | 0 2px 24px rgba(0,0,0,0.07),...      | 0 2px 24px rgba(0,0,0,0.4),...
  headerBg        | rgba(242,242,247,0.85)               | rgba(28,28,30,0.92)
  navBg           | rgba(242,242,247,0.9)                | rgba(28,28,30,0.95)
  navBorder       | 0.5px solid rgba(0,0,0,0.1)          | 0.5px solid rgba(255,255,255,0.08)
  textPrimary     | #1d1d1f                              | #f2f2f7
  textSecondary   | rgba(60,60,67,0.6)                   | rgba(235,235,245,0.6)
  textTertiary    | rgba(60,60,67,0.3)                   | rgba(235,235,245,0.3)
  inputBg         | rgba(255,255,255,0.9)                | rgba(58,58,60,0.9)
  inputBorder     | 0.5px solid rgba(0,0,0,0.12)         | 0.5px solid rgba(255,255,255,0.12)
  pillInactive    | rgba(120,120,128,0.12)               | rgba(120,120,128,0.25)
  sectionBg       | rgba(120,120,128,0.08)               | rgba(120,120,128,0.2)
  labelColor      | rgba(60,60,67,0.5)                   | rgba(235,235,245,0.5)

Theme persists to localStorage('fuzzy_theme') — 'dark' | 'light'.
Toggle button in Home.tsx header (☀️/🌙 icon button).

RULES:
  - NEVER hardcode '#1d1d1f', 'rgba(255,255,255,0.X)', 'rgba(60,60,67,0.X)' in page components
  - ALWAYS use t.textPrimary, t.cardBg, etc.
  - Select <option> elements require a <style> tag for dark bg (inline styles can't target options):
      <style>{`select option { background: ${isDark ? '#2c2c2e' : '#f2f2f7'}; color: ${t.textPrimary}; }`}</style>
  - dropdownStyle must be defined INSIDE the component after tk(isDark) is called — NOT at module level
  - TONES.map(t => ...) SHADOWS the outer t = tk(isDark) — rename iterator: TONES.map(tn => ...)
    Same for any .map() that uses 't' as iterator name inside a component with t = tk(isDark)

### Navigation (v4.0)

BottomNav component (src/components/BottomNav.tsx):
  5 buttons: Create / Projects / Settings / Queue / Dark toggle
  All buttons: flex: 1, padding: '10px 0 7px' (uniform alignment)
  Position: fixed, bottom: 0, zIndex: 200
  Style: borderRadius: '20px 20px 0 0', t.navBg + blur backdrop
  Uses useTheme() internally — no theme props needed

  Queue button (4th slot):
    Icon: ⏳ when runningTasks > 0, 📥 otherwise
    Badge: count of runningTasks + minimizedSessions (orange when running, green when idle)
    Tap: opens Queue popup panel above nav bar
    Disabled (opacity 0.4): when no tasks and no minimized sessions
    Active indicator bar (orange, top): shown when queueOpen === true

  CRITICAL — variable shadowing rule in BottomNav:
    runningTasks = tasks.filter(task => task.status === 'running').length
    NEVER use 't' as iterator name here — 't' = tk(isDark) is already defined in scope.
    Always use 'task' as the filter iterator to avoid shadowing.

  Queue popup panel:
    Position: fixed, bottom: 70px, left: 50%, transform: translateX(-50%)
    zIndex: 199 (below nav at 200, above page content)
    Width: calc(100vw - 32px), max 340px, min 280px
    Background: dark rgba(18,18,22,0.97) / light rgba(250,250,252,0.97) per isDark
    borderRadius: 18px, backdropFilter: blur(24px) saturate(180%)
    Backdrop overlay (zIndex 198): transparent full-screen tap-to-dismiss div
    Contents:
      Header: "QUEUE" label + ✕ close button
      Minimized sessions: blue pill, Resume button → navigate + unminimize, ✕ remove
      Running/done/error tasks: colored pill, View button (done), ✕ remove

  GenTaskBar component: REMOVED from App.tsx (merged into BottomNav Queue popup)
  GenTaskBar.tsx: file still exists but is no longer rendered anywhere

Scene Navigation Bar (Storyboard.tsx, mobile-only):
  Condition: !isDesktop && scenes.length > 1
  Position: fixed, bottom: 65px (above BottomNav), zIndex: 98
  Style: headerBg + navBorder + blur backdrop
  Controls: ← Prev / scene counter / Next → buttons
  paddingBottom on main content: 130px (extra space for nav bar + BottomNav)

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
26. Dark mode: ALL page components use useTheme() + tk(isDark) — never hardcode light-only colors
27. dropdownStyle defined INSIDE component function (after tk() call) — never at module-level
28. Map iterator shadowing: never use 't' as iterator name in components where t = tk(isDark)
29. Dashscope qwen-image-2.0-pro / qwen-image-2.0: omit prompt_extend and watermark params entirely
30. GLM image model: cogview-3-flash ONLY (cogview-4 and cogview-4-flash do not exist on ZhipuAI)
31. GLM image API: synchronous (no polling), response: { data: [{ url }] }
32. VeoPromptSection copy button: when showRaw=true copy full JSON, when false copy full_veo_prompt plain text
33. Mobile paddingBottom in Storyboard.tsx: 130px (not 80px) — accounts for BottomNav + scene nav bar
34. BottomNav Queue badge: uses tasks.filter(task => ...) NOT tasks.filter(t => ...) — 't' is reserved for tk(isDark) tokens
35. GenTaskBar is removed from App.tsx — queue is now in BottomNav Queue popup (zIndex 199)
36. Expand/Collapse button in scene cards: background var(--input-bg), color var(--text-primary) — never hardcode rgba(255,255,255,0.8)
37. Dashscope video fallback model: wan2.6-i2v-flash (NOT wan2.1-i2v-plus — that ID is invalid)
38. Duration slider removed from video output display card in Storyboard.tsx (sceneDurations state still used internally)

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

"url error, please check url！" (Dashscope image — qwen-image models)
-> Root cause: prompt_extend: true (boolean) was passed to qwen-image-2.0-pro / qwen-image-2.0.
   These models interpret prompt_extend as a URL string field (not a boolean toggle).
   Passing boolean true is treated as an invalid URL string -> "url error".
-> Fix: detect isQwenImage = model === 'qwen-image-2.0-pro' || model === 'qwen-image-2.0'
   Skip prompt_extend and watermark entirely for these models; only pass them for wanx/wan models.

"url error, please check url" (Dashscope image — wrong input)
-> Separate cause: img_url sent to t2i model. Remove img_url from t2i requests. Only i2v needs img_url.

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

"模型不存在" (ZhipuAI GLM image — model not found)
-> cogview-4 and cogview-4-flash do NOT exist on ZhipuAI API. Use cogview-3-flash.
-> cogview-4 (paid) and cogview-4-plus (paid) exist but are NOT integrated in this app.
-> worker/glm.ts must default to cogview-3-flash, not cogview-4.
-> Always verify GLM image model IDs against the list above before using.

Queue badge always shows 0 even when tasks are running (BottomNav)
-> Root cause: tasks.filter(t => t.status === 'running') — 't' shadows t = tk(isDark).
   The filter receives the tk() token object as 't', its .status is undefined, so count is always 0.
-> Fix: rename filter iterator to 'task': tasks.filter(task => task.status === 'running').length
-> RULE: never use 't' as an iterator variable in BottomNav or any component where t = tk(isDark).

Expand/Collapse button invisible or unreadable (Storyboard.tsx scene cards)
-> Root cause: background hardcoded as rgba(255,255,255,0.8) — white in dark mode blends with light text.
-> Fix: background: 'var(--input-bg)', color: 'var(--text-primary)', fontWeight: 600
-> All interactive buttons in scene cards must use CSS variable backgrounds, never hardcoded white.

Dashscope video "Model not exist" or invalid model error
-> Old fallback model wan2.1-i2v-plus is no longer valid.
-> Fix: use wan2.6-i2v-flash as default fallback in handleDashscopeVideoStart().
-> Valid video model IDs: wan2.6-i2v-flash, wanx2.1-i2v-turbo, wan2.6-t2v-flash, wan2.1-t2v-turbo

Dark mode: some cards/inputs still appearing white after switching themes
-> dropdownStyle was defined at module level (outside component), so it couldn't access tk(isDark).
   Move dropdownStyle const INSIDE the component function, after the t = tk(isDark) line.
-> Map iterators: TONES.map(t => ...) shadows outer t = tk(isDark). Rename iterator to tn or tone.
   Same for any .map() using 't' as a variable name inside a themed component.
-> select <option> background cannot be set via inline styles — use a <style> JSX tag instead.

"Clerk: Failed to load Clerk" / failed_to_load_clerk_js
-> Use pk_test_ keys for .pages.dev deployments (pk_live_ needs a real custom domain).
-> CLERK_JWKS_URL must match key's domain.

AWSCompromisedKeyQuarantineV3
-> AWS IAM Console -> Users -> Xklaa-pmpt -> Permissions -> Detach quarantine policy
-> Create new key. Never share keys in chat/screenshots.

-----

## CHANGELOG

### v4.0 (2026-03-08) — Queue Merged into BottomNav + Bug Fixes

Commits: 41be06e, 0d7bdcf, 9b4e8cc

#### Feature 1 — GenTaskBar merged into BottomNav Queue popup (41be06e)

Problem: GenTaskBar was a separate fixed bar sitting above BottomNav at bottom: 65px.
It duplicated navigation real estate and caused layout shifts on mobile.

Fix: Merged queue display into BottomNav as a 4th tab button "Queue".

Changes:
  src/components/BottomNav.tsx:
    - Added Queue button (4th slot) with ⏳/📥 icon and task count badge
    - Badge color: orange (#ff6b35) when runningTasks > 0, green (#34c759) when idle
    - Tap opens inline popup panel (zIndex 199) positioned above the nav bar
    - Popup contains: QUEUE header, minimized sessions (Resume/✕), brain tasks (View/✕)
    - Backdrop overlay (zIndex 198) dismisses popup on tap
    - Added Dark mode toggle as 5th button (was previously in BottomNav, preserved)
    - All 5 buttons now use flex: 1 + padding: '10px 0 7px' for uniform alignment
    - Spin animation for running tasks defined in inline <style> tag

  src/App.tsx:
    - Removed <GenTaskBar /> render and its import
    - GenTaskBar.tsx file still exists but is no longer used

#### Fix 2 — BottomNav uniform button alignment (0d7bdcf)

Problem: Queue button used padding: '10px 12px 7px' (fixed horizontal padding)
and Dark toggle used padding: '10px 14px 7px', while the 3 nav tabs used flex: 1.
This caused uneven spacing and misalignment across the 5 buttons.

Fix: All 5 buttons now have flex: 1 and padding: '10px 0 7px'.
  Queue button: added flex: 1, changed padding to '10px 0 7px'
  Dark toggle:  added flex: 1, changed padding to '10px 0 7px'

#### Fix 3 — Duration slider removed from video output display (41be06e)

Removed the ⏱ Duration slider block (input type="range" min=2 max=6) from the
video section of each scene card in Storyboard.tsx.

sceneDurations state is still maintained internally (used for video start payload),
but the UI slider is no longer shown to users.
The "Generate Video (Xs)" button label still shows the current duration.

#### Fix 4 — GLM image model cogview-4 invalid → cogview-3-flash (41be06e)

Problem: IMAGE_MODELS in Home.tsx and Storyboard.tsx listed cogview-4 as a valid
option. ZhipuAI API returns "模型不存在" (model not found) for cogview-4.
worker/glm.ts defaulted to cogview-4 when no model ID was supplied.

Fix:
  src/pages/Home.tsx:       Removed cogview-4 entry from IMAGE_MODELS array
  src/pages/Storyboard.tsx: Removed cogview-4, kept only cogview-3-flash with correct
                             label "CogView-3 Flash" and desc "Free & fast"
  worker/glm.ts:            Changed default from 'cogview-4' to 'cogview-3-flash'

#### Fix 5 — Dashscope video invalid fallback model (41be06e)

Problem: handleDashscopeVideoStart() in worker/dashscope.ts used
`body.video_model || 'wan2.1-i2v-plus'` as the model fallback.
wan2.1-i2v-plus is an old invalid model ID — was replaced by wan2.6-i2v-flash.

Fix: Changed fallback to 'wan2.6-i2v-flash' (current valid best-quality i2v model).

#### Fix 6 — Queue badge variable shadowing (9b4e8cc)

Problem: In BottomNav.tsx, the queue badge count used:
  const runningTasks = tasks.filter(t => t.status === 'running').length
The filter iterator 't' shadowed the outer 't = tk(isDark)' token object.
Inside the filter, 't' was the tk() object (not a task), so 't.status' was
undefined and the filter always returned 0 — badge never showed during generation.

Fix: Renamed filter iterator from 't' to 'task':
  const runningTasks = tasks.filter(task => task.status === 'running').length

RULE: Never use 't' as a variable name inside any component where t = tk(isDark).

#### Fix 7 — Expand/Collapse button unreadable contrast (9b4e8cc)

Problem: The Expand/Collapse button in Storyboard.tsx scene card headers used:
  background: 'rgba(255,255,255,0.8)'  <- hardcoded white
  color: 'var(--text-secondary)'        <- light in dark mode
In dark mode both background and text were near-white → button invisible.

Fix: Changed to theme-aware CSS variables:
  background: 'var(--input-bg)'    <- dark-aware (rgba(118,118,128,0.28) in dark)
  color: 'var(--text-primary)'     <- always readable (#f2f2f7 in dark, #1d1d1f in light)
  fontWeight: 600                   <- slightly bolder for readability

File size reference (as of v4.0):
  Home.tsx:       ~938 lines
  Storyboard.tsx: ~2662 lines
  Settings.tsx:   ~470 lines
  BottomNav.tsx:  ~324 lines
  dashscope.ts:   ~355 lines
  glm.ts:         ~230 lines

-----

### v3.9 (2026-03-08) — UI Revamp + Dark Mode + Bug Fixes

#### Fix 1 — Dark mode system (theme.tsx)

New file: src/lib/theme.tsx
  - ThemeProvider: React context, wraps entire app in App.tsx
  - useTheme() hook: returns { isDark, toggleTheme }
  - tk(isDark): returns 15 design tokens for the current mode (see UI DESIGN section)
  - Persists to localStorage('fuzzy_theme')
  - Toggle button in Home.tsx header (☀️ / 🌙)

Applied across all 3 main pages:
  Home.tsx:
    - dropdownStyle moved inside component (was module-level const)
    - TONES.map renamed iterator t -> tn to avoid shadowing theme t
    - All pill buttons, provider chips, art style/aspect ratio buttons use t.pillInactive/textPrimary
    - glass-input focus style: dark-aware rgba
    - select option <style> tag for dark bg
  Settings.tsx:
    - Header, card, label, input, select all use thm.* tokens
    - Back button: dark bg when isDark
    - Region sub-card: thm.sectionBg + thm.navBorder
    - Section headings all use thm.textPrimary
    - Security Note card: dark-aware blue bg
  Storyboard.tsx:
    - dropdownStyle moved inside component
    - glassCard, smallIconBtn, back button, header, thumbnail list all use thm.*
    - Scene card headers, VO script, audio history, video prompt textarea all themed
    - JSON pre block, desktop thumbnail sidebar, cost tracker all themed
    - select option <style> tag for dark bg
    - Mobile paddingBottom increased to 130px (was 80px)

#### Fix 2 — Scene navigation bar (mobile, Storyboard.tsx)

Added a fixed navigation bar on mobile (below scenes, above BottomNav):
  - Position: fixed, bottom: 65px, zIndex: 98 (below GenTaskBar's 199)
  - Only visible when: !isDesktop && scenes.length > 1
  - Buttons: ← Prev / scene counter / Next → (disabled at boundaries)
  - Colors: blue tint when active, t.pillInactive when disabled
  - Uses thm.headerBg + blur backdrop + thm.navBorder top

#### Fix 3 — Qwen image "url error" (dashscope.ts)

Root cause: handleDashscopeImageStart() was passing prompt_extend: true and
watermark: false to ALL image models, including qwen-image-2.0-pro and qwen-image-2.0.
These Qwen models treat prompt_extend as a URL string field — passing boolean true
causes the API to return "url error, please check url！".

Fix: added isQwenImage detection. For qwen-image models: only pass size, n, negative_prompt.
For wanx/wan models: also pass prompt_extend: true and watermark: false.

Code:
  const isQwenImage = model === 'qwen-image-2.0-pro' || model === 'qwen-image-2.0'
  const parameters: Record<string, unknown> = { size, n: 1, negative_prompt: ... }
  if (!isQwenImage) {
    parameters.prompt_extend = true
    parameters.watermark = false
  }

#### Fix 4 — GLM image "模型不存在" (model does not exist)

Root cause: Model ID cogview-4-flash was used in both Home.tsx and Storyboard.tsx.
This model does not exist on ZhipuAI API. Returns HTTP error "模型不存在" (model not found).

Fix: Changed all references from cogview-4-flash -> cogview-3-flash (valid free model).
  src/pages/Home.tsx
  src/pages/Storyboard.tsx (IMAGE_MODELS constant)

#### Fix 5 — VeoPromptSection copy button context-aware (VeoPromptSection.tsx)

Problem: Copy button always copied full_veo_prompt plain text, even when JSON view was active.

Fix:
  handleCopy now checks showRaw state:
    showRaw=true  -> copies JSON.stringify(veoPrompt, null, 2) — full JSON object
    showRaw=false -> copies veoPrompt.full_veo_prompt — plain text prompt string
  Button label changes:
    showRaw=true  -> "📋 Copy JSON"
    showRaw=false -> "📋 Copy Prompt"

#### Fix 6 — BottomNav rounded top corners (BottomNav.tsx)

Applied borderRadius: '24px 24px 0 0' to BottomNav container.
Consistent with iOS 26 design language — tab bar has smooth curved top edge.

#### Fix 7 — OpenRouter storyboard generation routing

Problem: OpenRouter provider routing was broken due to header key naming mismatch.
Fixed: frontend consistently uses X-Openrouter-Api-Key header.
brain-provider.ts: routes to OpenRouter when X-Openrouter-Api-Key is present.

#### Wan 2.6 video models added (dashscope.ts)

Updated QWEN_VIDEO_MODELS:
  wan2.6-i2v-flash  <- image->video, best quality (replaces wan2.1-i2v-plus badge)
  wanx2.1-i2v-turbo <- image->video, fast (unchanged)
  wan2.6-t2v-flash  <- text->video, best quality (replaces wan2.1-t2v-plus badge)
  wan2.1-t2v-turbo  <- text->video, fast (unchanged)

-----

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

## GEMINI CLI + FIREBASE STUDIO USAGE

### General workflow

When given a task file (.md):
  Read task file completely -> execute tasks in order -> report after each task
  Never skip TypeScript check before deploying

For TypeScript errors:
  npx tsc --noEmit 2>&1 | head -50
  Fix ALL errors before proceeding. Common causes:
  - Variable shadowing (e.g., t = tk(isDark) then TONES.map(t => ...))
  - dropdownStyle at module level referencing theme tokens (move inside component)
  - Missing type annotations on Record<string, unknown> payloads

For Worker deployment:
  wrangler deploy 2>&1 | tail -10
  Test with curl after deploy:
  curl -s -X POST https://fuzzy-vid-worker.officialdian21.workers.dev/api/brain/provider \
    -H "Content-Type: application/json" \
    -H "X-Gemini-Api-Key: YOUR_KEY" \
    -d '{"brain_model":"gemini-2.0-flash","system_prompt":"You are helpful.","user_prompt":"Reply ok","max_tokens":10}' | python3 -m json.tool

For frontend deployment:
  npm run build                         # must show 0 errors
  git add src/... worker/...            # SPECIFIC files only (never git add -A)
  git commit -m "feat/fix: description"
  git push origin main                  # triggers Cloudflare Pages auto-deploy

Always commit after all tasks complete:
  git add <specific files> && git commit -m "feat/fix: description" && git push origin main
  NEVER use git add -A or git add . (risk of committing secrets or tsconfig.tsbuildinfo)

### Firebase Studio / Project IDX setup

If working in Firebase Studio (Project IDX) or similar cloud IDE:

1. Clone repo or open existing workspace:
   git clone https://github.com/[your-repo]/Fuzzy-vid
   cd Fuzzy-vid && npm install

2. Environment setup — create .env.local:
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_...   (development key for .pages.dev)
   VITE_WORKER_URL=https://fuzzy-vid-worker.officialdian21.workers.dev

3. Start dev server:
   npm run dev
   (Vite serves on port 5173 by default — Firebase Studio auto-forwards port)

4. Worker local dev (optional — usually test against deployed worker):
   wrangler dev --port 8787
   Then set VITE_WORKER_URL=http://localhost:8787 in .env.local

5. Wrangler auth in cloud IDE:
   wrangler login                   # opens OAuth in browser
   OR: set CLOUDFLARE_API_TOKEN env var (preferred for non-interactive environments)
   export CLOUDFLARE_API_TOKEN=your_token_here

6. Common cloud IDE gotchas:
   - wrangler deploy may need CLOUDFLARE_API_TOKEN set (login may not persist)
   - npm run build output goes to dist/ — Cloudflare Pages reads this on push
   - localStorage and sessionStorage work normally in preview browser
   - Hard-refresh after deploy: Ctrl+Shift+R (bypass CDN cache)

### Gemini CLI specific tips

When Gemini CLI reads this file and receives a task:
  1. Read ALL relevant source files before making any edits
  2. For theme changes: check tk(isDark) token names before using them
  3. For model changes: verify model IDs against the VALID MODEL IDs section above
  4. For Worker changes: always check route order in index.ts (specific before catch-all)
  5. For Dashscope: check isQwenImage before adding any parameters

Quick health check commands:
  # Check Worker is up
  curl -s https://fuzzy-vid-worker.officialdian21.workers.dev/api/health

  # Test GLM brain (replace with real key)
  curl -s -X POST https://fuzzy-vid-worker.officialdian21.workers.dev/api/brain/provider \
    -H "Content-Type: application/json" \
    -H "X-Glm-Api-Key: YOUR_GLM_KEY" \
    -d '{"brain_model":"glm-4-flash","system_prompt":"Reply JSON only.","user_prompt":"Say ok","max_tokens":10}'

  # Check TypeScript
  npx tsc --noEmit 2>&1 | grep -c error

File size reference (as of v4.0):
  Home.tsx:       ~938 lines
  Storyboard.tsx: ~2662 lines
  Settings.tsx:   ~470 lines
  BottomNav.tsx:  ~324 lines
  dashscope.ts:   ~355 lines
  glm.ts:         ~230 lines
  brain.ts:       ~200 lines
  index.ts:       ~350 lines
