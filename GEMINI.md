# Fuzzy Short — Gemini CLI Project Instructions

# Version 3.3 — Updated March 2026

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
Brain AI:  AWS Bedrock (Claude Sonnet, Llama 4) + Dashscope SG (Qwen)
Image AI:  AWS Bedrock (Nova Canvas, SD 3.5) + Dashscope (Wanx)
Video AI:  AWS Bedrock Nova Reel (async) + Dashscope Wan2.1 (async)
Audio:     AWS Polly

-----

## FILE STRUCTURE

src/
pages/
Home.tsx         ← input form, brain/image/video model selectors
Storyboard.tsx   ← per-scene cards, generate image/video/audio
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
aws-signature.ts ← HMAC signing — see CRITICAL RULE below

-----

## CRITICAL — AWS SIGNATURE RULE (NEVER SKIP)

The #1 bug in this project. AWS SigV4 requires “:” to be encoded as “%3A”
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
      // CORRECT — “:” must be “%3A” in canonical URI (AWS SigV4 requirement)
      return encodeURIComponent(decoded)
      // ⚠️ NEVER add .replace(/%3A/gi, ':') — this was the old bug that caused Nova Canvas failures
    })
    .join('/')
}
```

signRequest MUST call buildCanonicalUri(url) — NEVER use url.pathname directly.

Same rule applies in video.ts: ARN path must use encodeURIComponent(arn) WITHOUT
.replace(/%3A/gi, ':') — literal colons cause UnknownOperationException on GetAsyncInvoke.

Test before deploying:

```bash
node -e “
function b(u){const p=new URL(u).pathname;return p.split('/').map(s=>{let d;try{d=decodeURIComponent(s)}catch{d=s};return encodeURIComponent(d)}).join('/')}
console.log(b('https://bedrock-runtime.us-east-1.amazonaws.com/model/amazon.nova-canvas-v1%3A0/invoke'))
// MUST print: /model/amazon.nova-canvas-v1%3A0/invoke  ('%3A' encoded, NOT literal colon)
“
```

-----

## VALID MODEL IDs (verified — do not guess or use others)

### AWS Bedrock — Brain

us.anthropic.claude-sonnet-4-6
us.anthropic.claude-haiku-4-5-20251001
us.meta.llama4-maverick-17b-instruct-v1:0

### AWS Bedrock — Image

nova_canvas → amazon.nova-canvas-v1:0 → us-east-1
sd35        → stability.sd3-5-large-v1:0 → us-west-2 ONLY

❌ REMOVED: amazon.titan-image-generator-v2:0 (deprecated)

### AWS Bedrock — Video

nova_reel → amazon.nova-reel-v1:0 → us-east-1 ONLY, async 2-6s

### Dashscope Singapore — Brain

qwen3-max, qwen-plus, qwen-flash, qwen-turbo, qwq-plus

### Dashscope Singapore — Image (ALL async)

qwen-image-2.0-pro  ← best quality, standard format: input: { prompt }
qwen-image-2.0      ← balanced, standard format: input: { prompt }
wan2.6-image        ← messages[] format: input: { messages: [{role:'user', content:[{text:prompt}]}] }
wanx2.1-t2i-turbo  ← fast (legacy), standard format: input: { prompt }

❌ REMOVED: wanx-v1 (DOES NOT EXIST on dashscope-intl), wanx2.1-t2i-plus (replaced by qwen-image-2.0-pro)

### Dashscope Singapore — Video (ALL async)

wan2.1-i2v-plus, wan2.1-i2v-turbo  ← image→video
wan2.1-t2v-plus, wan2.1-t2v-turbo  ← text→video

-----

## DASHSCOPE API RULES

Base URL: https://dashscope-intl.aliyuncs.com
Auth: Authorization: Bearer YOUR_KEY  (no AWS signing needed)
Region: Singapore (auto — no region param)

Brain:
POST /compatible-mode/v1/chat/completions
Body: { model, messages: [{role, content}], max_tokens }

Image (wanx2.1 models):
POST /api/v1/services/aigc/text2image/image-synthesis
Header: X-DashScope-Async: enable
Body: { model, input: { prompt }, parameters: { size, n, negative_prompt, watermark: false } }

Image (wan2.6-image ONLY — different format!):
POST /api/v1/services/aigc/text2image/image-synthesis
Header: X-DashScope-Async: enable
Body: { model, input: { messages: [{ role:‘user’, content:[{text: prompt}] }] }, parameters: {…} }

Video (i2v — image to video):
POST /api/v1/services/aigc/video-generation/video-synthesis
Header: X-DashScope-Async: enable
Body: { model, input: { prompt, img_url: imageUrl }, parameters: { size, duration } }

Video (t2v — text to video):
POST /api/v1/services/aigc/video-generation/video-synthesis
Body: { model, input: { prompt }, parameters: { size, duration } }
⚠️ NEVER send img_url for t2v models

Poll (shared for image + video):
GET /api/v1/tasks/{task_id}
Statuses: PENDING | RUNNING | SUCCEEDED | FAILED
SUCCEEDED: results[0].url (image) or video_url (video)
⚠️ URLs expire in 24h — always re-upload to R2!

Size format uses * separator (NOT x):
9:16 → 768*1280
16:9 → 1280*768
1:1  → 1024*1024
4:5  → 864*1080

-----

## WORKER ROUTES

GET  /api/health
POST /api/brain/generate                   ← AWS Bedrock brain (requireAwsKeys)
POST /api/brain/rewrite-vo                 ← (requireAwsKeys)
POST /api/brain/regenerate-video-prompt    ← (requireAwsKeys)
POST /api/image/generate                   ← Nova Canvas or SD 3.5 (requireAwsKeys)
POST /api/image/enhance-prompt             ← (requireAwsKeys)
POST /api/video/start                      ← Nova Reel async (requireAwsKeys)
GET  /api/video/status/:jobId              ← Nova Reel poll
POST /api/audio/generate                   ← AWS Polly (requireAwsKeys)
POST /api/dashscope/brain                  ← (requireDashscopeKey)
POST /api/dashscope/image/start            ← (requireDashscopeKey)
POST /api/dashscope/video/start            ← (requireDashscopeKey)
GET  /api/dashscope/task/:taskId           ← poll (no key guard, status only)

GET  /api/user/profile                     ← auth required (Clerk JWT)
PUT  /api/user/profile                     ← auth required
GET  /api/user/keys                        ← get decrypted API keys from D1
POST /api/user/keys                        ← save encrypted API keys to D1
GET  /api/user/usage                       ← credit usage summary
GET  /api/storyboards                      ← list user storyboards
POST /api/storyboards                      ← save/upsert storyboard
GET  /api/storyboards/:id                  ← get single storyboard
DELETE /api/storyboards/:id               ← delete storyboard
POST /api/storyboards/:id/scenes           ← upsert scene asset

-----

## REQUEST HEADERS (from localStorage settings)

AWS:       X-AWS-Access-Key-Id, X-AWS-Secret-Access-Key
X-Brain-Region (us-east-1), X-Image-Region (us-east-1 or us-west-2)
Dashscope: X-Dashscope-Api-Key

-----

## WORKER SECRETS (wrangler secret put)

# Internal use only (R2 storage, NOT for user generation routes)
AWS_ACCESS_KEY_ID       ← R2 ops only — extractCredentials NO LONGER uses this for generation
AWS_SECRET_ACCESS_KEY   ← R2 ops only
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_ACCOUNT_ID
R2_BUCKET_NAME
R2_PUBLIC_URL

# Auth
CLERK_SECRET_KEY        ← from clerk.dev dashboard
CLERK_JWKS_URL          ← https://[app-slug].clerk.accounts.dev/.well-known/jwks.json

# Optional server-side (not used as fallback since v3.3)
DASHSCOPE_API_KEY       ← kept in env but NOT used as user fallback

## AUTH — Clerk

Use DEVELOPMENT keys (pk_test_) for .pages.dev domains.
pk_live_ requires a custom domain — .pages.dev subdomain can't be created.

Dev VITE_CLERK_PUBLISHABLE_KEY starts with pk_test_
Set in .env.local AND Cloudflare Pages → Settings → Environment Variables

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
Text:    #1d1d1f (primary), rgba(60,60,67,0.6) (secondary)
Orange:  #ff6b35 (generate buttons, gradient to #ff4500)
Blue:    #007aff (video, links)
Green:   #34c759 (success, download)
Purple:  #af52de (audio)
Red:     #ff3b30 (error)
Qwen:    #ff8c00 (Qwen tag badge)

Tag Badges:
AWS:  bg rgba(0,122,255,0.15), color #007aff
Qwen: bg rgba(255,140,0,0.15), color #ff8c00

-----

## DESKTOP LAYOUT (≥ 768px)

Storyboard: 2-column grid
Left 320px:  scene thumbnail list (click to activate)
Right flex:  active scene detail scrollable

Home: max-width 600px centered

Responsive:
const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768)

-----

## VIDEO POLLING

Both Nova Reel + Wan2.1 are async (2–5 min):

1. POST start → get job_id/task_id
1. Save to localStorage: key = video_job_{projectId}_{sceneNum}
1. Poll every 10s, timeout 10min
1. On done: download → re-upload R2 → return public URL

-----

## VO DURATION CONSTRAINT

Indonesian: ~15 chars/sec | English: ~18 chars/sec
charLimit = Math.floor(durationSeconds * charsPerSecond)
Brain prompt includes char limit per scene.
POST /api/brain/rewrite-vo → { rewritten_text, char_count, char_limit, fits }

-----

## LIGHTBOX IMAGE VIEWER

Tap image → fixed overlay modal (rgba(0,0,0,0.92))
Close ✕ top-right, scene label top-left, download bottom-center.
img: max-width 100%, max-height 90vh, borderRadius 16px.

-----

## MODEL SELECTOR FLOW

Home.tsx: image model + video model selector (scrollable pill row)
On submit: sessionStorage.setItem(‘selected_image_model’, imageModel)
Storyboard: reads on load → pre-fills ALL scene defaults
User can override per scene from card dropdown.

-----

## DEPLOYMENT

npm run build          ← must show 0 TypeScript errors
wrangler deploy        ← deploy Worker
git push origin main   ← triggers Cloudflare Pages deploy
wrangler tail          ← live Worker logs

-----

## CODING RULES

1. TypeScript strict — run npx tsc –noEmit, fix ALL errors before deploy
1. ALWAYS use buildCanonicalUri() — never url.pathname directly
1. buildCanonicalUri: encodeURIComponent(decoded) ONLY — NO .replace(/%3A/gi, ':')
1. NEVER send img_url to Dashscope t2i or t2v models
1. NEVER use invalid model IDs — verify against list above
1. NEVER hardcode API keys — use wrangler secrets or localStorage
1. wan2.6-image uses messages[] format — not input.prompt
1. Dashscope size: use * not x (768*1280 not 768x1280)
1. Dashscope URLs expire 24h — always re-upload to R2
10. Nova Reel: us-east-1 ONLY | SD 3.5: us-west-2 ONLY
11. After every change: npm run build → 0 errors required
12. video_prompt.full_prompt max 200 chars — starts with camera movement
13. video.ts ARN path: encodeURIComponent(arn) WITHOUT .replace — colons must be %3A
14. NEVER use env.AWS_ACCESS_KEY_ID as fallback in extractCredentials
15. All generation routes must call requireAwsKeys(creds) or requireDashscopeKey(creds)
16. localStorage per user: key = fuzzy_settings_{userId} NOT 'fuzzy_short_settings'
17. getApiHeaders(userId?) — always pass userId from useUser() hook

-----

## COMMON ERRORS & FIXES

“signature does not match” / canonical URI mismatch
→ aws-signature.ts: buildCanonicalUri must use encodeURIComponent(decoded) WITHOUT .replace(/%3A/gi, ‘:’)
→ “:” MUST be “%3A” in canonical URI — the .replace was the old bug

Nova Reel “UnknownOperationException”
→ video.ts ARN path: use encodeURIComponent(arn) WITHOUT .replace(/%3A/gi, ‘:’)
→ Literal colons in URL path break AWS routing to GetAsyncInvoke

“Model not exist” (Dashscope)
→ Wrong model ID. Check valid list above. wanx-v1 does not exist.
→ wanx2.1-t2i-plus removed — use qwen-image-2.0-pro instead

“url error, please check url” (Dashscope image)
→ Remove img_url from t2i requests. Only i2v needs img_url.

“InvalidParameter” from Dashscope wan2.6
→ Use messages[] format: input: { messages: [{role:’user’, content:[{text:prompt}]}] }

“AWS credentials required” (401 from Worker)
→ User must provide keys in Settings. Worker no longer falls back to env.AWS_ACCESS_KEY_ID.
→ Generation routes call requireAwsKeys(creds) — returns 401 if no header supplied.

“Clerk: Failed to load Clerk” / failed_to_load_clerk_js
→ Publishable key domain doesn’t resolve. Use pk_test_ for .pages.dev deployments.
→ pk_live_ requires a real custom domain — .pages.dev cannot host Clerk subdomains.
→ CLERK_JWKS_URL must match key’s domain: https://[slug].clerk.accounts.dev/.well-known/jwks.json

AWSCompromisedKeyQuarantineV3
→ AWS IAM Console → Users → Xklaa-pmpt → Permissions → Detach quarantine policy
→ Create new key. Never share keys in chat/screenshots.

-----

## GEMINI CLI USAGE TIPS

When given a task file (.md):
Read task file → execute tasks in order → report after each task

For TypeScript errors:
npx tsc –noEmit 2>&1 | head -30
Fix all errors before proceeding to next task

For Worker deployment:
wrangler deploy 2>&1 | tail -10
Then test with curl before marking task complete

Always commit after all tasks complete:
git add . && git commit -m “feat/fix: description” && git push origin main