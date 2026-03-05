# Fuzzy Short — Claude Code Project Instructions

# Version 2.0 — Updated March 2026

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
Brain AI:  AWS Bedrock (Claude, Llama) + Dashscope Singapore (Qwen)
Image AI:  AWS Bedrock (Nova Canvas, SD 3.5) + Dashscope (Wanx)
Video AI:  AWS Bedrock Nova Reel (async) + Dashscope Wan2.1 (async)
Audio:     AWS Polly

-----

## FILE STRUCTURE

src/
pages/
Home.tsx         ← story input form, model selectors, generate button
Storyboard.tsx   ← scene cards, generate image/video/audio per scene
Settings.tsx     ← API keys, preferences
lib/
api.ts           ← all fetch calls to Worker
types/
schema.ts        ← types, VideoJob, SceneAssets, helpers

worker/
index.ts           ← route handler, credentials extraction
brain.ts           ← storyboard generation (Bedrock)
image.ts           ← Nova Canvas + SD 3.5 (Bedrock)
video.ts           ← Nova Reel async polling (Bedrock)
audio.ts           ← AWS Polly
dashscope.ts       ← ALL Qwen/Wanx/Wan2.1 (Dashscope Singapore)
lib/
aws-signature.ts ← HMAC signing — CRITICAL, see rules below

-----

## CRITICAL — AWS SIGNATURE RULE (DO NOT BREAK)

The buildCanonicalUri function MUST decode %3A before signing.
This is the #1 bug source. ALWAYS use this exact function:

```typescript
function buildCanonicalUri(rawUrl: string): string {
  const pathname = new URL(rawUrl).pathname
  return pathname
    .split('/')
    .map(segment => {
      let decoded: string
      try { decoded = decodeURIComponent(segment) }
      catch { decoded = segment }
      return encodeURIComponent(decoded).replace(/%3A/gi, ':')
    })
    .join('/')
}
```

In signRequest: ALWAYS call buildCanonicalUri(url) NOT new URL(url).pathname

Verify before deploying:
buildCanonicalUri(’…/model/amazon.nova-canvas-v1%3A0/invoke’)
→ MUST output: /model/amazon.nova-canvas-v1:0/invoke  (literal colon)

-----

## ALL VALID MODEL IDs (VERIFIED — do not guess)

### AWS Bedrock — Claude Code Brain

us.anthropic.claude-sonnet-4-6          ← primary brain model
us.anthropic.claude-haiku-4-5-20251001  ← fast/cheap tasks
us.meta.llama4-maverick-17b-instruct-v1:0

### AWS Bedrock — Image (use %3A in fetch URL, literal : in canonical URI)

amazon.nova-canvas-v1:0     → us-east-1 → fetch URL: nova-canvas-v1%3A0
stability.sd3-5-large-v1:0  → us-west-2 ONLY → fetch URL: sd3-5-large-v1%3A0

REMOVED (deprecated/invalid):
amazon.titan-image-generator-v2:0 ← DO NOT USE, removed from app

### AWS Bedrock — Video (ASYNC ONLY, us-east-1 ONLY)

amazon.nova-reel-v1:0  → async, 2-6s, polling via GetAsyncInvoke

### AWS Bedrock — Audio

AWS Polly — voice: Marlene (id), Joanna (en)

### Dashscope Singapore — Brain (OpenAI-compatible)

qwen3-max     ← best quality + reasoning
qwen-plus     ← balanced, recommended
qwen-flash    ← fast
qwen-turbo    ← cheapest
qwq-plus      ← deep reasoning

### Dashscope Singapore — Image (ALL async, use X-DashScope-Async: enable)

wanx2.1-t2i-turbo  ← fast, standard wanx format
wanx2.1-t2i-plus   ← best quality, standard wanx format
wan2.6-image        ← latest, uses messages[] format (DIFFERENT!)

REMOVED (invalid/not exist):
wanx-v1        ← DOES NOT EXIST, never use
wanx2.1-i2i   ← different endpoint, not implemented

### Dashscope Singapore — Video (ALL async)

wan2.1-i2v-plus    ← image→video best quality
wan2.1-i2v-turbo   ← image→video fast
wan2.1-t2v-plus    ← text→video best quality
wan2.1-t2v-turbo   ← text→video fast

-----

## DASHSCOPE API RULES

Endpoint base: https://dashscope-intl.aliyuncs.com
Auth: Authorization: Bearer YOUR_KEY  (NO AWS Signature!)
Region: Singapore (auto — no region header needed)

Brain endpoint:
POST /compatible-mode/v1/chat/completions
Body: { model, messages, max_tokens }

Image endpoint (ALL models):
POST /api/v1/services/aigc/text2image/image-synthesis
Header: X-DashScope-Async: enable
wanx2.1 body:  { model, input: { prompt }, parameters: { size, n, negative_prompt, watermark } }
wan2.6 body:   { model, input: { messages: [{ role: ‘user’, content: [{ text: prompt }] }] }, parameters }
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
POST /api/brain/generate          ← AWS Bedrock brain
POST /api/brain/rewrite-vo        ← rewrite VO text for duration
POST /api/image/generate          ← Nova Canvas or SD 3.5
POST /api/image/enhance-prompt    ← enhance prompt via Claude
POST /api/video/start             ← Nova Reel async start
GET  /api/video/status/:jobId     ← Nova Reel poll

POST /api/dashscope/brain         ← Qwen brain (all models)
POST /api/dashscope/image/start   ← Wanx image async start
POST /api/dashscope/video/start   ← Wan2.1 video async start
GET  /api/dashscope/task/:taskId  ← Dashscope poll (image + video)

POST /api/audio/generate          ← AWS Polly

-----

## REQUEST HEADERS

AWS Bedrock requests:
X-AWS-Access-Key-Id: from localStorage settings.awsAccessKeyId
X-AWS-Secret-Access-Key: from localStorage settings.awsSecretAccessKey
X-Brain-Region: us-east-1 (for Claude/Llama)
X-Image-Region: us-east-1 (for Nova Canvas) or us-west-2 (for SD 3.5)

Dashscope requests:
X-Dashscope-Api-Key: from localStorage settings.dashscopeApiKey

-----

## WORKER SECRETS (set via wrangler secret put)

AWS_ACCESS_KEY_ID       ← IAM user key (NOT compromised key)
AWS_SECRET_ACCESS_KEY   ← IAM user secret
R2_ACCESS_KEY_ID        ← R2 API token key
R2_SECRET_ACCESS_KEY    ← R2 API token secret
R2_ACCOUNT_ID           ← Cloudflare account ID
R2_BUCKET_NAME          ← igome-story-storage
R2_PUBLIC_URL           ← https://pub-xxx.r2.dev
DASHSCOPE_API_KEY       ← Alibaba Cloud Dashscope Singapore key

-----

## UI DESIGN SYSTEM — iOS 26 Liquid Glass

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
Accent orange:  #ff6b35  (generate buttons)
Accent blue:    #007aff  (iOS system blue, video)
Accent green:   #34c759  (success, download)
Accent purple:  #af52de  (audio)
Accent red:     #ff3b30  (errors)
Accent qwen:    #ff8c00  (Qwen model tag badge)

Tag Badges:
AWS:  background rgba(0,122,255,0.15), color #007aff
Qwen: background rgba(255,140,0,0.15), color #ff8c00

Button (active):
background: linear-gradient(135deg, #ff6b35, #ff4500)
borderRadius: 16px
boxShadow: 0 4px 20px rgba(255,107,53,0.4)
color: white

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

1. TypeScript strict — 0 errors before deploy (npx tsc –noEmit)
1. ALWAYS use buildCanonicalUri() in aws-signature.ts — never url.pathname directly
1. NEVER send img_url to Dashscope t2i models (text-to-image)
1. NEVER use invalid model IDs — check this file’s model list first
1. NEVER commit API keys — all keys via wrangler secrets or localStorage
1. After EVERY change: npm run build must show 0 errors
1. wan2.6-image uses messages[] format, not input.prompt
1. Dashscope poll URLs expire 24h — always re-upload to R2
1. Nova Reel: us-east-1 ONLY, SD 3.5: us-west-2 ONLY
1. Dashscope size uses * separator: 768*1280 not 768x1280

-----

## COMMON ERRORS & FIXES

Error: “signature does not match” / %3A in canonical string
Fix: aws-signature.ts → buildCanonicalUri must decode %3A → :

Error: “Model not exist” from Dashscope
Fix: Check model ID against VALID list above. wanx-v1 does not exist.

Error: “url error, please check url” from Dashscope image
Fix: Remove img_url from t2i requests. Only i2v models need img_url.

Error: “Invalid parameter” from Dashscope wan2.6
Fix: Use messages[] format, not input.prompt

Error: “API Usage Billing” in Claude Code header
Fix: This is normal in v2.x — check ~/.claude/settings.json has env.CLAUDE_CODE_USE_BEDROCK = “1”

Error: AWSCompromisedKeyQuarantineV3
Fix: Go to AWS IAM → Users → Xklaa-pmpt → Permissions → Detach quarantine policy
Then create new key. Never share keys in chat or screenshots.