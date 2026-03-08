# Fuzzy Short — Feature Implementation Reference

# Version 4.0 — Updated 2026-03-08

# This file documents the CURRENT implemented state of all major features.
# Read CLAUDE.md and GEMINI.md for project rules and deployment instructions.

-----

## IMPLEMENTED FEATURES (current state)

### Brain Generation — 6 Providers

All providers working via one of three endpoints:
- `/api/brain/generate` — AWS Bedrock (requireAwsKeys)
- `/api/dashscope/brain` — Qwen/Dashscope (requireDashscopeKey)
- `/api/brain/provider` — Gemini / Groq / OpenRouter / GLM (user key in headers or env fallback)

`brain-provider.ts` MODE A (body.story set, no body.system_prompt):
  - Strips `<think>...</think>` reasoning blocks (GLM-Z1, DeepSeek R1)
  - Strips ` ```json ``` ` markdown fences
  - Parses to JSON → returns storyboard directly (scenes at top level)
  - Matches format of `/api/brain/generate` response

`brain-provider.ts` MODE B (body.system_prompt set):
  - Returns `{ content, provider, model }` — used by Settings test buttons only

### Image Generation — 6 Models

| Model | Provider | Route | Notes |
|---|---|---|---|
| nova_canvas | AWS Bedrock | `/api/image/generate` | `amazon.nova-canvas-v1:0`, us-east-1 configurable |
| sd35 | AWS Bedrock | `/api/image/generate` | `stability.sd3-5-large-v1:0`, us-west-2 ONLY |
| qwen-image-2.0-pro | Dashscope | `/api/dashscope/image/start` | Async, no prompt_extend param |
| qwen-image-2.0 | Dashscope | `/api/dashscope/image/start` | Async, no prompt_extend param |
| wan2.6-image | Dashscope | `/api/dashscope/image/start` | Async, messages[] format |
| wanx2.1-t2i-turbo | Dashscope | `/api/dashscope/image/start` | Async, prompt_extend:true OK |

CRITICAL — Dashscope image parameters:
```typescript
const isQwenImage = model === 'qwen-image-2.0-pro' || model === 'qwen-image-2.0'
const parameters: Record<string, unknown> = { size, n: 1, negative_prompt }
if (!isQwenImage) {
  parameters.prompt_extend = true   // wanx/wan models only
  parameters.watermark = false
}
```

Size format uses `*` (NOT `x`): `768*1280`, `1280*768`, `1024*1024`, `864*1080`

Dashscope image polling (shared with video):
```
GET /api/v1/tasks/{task_id}
PENDING | RUNNING → return { status: 'processing' }
SUCCEEDED → results[0].url → download → re-upload to R2 (URLs expire in 24h!)
FAILED → return { status: 'error', message }
```

### Video Generation — 6 Models

| Model | Provider | Route | Type |
|---|---|---|---|
| nova_reel | AWS Bedrock | `/api/video/start` | async, invocationArn |
| wan2.6-i2v-flash | Dashscope | `/api/dashscope/video/start` | async, task_id |
| wanx2.1-i2v-turbo | Dashscope | `/api/dashscope/video/start` | async, task_id |
| wan2.6-t2v-flash | Dashscope | `/api/dashscope/video/start` | async, text-only |
| wan2.1-t2v-turbo | Dashscope | `/api/dashscope/video/start` | async, text-only |
| cogvideox-2 | ZhipuAI GLM | `/api/glm/video/start` | async, task_id |

GLM video routes:
- POST `/api/glm/video/start` — CogVideoX-2 async start (requireGlmKey)
- GET `/api/glm/video/status/:taskId` — CogVideoX-2 poll (requireGlmKey)

Video polling flow:
1. POST start → get `job_id` (ARN) or `task_id`
2. Save to localStorage: `video_job_{projectId}_{sceneNum}`
3. Poll every 10s, timeout 10min
4. On done: download → upload to R2 → return public URL

Nova Reel polling: `GET /api/video/status/{encodeURIComponent(arn)}`
  - `encodeURIComponent(arn)` WITHOUT `.replace(/%3A/gi, ':')` — colons MUST stay `%3A`

Dashscope video polling: `GET /api/dashscope/task/:taskId`
  - Checks `output.video_url` (video) vs `output.results[0].url` (image fallback)

Video prompt priority in `handleGenerateVideo`:
```
customVideoPrompt || videoPrompt.full_prompt || editedPrompts[sceneNum] || image_prompt
```

### Audio Generation — 2 Engines

Polly voices:
- `id-ID`: Marlene, Andika (neural)
- `en-US`: Ruth, Danielle (generative) + Joanna, Kimberly, Salli, Matthew, Joey, etc. (neural)

ElevenLabs voices: Bella, Adam, Rachel, Antoni, Josh, Arnold, Sam, Elli, Domi
ElevenLabs sliders per scene: `elStability`, `elSimilarity`, `elStyle`

Audio history: up to 3 previous audio clips stored per scene in `sceneAsset.audioHistory`

### Veo 3.1 Prompt Engine

Veo-compatible tones: `documentary_viral, natural_genz, informative, narrative_storytelling`

8 sub-tones (`worker/lib/veo-subtones.ts`):
  `human_story, field_report, day_in_life, social_experiment,
   product_moment, local_hero, ambient_scene, expert_insight`

`VeoPromptSection` component (src/components/VeoPromptSection.tsx):
- Props: `sceneNumber, veoPrompt, voScript, imagePrompt, tone, platform, brainModel, apiHeaders, onUpdate`
- `apiHeaders`: from `getApiHeaders(user?.id)` — includes all provider keys
- `brainModel`: from `storyboard.brain_model` (NOT hardcoded)
- `WORKER_URL`: imported from `'../lib/api'` (NOT from `import.meta.env`)
- Copy button: copies JSON when `showRaw=true`, plain text when `showRaw=false`

"Gen All Veo" button in Storyboard.tsx header:
- Visible only when `isVeoTone(storyboard.tone) === true`
- Iterates all scenes sequentially, uses `storyboard.brain_model`
- State: `generatingAllVeo: boolean`

Regeneration endpoint: `POST /api/brain/regenerate-veo-prompt`
```typescript
Body: { scene_number, vo_script, image_prompt, tone, sub_tone, platform, brain_model }
Response: { veo_prompt: { sub_tone, camera_locked, camera_instruction, starting_frame,
                          temporal_action, physics_detail, human_element, full_veo_prompt } }
```

### VO Duration Constraint

```
id: 15 chars/sec | en: 18 chars/sec
charLimit = Math.floor(durationSeconds * charsPerSecond)
```

Brain system prompt includes: `"Max narration: X characters for Y second scene"`
Rewrite endpoint: `POST /api/brain/rewrite-vo`
Returns: `{ rewritten_text, char_count, char_limit, fits }`

### Dark Mode

File: `src/lib/theme.tsx`
Toggle: button in Home.tsx header
Persists: `localStorage('fuzzy_theme')`

15 tokens via `tk(isDark)`:
```
pageBg, cardBg, cardBorder, cardShadow, headerBg, navBg, navBorder,
textPrimary, textSecondary, textTertiary, inputBg, inputBorder,
pillInactive, sectionBg, labelColor
```

Applied to: Home.tsx, Storyboard.tsx, Settings.tsx, Dashboard.tsx

RULES:
- `dropdownStyle` MUST be inside component after `tk()` call
- Never use `t` as map iterator when `t = tk(isDark)` is in scope — use `tn` or `tone`
- `select option` bg: `<style>` JSX tag required (inline styles can't target option)

### Scene Navigation Bar (Mobile)

Added in Storyboard.tsx:
```tsx
{!isDesktop && scenes.length > 1 && (
  <div style={{
    position: 'fixed', bottom: '65px', left: 0, right: 0,
    zIndex: 98,
    background: thm.headerBg,
    backdropFilter: 'blur(20px)',
    borderTop: thm.navBorder,
    padding: '8px 16px',
    display: 'flex', alignItems: 'center', gap: '10px',
  }}>
    <button onClick={() => setActiveScene(prev => Math.max(1, prev - 1))}
      disabled={activeScene <= 1} style={{ flex: 1, ... }}>
      <- Prev
    </button>
    <span>{activeScene} / {scenes.length}</span>
    <button onClick={() => setActiveScene(prev => Math.min(scenes.length, prev + 1))}
      disabled={activeScene >= scenes.length} style={{ flex: 1, ... }}>
      Next ->
    </button>
  </div>
)}
```

Mobile `paddingBottom`: `130px` (accounts for BottomNav 65px + scene nav bar)

### BottomNav

File: `src/components/BottomNav.tsx`
5 buttons (left to right): Create (`/`) / Projects (`/dashboard`) / Settings (`/settings`) / Queue (popup) / Dark (theme toggle)
Style: `position: fixed`, `bottom: 0`, `borderRadius: '20px 20px 0 0'`, `zIndex: 200`
All 5 buttons: `flex: 1`, `padding: '10px 0 7px'`
Uses `useTheme()` internally — no theme props needed.

Queue button (4th slot):
- Icon: ⏳ when tasks running, 📥 when idle
- Orange badge: running task count; green badge: done/minimized count
- Tapping opens popup panel: `bottom: 70px`, `zIndex: 199`
- Backdrop overlay: `zIndex: 198`, tap to dismiss
- Popup shows minimized sessions (Resume / ✕) + brain tasks (running=orange, done=green, error=red)
- "View" button on done tasks with `sessionId` → navigates to storyboard

CRITICAL: Queue badge computed as:
```typescript
const runningTasks = tasks.filter(task => task.status === 'running').length
```
Iterator MUST be `task` — NEVER `t` (shadows `t = tk(isDark)`)

`GenTaskBar.tsx` — file still exists but is NOT rendered (removed from `App.tsx` in v4.0).

### Queue Mode (Minimize/Resume)

1. User clicks "Minimize" → `updateSession(id, { isMinimized: true })` + `navigate('/')`
2. BottomNav Queue popup shows minimized sessions + brain tasks
3. "Resume" → `updateSession(id, { isMinimized: false })` + `navigate('/storyboard?id=ID')`
4. Video polling auto-restarts on Storyboard mount for any `videoStatus: 'generating'`
5. `activeSessionIdRef` (useRef) used in Storyboard to prevent stale closure in polling

### Storyboard Sessions (Multi-session)

- Zustand `storyboardSessionStore` — persisted, max 5 sessions (oldest pruned)
- Each session ID: `nanoid(8)` — URL: `/storyboard?id={ID}`
- `imageModel` widened to `string` (not union type) to support all providers
- Auto-save to D1 via `saveStoryboard()` after brain gen (non-blocking `.catch`)
- `saveSceneAsset()` after each asset gen

### Auth (Clerk + D1)

- `ClerkProvider` in `main.tsx`, `UserButton` in Dashboard header
- Auth guard in `App.tsx`: `isLoaded` spinner → `!isSignedIn → /auth`
- `useUserApi()` hook: `getToken()` JWT for D1 API calls
- D1 routes: `/api/user/profile`, `/api/user/keys`, `/api/user/usage`, `/api/storyboards/*`
- 500 free credits on first login via `ensureUser()`
- API keys stored encrypted (AES-GCM) in D1 `api_keys` table

### Settings Page Features

- `SecretInput` component: green border + checkmark when field has value
- Test buttons for: Gemini, Groq, OpenRouter, GLM (all call `/api/brain/provider` MODE B)
- `WORKER_URL` imported from `'../lib/api'` — never defined locally
- Theme toggle: dark/light mode switch

### Dashboard Page Features

- Cloud storyboard list from D1 (auth required)
- Local history from `historyStore`
- Credits badge in header
- Tone pills per storyboard card (8 tones with color coding)
- Optimistic delete

-----

## VALID MODEL IDs (do not guess — verify here)

### Brain

| Provider | Models |
|---|---|
| AWS | `us.anthropic.claude-sonnet-4-6`, `us.anthropic.claude-haiku-4-5-20251001`, `us.meta.llama4-maverick-17b-instruct-v1:0` |
| Dashscope | `qwen3-max`, `qwen-plus`, `qwen-flash`, `qwen-turbo`, `qwq-plus` |
| Gemini | `gemini-2.0-flash` (default), `gemini-2.0-flash-lite`, `gemini-1.5-flash`, `gemini-2.5-pro-exp-03-25` |
| Groq | `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `gemma2-9b-it`, `mixtral-8x7b-32768` |
| OpenRouter | `google/gemma-3-27b-it:free`, `meta-llama/llama-3.3-70b-instruct:free`, `deepseek/deepseek-r1:free`, `deepseek/deepseek-v3-0324:free` |
| GLM | `glm-4-flash`, `glm-4-flash-250414`, `glm-z1-flash`, `glm-4.6v` |

### Image

| ID | Provider | Notes |
|---|---|---|
| `nova_canvas` | AWS | `amazon.nova-canvas-v1:0` — us-east-1 configurable |
| `sd35` | AWS | `stability.sd3-5-large-v1:0` — us-west-2 ONLY |
| `qwen-image-2.0-pro` | Dashscope | No prompt_extend/watermark |
| `qwen-image-2.0` | Dashscope | No prompt_extend/watermark |
| `wan2.6-image` | Dashscope | messages[] input format |
| `wanx2.1-t2i-turbo` | Dashscope | prompt_extend: true OK |
| `cogview-3-flash` | GLM | Synchronous, free |

REMOVED: `amazon.titan-image-generator-v2:0` (deprecated), `wanx-v1` (never valid on dashscope-intl), `wanx2.1-t2i-plus` (replaced by qwen-image-2.0-pro), `cogview-4` (does not exist), `cogview-4-flash` (does not exist)

### Video

| ID | Provider | Notes |
|---|---|---|
| `nova_reel` | AWS | `amazon.nova-reel-v1:0` — us-east-1 ONLY |
| `wan2.6-i2v-flash` | Dashscope | image→video, best quality |
| `wanx2.1-i2v-turbo` | Dashscope | image→video, fast |
| `wan2.6-t2v-flash` | Dashscope | text→video, best quality |
| `wan2.1-t2v-turbo` | Dashscope | text→video, fast |

-----

## DEPLOYMENT CHECKLIST

Before every deploy:
```bash
npx tsc --noEmit          # 0 errors required
npm run build             # must succeed

wrangler deploy           # Worker

git add src/... worker/...  # specific files only
git commit -m "feat/fix: ..."
git push origin main        # Cloudflare Pages auto-deploys
```

After deploy:
- Hard refresh browser: Ctrl+Shift+R
- Check wrangler tail for Worker errors
- Test with curl if in doubt

-----

## KNOWN PATTERNS & GOTCHAS

### Variable shadowing in map iterators
```typescript
const t = tk(isDark)
// WRONG:
TONES.map(t => ...)          // shadows outer t
tasks.filter(t => ...)       // shadows outer t — badge always returns 0
// CORRECT:
TONES.map(tn => ...)         // use different name
tasks.filter(task => ...)    // queue badge works correctly
```

### dropdownStyle must be inside component
```typescript
// WRONG — cannot access theme at module level:
const dropdownStyle = { background: t.inputBg, ... }
export function Home() { ...

// CORRECT:
export function Home() {
  const { isDark } = useTheme()
  const t = tk(isDark)
  const dropdownStyle = { background: t.inputBg, ... }
  ...
```

### Dashscope qwen-image prompt_extend causes "url error"
```typescript
// qwen-image-2.0-pro and qwen-image-2.0 treat prompt_extend as a URL field
// DO NOT pass prompt_extend or watermark to these models
const isQwenImage = model === 'qwen-image-2.0-pro' || model === 'qwen-image-2.0'
const parameters: Record<string, unknown> = { size, n: 1, negative_prompt }
if (!isQwenImage) {
  parameters.prompt_extend = true
  parameters.watermark = false
}
```

### GLM image model name
```
cogview-3-flash   <- CORRECT (free, valid)
cogview-4         <- WRONG (does not exist, returns "模型不存在")
cogview-4-flash   <- WRONG (does not exist, returns "模型不存在")
```

### Expand/Collapse button contrast in dark mode
```typescript
// WRONG — hardcoded white invisible in dark mode:
background: 'rgba(255,255,255,0.8)'
// CORRECT:
background: 'var(--input-bg)'
color: 'var(--text-primary)'
fontWeight: 600
```

### brain-provider.ts MODE detection
```typescript
if (body.story && !body.system_prompt) {
  // MODE A: storyboard generation — parse and return JSON directly
  const clean = content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json|```/g, '')
    .trim()
  return Response.json(JSON.parse(clean), { headers: corsHeaders })
}
// MODE B: raw prompt — return { content, provider, model }
return Response.json({ content, provider: provider.id, model: brain_model }, { headers: corsHeaders })
```

### AWS SigV4 canonical URI
```typescript
// CRITICAL: ":" must be "%3A" in canonical URI
// CORRECT:
return encodeURIComponent(decoded)           // ":" → "%3A"
// WRONG:
return encodeURIComponent(decoded).replace(/%3A/gi, ':')  // breaks Nova Canvas
```

### ARN in video.ts GET URL path
```typescript
// CORRECT:
const arnForUrl = encodeURIComponent(arn)    // ":" stays "%3A"
// WRONG:
const arnForUrl = encodeURIComponent(arn).replace(/%3A/gi, ':')  // causes UnknownOperationException
```

### VeoPromptSection copy button
```typescript
// showRaw=true → copy full JSON object
// showRaw=false → copy full_veo_prompt plain text
const handleCopy = useCallback(async () => {
  if (!veoPrompt) return
  const text = showRaw
    ? JSON.stringify(veoPrompt, null, 2)
    : (veoPrompt.full_veo_prompt || '')
  if (!text) return
  await navigator.clipboard.writeText(text)
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
}, [veoPrompt, showRaw])

// Button label:
{copied ? 'Copied!' : showRaw ? 'Copy JSON' : 'Copy Prompt'}
```

-----

## CHANGELOG SUMMARY

| Version | Date | Key Changes |
|---|---|---|
| v4.0 | 2026-03-08 | GenTaskBar merged into BottomNav Queue popup, duration slider removed, cogview-4 fix, wan2.6-i2v-flash fallback fix, queue badge shadowing fix, expand button contrast fix |
| v3.9 | 2026-03-08 | Dark mode system, scene nav bar, Qwen image fix, GLM model fix, VeoPromptSection copy, BottomNav rounded corners, Wan 2.6 video |
| v3.8 | 2026-03-07 | Gemini header standardized, brain-provider MODE A JSON fix, <think> stripping, Gen All Veo, GLM-4.6V |
| v3.7 | 2026-03-07 | Multi-provider brain selector (6 providers), tone system (8 tones), Settings test buttons, Dashboard tone badges |
| v3.6 | 2026-03 | Veo 3.1 prompt engine, 8 sub-tones, VeoPromptSection component |
| v3.5 | 2026-03 | Brain system prompt rebuild (8 tones), brain-provider.ts handler |
| v3.4 | 2026-03 | Multi-provider foundation (providerModels.ts, providers.ts) |
| v3.3 | 2026-03 | Security: removed env.AWS key fallback, requireAwsKeys guard |
| v3.0 | 2026-03 | Auth (Clerk + D1), Dashboard, encrypted API keys, 500 free credits |
