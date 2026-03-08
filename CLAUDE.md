# Fuzzy Short — Claude Code Project Instructions

# Version 4.0 — Updated 2026-03-08

# READ THIS COMPLETELY before starting any task

-----

## PROJECT OVERVIEW

Fuzzy Short is a mobile-first web app for AI-powered short video storyboard generation.
Users input a story idea → AI generates storyboard → generate image/video/audio per scene.

Live URL: https://fuzzystuf.pages.dev
Worker URL: https://fuzzy-vid-worker.officialdian21.workers.dev
GitHub: https://github.com/[your-repo]/Fuzzy-vid

-----

## TECH STACK

Frontend:  React + TypeScript + Vite → deployed to Cloudflare Pages
Backend:   Cloudflare Worker (TypeScript) → fuzzy-vid-worker
Storage:   Cloudflare R2 → igome-story-storage bucket
Brain AI:  AWS Bedrock (Claude Sonnet 4.6, Llama 4) +
           Dashscope SG (Qwen3-Max, Qwen-Plus, Qwen-Flash, QwQ-Plus) +
           Google Gemini (2.0 Flash, 2.5 Pro) +
           Groq (Llama 3.3 70B, Llama 3.1 8B, Gemma 2 9B, Mixtral 8x7B) +
           OpenRouter (DeepSeek R1/V3, Gemma 3, Llama 3.3, Mistral 7B) +
           ZhipuAI GLM (glm-4-flash, glm-4-flash-250414, glm-z1-flash, glm-4.6v)
Image AI:  AWS Bedrock (Nova Canvas, SD 3.5) + Dashscope (Wanx/Qwen-Image) + ZhipuAI GLM (CogView-3-Flash)
Video AI:  AWS Bedrock Nova Reel (async) + Dashscope Wan2.6/2.1 (async) + ZhipuAI GLM CogVideoX-2 (async)
Audio:     AWS Polly + ElevenLabs

-----

## FILE STRUCTURE

src/
  pages/
    Home.tsx           ← story input form, provider pill + dropdown brain selector, tone selector
    Storyboard.tsx     ← per-scene cards, image/video/audio gen, Gen All Veo button, scene nav bar
    Settings.tsx       ← API keys (6 providers), test buttons, checkmark indicators, dark mode
    Dashboard.tsx      ← storyboard list, credits badge, tone pills
  lib/
    api.ts             ← all Worker fetch calls; exports WORKER_URL, getApiHeaders()
    providerModels.ts  ← 29 brain models x 6 providers; getModelsByProvider/getModelById/hasRequiredKey
    theme.tsx          ← ThemeProvider context, useTheme() hook, tk(isDark) token function
  types/
    schema.ts          ← AppSettings, VideoJob, SceneAssets, buildApiHeaders()
  components/
    VeoPromptSection.tsx ← per-scene Veo 3.1 prompt UI, sub-tone selector, copy/regen
    BottomNav.tsx        ← 5-button bottom nav (Create/Projects/Settings/Queue/Dark), Queue popup
  store/
    genTaskStore.ts           ← Zustand store for brain generation tasks (running/done/error)
    storyboardSessionStore.ts ← Zustand + IndexedDB store for session state + minimized sessions

worker/
  index.ts                        ← route handler, extractCredentials(), CORS headers
  brain.ts                        ← storyboard gen (Bedrock), buildBrainSystemPrompt/UserPrompt()
  image.ts                        ← Nova Canvas + SD 3.5 (Bedrock)
  video.ts                        ← Nova Reel async polling (Bedrock)
  audio.ts                        ← AWS Polly
  dashscope.ts                    ← ALL Qwen/Wanx/Wan2.6 (Dashscope Singapore)
  glm.ts                          ← ZhipuAI GLM image (CogView-3-Flash sync) + video (CogVideoX-2 async)
  handlers/
    brain-provider.ts             ← /api/brain/provider — universal OpenAI-compat handler
    regenerate-veo-prompt.ts      ← /api/brain/regenerate-veo-prompt — per-scene Veo gen
  lib/
    aws-signature.ts              ← HMAC SigV4 signing — CRITICAL RULE below
    providers.ts                  ← provider registry, callProvider(), getProviderForModel()
    brain-system-prompt.ts        ← buildBrainSystemPrompt() + buildBrainUserPrompt() (8 tones)
    veo-subtones.ts               ← VEO_SUBTONES (8 sub-tones), TONE_TO_SUBTONES, isVeoTone()

-----

## CRITICAL — AWS SIGNATURE RULE (DO NOT BREAK)

The buildCanonicalUri function MUST percent-encode ALL non-unreserved characters.
AWS SigV4 requires ":" to be encoded as "%3A" in the canonical URI.
This is the #1 bug source. ALWAYS use this exact function:

```typescript
function buildCanonicalUri(rawUrl: string): string {
  const pathname = new URL(rawUrl).pathname
  return pathname
    .split(‘/’)
    .map(segment => {
      let decoded: string
      try { decoded = decodeURIComponent(segment) }
      catch { decoded = segment }
      // CORRECT — encode ":" as "%3A" (AWS SigV4 requires percent-encoding of non-unreserved chars)
      return encodeURIComponent(decoded)
      // NOTE: Do NOT add .replace(/%3A/gi, ‘:’) — this was incorrect and caused Nova Canvas failures
    })
    .join(‘/’)
}
```

In signRequest: ALWAYS call buildCanonicalUri(url) NOT new URL(url).pathname

Verify before deploying:
buildCanonicalUri(‘…/model/amazon.nova-canvas-v1:0/invoke’)
→ MUST output: /model/amazon.nova-canvas-v1%3A0/invoke  (literal colon in URL → "%3A" in canonical)

CRITICAL URL ENCODING RULE (proven by signature error):
- Use LITERAL colon in fetch URL: amazon.nova-canvas-v1:0
- buildCanonicalUri encodes it to %3A in the canonical string
- NEVER pre-encode ‘:’ as ‘%3A’ in the fetch URL — AWS receives ‘%3A’ and re-encodes the ‘%’
  to ‘%25’, producing ‘%253A’ in its canonical string → signature mismatch

-----

## ALL VALID MODEL IDs (VERIFIED — do not guess)

### AWS Bedrock — Claude Code Brain

us.anthropic.claude-sonnet-4-6          ← primary brain model
us.anthropic.claude-haiku-4-5-20251001  ← fast/cheap tasks
us.meta.llama4-maverick-17b-instruct-v1:0
us.meta.llama4-scout-17b-instruct-v1:0

### AWS Bedrock — Image (literal colon in fetch URL, %3A in canonical URI only)

amazon.nova-canvas-v1:0     → us-east-1 → fetch URL uses literal colon
stability.sd3-5-large-v1:0  → us-west-2 ONLY → fetch URL uses literal colon

REMOVED (deprecated/invalid):
amazon.titan-image-generator-v2:0 ← DO NOT USE, removed from app

### AWS Bedrock — Video (ASYNC ONLY, us-east-1 ONLY)

amazon.nova-reel-v1:0  → async, 2-6s, polling via GetAsyncInvoke

### AWS Bedrock — Audio

AWS Polly voices:
  id-ID: Marlene, Andika (neural)
  en-US: Ruth, Danielle (generative); Joanna, Kimberly, Salli, Kendra, Matthew, Joey, Stephen, Gregory (neural)
Default: language=id → Marlene, language=en → Ruth

### Dashscope Singapore — Brain (OpenAI-compatible)

qwen3-max     ← best quality + reasoning
qwen-plus     ← balanced, recommended
qwen-flash    ← fast
qwen-turbo    ← cheapest
qwq-plus      ← deep reasoning

### Dashscope Singapore — Image (ALL async, use X-DashScope-Async: enable)

qwen-image-2.0-pro  ← best quality, standard format: input: { prompt }
qwen-image-2.0      ← balanced, standard format: input: { prompt }
wan2.6-image        ← alt, messages[] format: input: { messages: [{ role: 'user', content: [{ text: prompt }] }] }
wanx2.1-t2i-turbo  ← fast (legacy), standard format: input: { prompt }

REMOVED (no longer valid):
wanx-v1            ← was never valid on dashscope-intl endpoint
wanx2.1-i2i        ← different endpoint, not implemented
wanx2.1-t2i-plus   ← removed, replaced by qwen-image-2.0-pro

### Dashscope Singapore — Video (ALL async)

wan2.6-i2v-flash   ← image→video best quality  [updated v4.0]
wanx2.1-i2v-turbo  ← image→video fast
wan2.6-t2v-flash   ← text→video best quality   [updated v4.0]
wan2.1-t2v-turbo   ← text→video fast

REMOVED (invalid):
wan2.1-i2v-plus    ← no longer valid, replaced by wan2.6-i2v-flash
wan2.1-t2v-plus    ← no longer valid, replaced by wan2.6-t2v-flash

-----

## DASHSCOPE API RULES

Endpoint base: https://dashscope-intl.aliyuncs.com
Auth: Authorization: Bearer YOUR_KEY  (NO AWS Signature!)
Region: Singapore (auto — no region header needed)

Brain endpoint:
POST /compatible-mode/v1/chat/completions
Body: { model, messages, max_tokens }

Image endpoint (wanx-v1):
POST /api/v1/services/aigc/text2image/image-synthesis
Header: X-DashScope-Async: enable
Body: { model, input: { prompt }, parameters: { size, n, negative_prompt, watermark } }
Response: { output: { task_id } }

Video endpoint (ALL models):
POST /api/v1/services/aigc/video-generation/video-synthesis
Header: X-DashScope-Async: enable
i2v body: { model, input: { prompt, img_url: imageUrl }, parameters: { size, duration } }
t2v body: { model, input: { prompt }, parameters: { size, duration } }
CRITICAL: NEVER send img_url for t2v models or when image_url is empty/undefined

Poll endpoint (image + video shared):
GET /api/v1/tasks/{task_id}
Response statuses: PENDING | RUNNING | SUCCEEDED | FAILED
On SUCCEEDED: results[0].url (image) or video_url (video)
NOTE: Dashscope URLs expire in 24h → must download and re-upload to R2!

Size format uses * not x:
9:16 → 768*1280
16:9 → 1280*768
1:1  → 1024*1024
4:5  → 864*1080

-----

## VIDEO POLLING ARCHITECTURE

Both Nova Reel and Wan2.1 are ASYNC (2-5 minutes):

Flow:

1. POST /api/video/start (Nova Reel) or /api/dashscope/video/start (Wan2.1)
1. Save job to localStorage: key = video_job_{projectId}_{sceneNum}
1. Poll every 10 seconds
1. Timeout after 10 minutes → show error + retry

Nova Reel poll: GET /api/video/status/:jobId (encoded ARN)
Dashscope poll: GET /api/dashscope/task/:taskId

On complete: download asset → upload to R2 → return R2 public URL

-----

## WORKER ROUTES

GET  /api/health
POST /api/brain/generate                   ← AWS Bedrock brain
POST /api/brain/rewrite-vo                 ← rewrite VO text for duration
POST /api/brain/regenerate-video-prompt    ← regenerate video_prompt for single scene
POST /api/image/generate                   ← Nova Canvas or SD 3.5
POST /api/image/enhance-prompt             ← enhance prompt via Claude
POST /api/video/start                      ← Nova Reel async start
GET  /api/video/status/:jobId              ← Nova Reel poll

POST /api/dashscope/brain         ← Qwen brain (all models)
POST /api/dashscope/image/start   ← Wanx/Qwen image async start
POST /api/dashscope/video/start   ← Wan2.6/2.1 video async start
GET  /api/dashscope/task/:taskId  ← Dashscope poll (image + video)

POST /api/glm/image/generate      ← CogView-3-Flash sync image (requireGlmKey)
POST /api/glm/video/start         ← CogVideoX-2 async video start (requireGlmKey)
GET  /api/glm/video/status/:taskId ← CogVideoX-2 poll

POST /api/audio/generate          ← AWS Polly

GET  /api/user/profile            ← get user profile + credits (auth required)
PUT  /api/user/profile            ← update preferences (auth required)
GET  /api/user/keys               ← get decrypted API keys from D1 (auth required)
POST /api/user/keys               ← save encrypted API keys to D1 (auth required)
GET  /api/user/usage              ← credit usage summary + recent log (auth required)

GET  /api/storyboards             ← list user storyboards (auth required)
POST /api/storyboards             ← save/upsert storyboard (auth required)
GET  /api/storyboards/:id         ← get single storyboard (auth required)
DELETE /api/storyboards/:id       ← delete storyboard (auth required)
POST /api/storyboards/:id/scenes  ← upsert scene asset (auth required)

-----

## REQUEST HEADERS

All headers built from localStorage key: fuzzy_settings_{userId}
getApiHeaders(userId?) in src/lib/api.ts — always pass userId from useUser() hook.

AWS Bedrock:
  X-AWS-Access-Key-Id       ← settings.awsAccessKeyId
  X-AWS-Secret-Access-Key   ← settings.awsSecretAccessKey
  X-Brain-Region            ← settings.brainRegion (default: us-east-1)
  X-Image-Region            ← settings.imageRegion (default: us-east-1)

Dashscope:  X-Dashscope-Api-Key   ← settings.dashscopeApiKey
Gemini:     X-Gemini-Api-Key      ← settings.geminiApiKey
Groq:       X-Groq-Api-Key        ← settings.groqApiKey
OpenRouter: X-Openrouter-Api-Key  ← settings.openrouterApiKey
GLM:        X-Glm-Api-Key         ← settings.glmApiKey

-----

## WORKER SECRETS (set via wrangler secret put)

# Internal R2/D1 operations only — NOT used as fallback for user generation routes
AWS_ACCESS_KEY_ID       ← R2 operations only (since v3.3, NOT used in extractCredentials)
AWS_SECRET_ACCESS_KEY   ← R2 operations only
R2_ACCESS_KEY_ID        ← R2 API token key
R2_SECRET_ACCESS_KEY    ← R2 API token secret
R2_ACCOUNT_ID           ← Cloudflare account ID
R2_BUCKET_NAME          ← igome-story-storage
R2_PUBLIC_URL           ← https://pub-xxx.r2.dev
DASHSCOPE_API_KEY       ← kept in env but NOT used as user fallback (since v3.3)
CLERK_SECRET_KEY        ← Clerk secret key (from clerk.dev dashboard)
CLERK_JWKS_URL          ← https://[app-slug].clerk.accounts.dev/.well-known/jwks.json

## AUTH — Clerk

Use DEVELOPMENT keys (pk_test_) for .pages.dev deployments.
pk_live_ requires a real custom domain — .pages.dev cannot host Clerk subdomains.
Dev key JWKS: https://[app-slug].clerk.accounts.dev/.well-known/jwks.json

-----

## UI DESIGN SYSTEM — iOS 26 Liquid Glass + Dark Mode

Theme system: src/lib/theme.tsx
  ThemeProvider wraps app in App.tsx — sets CSS variables on document.documentElement
  useTheme() returns { isDark, toggle }
  tk(isDark) returns CONSTANT_TOKENS — all values are var(--token-name) references
  Persists to localStorage('fuzzy_theme')

NEVER hardcode light-only colors in components. Always use var(--token) or t.token.

CSS Variables (set by ThemeProvider on :root):
  --text-primary    light: #1d1d1f            dark: #f2f2f7
  --text-secondary  light: rgba(60,60,67,0.6) dark: rgba(235,235,245,0.6)
  --text-tertiary   light: rgba(60,60,67,0.3) dark: rgba(235,235,245,0.3)
  --card-bg         light: rgba(255,255,255,0.75) dark: rgba(44,44,46,0.92)
  --card-border     light: 0.5px solid rgba(255,255,255,0.9) dark: 0.5px solid rgba(255,255,255,0.1)
  --input-bg        light: rgba(118,118,128,0.1) dark: rgba(118,118,128,0.28)
  --nav-bg          light: rgba(242,242,247,0.94) dark: rgba(22,22,24,0.97)
  --nav-border      light: 0.5px solid rgba(0,0,0,0.1) dark: 0.5px solid rgba(255,255,255,0.1)
  --header-bg       light: rgba(242,242,247,0.92) dark: rgba(22,22,24,0.97)
  --pill-inactive   light: rgba(118,118,128,0.12) dark: rgba(255,255,255,0.07)
  --label-color     light: rgba(60,60,67,0.6) dark: rgba(235,235,245,0.5)

Accent colors (same in both modes):
  Orange: #ff6b35 → #ff4500 gradient (generate buttons)
  Blue:   #007aff (iOS system blue, video)
  Green:  #34c759 (success, download)
  Purple: #af52de (audio)
  Red:    #ff3b30 (errors)
  Qwen:   #ff8c00 (Qwen model tag badge)

Tag Badges:
  AWS:  background rgba(0,122,255,0.15), color #007aff
  Qwen: background rgba(255,140,0,0.15), color #ff8c00

Button (active/generate):
  background: linear-gradient(135deg, #ff6b35, #ff4500)
  borderRadius: 16px
  boxShadow: 0 4px 20px rgba(255,107,53,0.4)
  color: white

RULES:
  - dropdownStyle must be defined INSIDE component after tk() call — never at module level
  - Map iterators must NOT use 't' when t = tk(isDark) is in scope (rename to tn, tab, task, etc.)
  - select <option> elements need a <style> JSX tag for dark bg (inline styles can't target options)
  - Interactive buttons use var(--input-bg) background + var(--text-primary) color (never hardcoded white)

-----

## DESKTOP LAYOUT (≥ 768px)

Storyboard page: 2-column grid
Left (320px): scene thumbnail list — click to activate
Right (flex 1): active scene detail, scrollable
Each thumbnail: image preview + status indicators 🖼️✅ 🎬⬜ 🎵✅

Home page: max-width 600px centered

Responsive hook:
const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768)
useEffect(() => {
const fn = () => setIsDesktop(window.innerWidth >= 768)
window.addEventListener(‘resize’, fn)
return () => window.removeEventListener(‘resize’, fn)
}, [])

-----

## MODEL SELECTOR FLOW (Home → Storyboard)

1. User selects image model + video model in Home.tsx
1. On generate: sessionStorage.setItem(‘selected_image_model’, imageModel)
1. Storyboard reads on load: pre-populate ALL scenes with saved defaults
1. User can override per-scene from scene card dropdown

-----

## VO TEXT DURATION CONSTRAINT

Speaking rate: Indonesian ~15 chars/sec, English ~18 chars/sec
charLimit = Math.floor(durationSeconds * charsPerSecond)

Brain prompt includes: “Max narration: X characters for Y second scene”
Rewrite VO endpoint: POST /api/brain/rewrite-vo
Returns: { rewritten_text, char_count, char_limit, fits }

-----

## LIGHTBOX IMAGE VIEWER

Tap any generated image → fullscreen modal

- Background: rgba(0,0,0,0.92)
- Close button top-right
- Download button bottom-center
- Scene label top-left
- Click outside to close

-----

## DEPLOYMENT COMMANDS

# Build frontend

npm run build

# Deploy Worker

wrangler deploy

# Deploy Frontend (auto via GitHub push to main)

git add . && git commit -m “message” && git push origin main

# Check Worker logs

wrangler tail

# Update secrets

wrangler secret put SECRET_NAME

-----

## CODING RULES

1.  TypeScript strict — 0 errors before deploy (npx tsc --noEmit)
2.  ALWAYS use buildCanonicalUri() in aws-signature.ts — never url.pathname directly
3.  buildCanonicalUri: encodeURIComponent(decoded) ONLY — NO .replace(/%3A/gi, ':')
4.  video.ts ARN path: encodeURIComponent(arn) WITHOUT .replace — colons must be %3A
5.  NEVER send img_url to Dashscope t2i models (text-to-image)
6.  NEVER use invalid model IDs — check this file's model list first
7.  NEVER commit API keys — all keys via wrangler secrets or localStorage
8.  After EVERY change: npm run build must show 0 errors
9.  Dashscope poll URLs expire 24h — always re-upload to R2
10. Nova Reel: us-east-1 ONLY, SD 3.5: us-west-2 ONLY
11. Dashscope size uses * separator: 768*1280 not 768x1280
12. video_prompt.full_prompt max 200 chars — starts with camera movement
13. customVideoPrompt overrides videoPrompt.full_prompt when sending to Nova Reel / Wan2.1
14. Video Prompt section default: collapsed (videoPromptExpanded state)
15. NEVER use env.AWS_ACCESS_KEY_ID as fallback in extractCredentials (security)
16. All generation routes call requireAwsKeys / requireDashscopeKey / requireGlmKey → 401 if missing
17. localStorage user settings key: fuzzy_settings_{userId} NOT 'fuzzy_short_settings'
18. getApiHeaders(userId?) — always pass userId from useUser() in all page components
19. brainModel state is string (not union type) since v3.7 — default 'gemini-2.0-flash'
20. Brain routing: aws->/api/brain/generate, dashscope->/api/dashscope/brain, else->/api/brain/provider
21. Gemini header is X-Gemini-Api-Key (not X-Gemini-Key) — standardized v3.8
22. brain-provider.ts MODE A (body.story) returns JSON directly — NOT { content: "..." }
23. Strip <think>...</think> from reasoning model outputs before JSON.parse
24. VeoPromptSection must receive apiHeaders prop from getApiHeaders(user?.id)
25. hasRequiredKey(model, userSettings) from providerModels.ts — use for UI key gating
26. Dark mode: ALL page components use useTheme() + tk(isDark) — never hardcode light-only colors
27. dropdownStyle defined INSIDE component function (after tk() call) — never at module-level
28. Map iterator shadowing: NEVER use 't' as iterator name in components where t = tk(isDark)
    This applies to ALL .filter(), .map(), .forEach() etc inside themed components
29. Dashscope qwen-image-2.0-pro / qwen-image-2.0: omit prompt_extend and watermark params entirely
30. GLM image model: cogview-3-flash ONLY (cogview-4 and cogview-4-flash do NOT exist on ZhipuAI)
31. GLM image API: synchronous (no polling), response: { data: [{ url }] }
32. Mobile paddingBottom in Storyboard.tsx: 130px — accounts for BottomNav + scene nav bar
33. BottomNav Queue badge: use tasks.filter(task => ...) NOT tasks.filter(t => ...) — 't' is reserved for tk(isDark)
34. GenTaskBar is removed from App.tsx — queue lives in BottomNav Queue popup (zIndex 199)
35. Expand/Collapse buttons in scene cards: background var(--input-bg), color var(--text-primary) — never rgba(255,255,255,0.8)
36. Dashscope video default model: wan2.6-i2v-flash (NOT wan2.1-i2v-plus — that ID is invalid)
37. Duration slider removed from video output display — sceneDurations state still used internally for video start payload

-----

## BOTTOM NAVIGATION — STRUCTURE (v4.0)

src/components/BottomNav.tsx — 5 buttons, all flex: 1, padding: '10px 0 7px'

Button layout (left to right):
  1. Create    (🎬) → navigate('/')
  2. Projects  (📋) → navigate('/dashboard')
  3. Settings  (⚙️) → navigate('/settings')
  4. Queue     (⏳/📥) → opens queue popup panel
  5. Dark/Light (☀️/🌙) → toggles theme

Queue button details:
  - runningTasks: tasks.filter(task => task.status === 'running').length
    !! iterator MUST be 'task' not 't' — 't' shadows t = tk(isDark) !!
  - totalIndicator: runningTasks + minimizedSessions.length
  - Badge: orange when running, green when tasks done/pending
  - Popup: zIndex 199, positioned bottom: 70px above nav
  - Backdrop overlay: zIndex 198, transparent, tap to dismiss

Queue popup contents:
  - Minimized sessions: blue pill, Resume → navigate + updateSession({isMinimized:false}), ✕ → removeSession
  - Brain tasks: colored by status (running=orange, done=green, error=red)
    done + has sessionId/resultJson → View button → navigate to storyboard

GenTaskBar.tsx: file exists but NOT rendered (removed from App.tsx in v4.0)

-----

## COMMON ERRORS & FIXES

"signature does not match" / canonical URI mismatch
-> aws-signature.ts: buildCanonicalUri must use encodeURIComponent(decoded) WITHOUT .replace(/%3A/gi, ':')
-> ":" MUST be "%3A" in canonical URI — the .replace was the old bug

Nova Reel "UnknownOperationException"
-> video.ts ARN path: use encodeURIComponent(arn) WITHOUT .replace(/%3A/gi, ':')
-> Literal colons in URL path break AWS routing to GetAsyncInvoke

"Model not exist" (Dashscope image)
-> Wrong model ID. Valid: qwen-image-2.0-pro, qwen-image-2.0, wan2.6-image, wanx2.1-t2i-turbo
-> wanx-v1 does not exist on dashscope-intl. wanx2.1-t2i-plus removed.

"url error, please check url" (Dashscope image — qwen-image models)
-> prompt_extend: true passed to qwen-image-2.0-pro / qwen-image-2.0 (these treat it as URL string)
-> Fix: skip prompt_extend and watermark for isQwenImage models

"url error, please check url" (Dashscope image — wrong input)
-> img_url sent to t2i model. Remove img_url from t2i requests. Only i2v needs img_url.

"InvalidParameter" from Dashscope wan2.6 image
-> Use messages[] format: input: { messages: [{role:'user', content:[{text:prompt}]}] }

"AWS credentials required" (401 from Worker)
-> User must provide AWS keys in Settings. Worker no longer falls back to env.AWS_ACCESS_KEY_ID.

"模型不存在" (ZhipuAI GLM image — model not found)
-> cogview-4 and cogview-4-flash do NOT exist. Use cogview-3-flash only.
-> worker/glm.ts default must be 'cogview-3-flash' not 'cogview-4'

Queue badge always shows 0 even when tasks are running (BottomNav)
-> tasks.filter(t => ...) shadows t = tk(isDark) — filter gets token object, .status is undefined
-> Fix: tasks.filter(task => task.status === 'running').length

Expand/Collapse button invisible in dark mode (Storyboard scene cards)
-> background: rgba(255,255,255,0.8) hardcoded white blends with light-colored text in dark mode
-> Fix: background: 'var(--input-bg)', color: 'var(--text-primary)', fontWeight: 600

Dashscope video "Model not exist" / invalid model
-> Old fallback wan2.1-i2v-plus is invalid. Fix: body.video_model || 'wan2.6-i2v-flash'

Storyboard generates but immediately redirects back to homepage (GLM/Groq/OpenRouter)
-> brain-provider.ts returning { content: "..." } instead of JSON directly
-> Fixed in v3.8: MODE A (body.story set) now parses and returns storyboard JSON directly

"Clerk: Failed to load Clerk" / failed_to_load_clerk_js
-> Use pk_test_ keys for .pages.dev deployments (pk_live_ needs a real custom domain)
-> CLERK_JWKS_URL must match key domain

AWSCompromisedKeyQuarantineV3
-> AWS IAM Console -> Users -> Xklaa-pmpt -> Permissions -> Detach quarantine policy
-> Create new key. Never share keys in chat/screenshots.

-----

## CHANGELOG

### v4.0 (2026-03-08) — Queue in BottomNav + Bug Fixes

Commits: 41be06e, 0d7bdcf, 9b4e8cc

#### Feature — GenTaskBar merged into BottomNav Queue popup

Files changed:
  src/components/BottomNav.tsx   <- Queue button + popup panel added; all 5 buttons flex:1 uniform
  src/App.tsx                    <- Removed GenTaskBar import and render

BottomNav now has 5 equal-width buttons: Create / Projects / Settings / Queue / Dark
Queue button:
  - Icon ⏳ when running, 📥 when idle
  - Orange badge (running count) or green badge (done/minimized count)
  - Tapping opens popup panel at bottom: 70px above nav, zIndex 199
  - Backdrop at zIndex 198 dismisses on outside tap
  - Popup shows minimized sessions + brain tasks with Resume/View/Remove actions
  - runningTasks computed as: tasks.filter(task => task.status === 'running').length
    (iterator named 'task' to avoid shadowing t = tk(isDark))

#### Feature — Duration slider removed from video card

Removed input[type=range] duration slider from the video output section in Storyboard.tsx.
sceneDurations state is still maintained — used in video start payloads.
The "Generate Video (Xs)" button label still reflects the current duration value.

#### Fix — GLM image model cogview-4 invalid

Files: src/pages/Home.tsx, src/pages/Storyboard.tsx, worker/glm.ts

cogview-4 removed from IMAGE_MODELS arrays in both Home.tsx and Storyboard.tsx.
Only cogview-3-flash remains — label corrected to "CogView-3 Flash", desc "Free & fast".
worker/glm.ts default changed from 'cogview-4' to 'cogview-3-flash'.

#### Fix — Dashscope video invalid fallback model

File: worker/dashscope.ts

handleDashscopeVideoStart: body.video_model || 'wan2.1-i2v-plus' changed to
body.video_model || 'wan2.6-i2v-flash' (wan2.1-i2v-plus is an invalid obsolete ID).

#### Fix — BottomNav button alignment

File: src/components/BottomNav.tsx

Queue button: added flex: 1, changed padding from '10px 12px 7px' to '10px 0 7px'
Dark toggle:  added flex: 1, changed padding from '10px 14px 7px' to '10px 0 7px'
All 5 buttons now equal width and vertically consistent.

#### Fix — Queue badge variable shadowing

File: src/components/BottomNav.tsx

tasks.filter(t => t.status === 'running') → tasks.filter(task => task.status === 'running')
't' was shadowing t = tk(isDark); filter was returning 0 always.

#### Fix — Expand/Collapse button unreadable contrast

File: src/pages/Storyboard.tsx

Scene card expand/collapse button:
  background: 'rgba(255,255,255,0.8)' → 'var(--input-bg)'
  color: 'var(--text-secondary)'      → 'var(--text-primary)'
  fontWeight: 500                      → 600

-----

### v3.9 (2026-03-08) — Dark Mode + UI Revamp + Qwen/GLM Fixes

Key changes:
  - Full dark mode system: src/lib/theme.tsx with ThemeProvider, useTheme(), tk(isDark)
  - CSS variables set on :root by ThemeProvider; tk() returns CONSTANT_TOKENS (var refs)
  - All pages themed: Home, Settings, Storyboard, Dashboard
  - Scene navigation bar added (mobile, fixed bottom: 65px, above BottomNav)
  - BottomNav: rounded top corners (borderRadius: '20px 20px 0 0')
  - Qwen image fix: isQwenImage detection prevents prompt_extend/watermark for qwen-image models
  - GLM image fix: cogview-4-flash → cogview-3-flash (previous fix, now fully cleaned up in v4.0)
  - Wan 2.6 video models added: wan2.6-i2v-flash, wan2.6-t2v-flash
  - VeoPromptSection copy button: context-aware (copy JSON vs plain text)
  - brain-provider.ts MODE A/B distinction fixes GLM/Groq/OpenRouter storyboard routing

### v3.8 (2026-03-07) — Bug Fixes + GLM-4.6V + Gen All Veo

  - Gemini header standardized: X-Gemini-Key → X-Gemini-Api-Key everywhere
  - brain-provider.ts MODE A returns storyboard JSON directly (fixes forced redirect to home)
  - regenerate-veo-prompt.ts strips <think> blocks before JSON.parse
  - Gen All Veo button added to Storyboard.tsx header
  - GLM-4.6V model added to providers.ts and providerModels.ts

### v3.7 (2026-03-07) — Multi-Provider Brain + UI Redesign

  - 6 brain providers: AWS, Dashscope, Gemini, Groq, OpenRouter, GLM
  - Home.tsx: provider pill row + model dropdown selector
  - Settings.tsx: SecretInput checkmarks, test buttons for all providers
  - Dashboard.tsx: tone badges per storyboard card
  - New: src/lib/providerModels.ts, worker/lib/providers.ts, worker/handlers/brain-provider.ts

### v3.3–v3.6 (2026-03) — Foundation

  - v3.6: Veo 3.1 prompt engine (VeoPromptSection, 8 sub-tones, regenerate handler)
  - v3.5: Brain system prompt rebuild (8 tones, brain-provider.ts)
  - v3.4: Multi-provider foundation (providerModels.ts, providers.ts)
  - v3.3: Security fix — env.AWS_ACCESS_KEY_ID no longer used as fallback

-----

## DEPLOYMENT

npm run build          <- must show 0 TypeScript errors (npx tsc --noEmit first)
wrangler deploy        <- deploy Worker (~10s)
git push origin main   <- triggers Cloudflare Pages auto-deploy (~1-2 min)
wrangler tail          <- live Worker logs for debugging

NEVER use git add -A or git add . — always stage specific files only.
Hard-refresh browser after deploy: Cmd+Shift+R / Ctrl+F5 (bypass CDN cache)
