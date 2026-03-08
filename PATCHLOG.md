# Fuzzy Short — Patch Log

---

## v4.0 — 2026-03-08

**Feat: Queue popup in BottomNav + bug fixes (commits 41be06e, 0d7bdcf, 9b4e8cc)**

### Feature — GenTaskBar merged into BottomNav Queue popup

- **`src/components/BottomNav.tsx`** — 5 equal-width buttons added: Create / Projects / Settings / Queue / Dark. All `flex: 1`, `padding: '10px 0 7px'`.
- **`src/App.tsx`** — Removed `GenTaskBar` import and render (`GenTaskBar.tsx` file still exists but is unused).
- Queue button (4th slot): icon ⏳ when running, 📥 when idle. Orange badge = running count, green badge = done/minimized count.
- Tapping Queue opens popup panel at `bottom: 70px`, `zIndex: 199`. Backdrop overlay at `zIndex: 198` dismisses on tap outside.
- Popup lists minimized sessions (Resume + ✕) and brain tasks (colored by status). Done tasks with `sessionId` show "View" button → navigate to storyboard.

### Feature — Duration slider removed from video card

- **`src/pages/Storyboard.tsx`** — `input[type=range]` duration slider removed from video output section. `sceneDurations` state still maintained for video start payloads. "Generate Video (Xs)" button label still reflects current duration.

### Fix — GLM image model `cogview-4` invalid

- **`src/pages/Home.tsx`**, **`src/pages/Storyboard.tsx`** — `cogview-4` removed from `IMAGE_MODELS` arrays. Only `cogview-3-flash` remains (label: "CogView-3 Flash", desc: "Free & fast").
- **`worker/glm.ts`** — default image model changed from `'cogview-4'` to `'cogview-3-flash'`.

### Fix — Dashscope video invalid fallback model

- **`worker/dashscope.ts`** — `handleDashscopeVideoStart` fallback changed from `'wan2.1-i2v-plus'` (invalid obsolete ID) to `'wan2.6-i2v-flash'`.

### Fix — BottomNav button alignment

- **`src/components/BottomNav.tsx`** — Queue button and Dark toggle both changed to `flex: 1`, `padding: '10px 0 7px'`. All 5 buttons now equal width.

### Fix — Queue badge variable shadowing

- **`src/components/BottomNav.tsx`** — `tasks.filter(t => t.status === 'running')` → `tasks.filter(task => task.status === 'running')`. `'t'` was shadowing `t = tk(isDark)`; filter always returned 0.

### Fix — Expand/Collapse button unreadable in dark mode

- **`src/pages/Storyboard.tsx`** — Scene card expand/collapse button:
  - `background: 'rgba(255,255,255,0.8)'` → `'var(--input-bg)'`
  - `color: 'var(--text-secondary)'` → `'var(--text-primary)'`
  - `fontWeight: 500` → `600`

### Files Changed
`src/App.tsx` · `src/components/BottomNav.tsx` · `src/pages/Home.tsx` · `src/pages/Storyboard.tsx` · `worker/dashscope.ts` · `worker/glm.ts`

---

## v3.9 — 2026-03-08

**Feat: full dark mode system + scene nav bar + Qwen/GLM model fixes + Wan 2.6 video**

### Dark Mode System

- **`src/lib/theme.tsx`** — `ThemeProvider`, `useTheme()` hook, `tk(isDark)` token function. 15 CSS variable tokens set on `:root`. Persisted to `localStorage('fuzzy_theme')`.
- Dark mode toggle moved to BottomNav (5th button). Also accessible from Home header.
- ALL page components (`Home.tsx`, `Storyboard.tsx`, `Settings.tsx`, `Dashboard.tsx`) use `useTheme()` + `tk(isDark)` — no hardcoded light-only colors.
- Rules: `dropdownStyle` inside component; `.map(t => ...)` → `.map(tn => ...)`; `select option` bg via `<style>` JSX tag.

### Scene Navigation Bar (mobile)

- **`src/pages/Storyboard.tsx`** — Fixed bar `bottom: 65px`, `zIndex: 98`, shows `← Prev`, `N / total`, `Next →` buttons. Hidden on desktop or single-scene storyboards. Mobile `paddingBottom`: `130px`.

### BottomNav rounded top corners

- **`src/components/BottomNav.tsx`** — `borderRadius: '20px 20px 0 0'`.

### Qwen image fix

- **`worker/dashscope.ts`** — `isQwenImage` detection prevents `prompt_extend` and `watermark` params for `qwen-image-2.0-pro` and `qwen-image-2.0` (these models treat `prompt_extend` as a URL string field).

### GLM model cleanup

- `cogview-4-flash` removed; `cogview-3-flash` confirmed as only valid GLM image model.

### Wan 2.6 video models added

- **`worker/dashscope.ts`**, **`src/pages/Storyboard.tsx`** — `wan2.6-i2v-flash` and `wan2.6-t2v-flash` added as best-quality options.

### VeoPromptSection copy button

- **`src/components/VeoPromptSection.tsx`** — context-aware: copies full JSON when `showRaw=true`, plain text `full_veo_prompt` when `showRaw=false`.

### brain-provider.ts MODE A/B fix

- **`worker/handlers/brain-provider.ts`** — MODE A (`body.story` set) returns storyboard JSON directly. Fixes GLM/Groq/OpenRouter storyboards that were redirecting back to homepage.

### Files Changed
`src/lib/theme.tsx` (new) · `src/App.tsx` · `src/main.tsx` · `src/components/BottomNav.tsx` · `src/components/VeoPromptSection.tsx` · `src/pages/Home.tsx` · `src/pages/Storyboard.tsx` · `src/pages/Settings.tsx` · `src/pages/Dashboard.tsx` · `worker/dashscope.ts` · `worker/handlers/brain-provider.ts` · `worker/glm.ts`

---

## v3.8 — 2026-03-07

**Fix: Gemini header + brain-provider MODE A JSON + Gen All Veo + GLM-4.6V**

### Gemini header standardized

- `X-Gemini-Key` → `X-Gemini-Api-Key` everywhere (frontend headers + worker extraction + CORS allowlist).

### brain-provider.ts MODE A JSON fix

- **`worker/handlers/brain-provider.ts`** — MODE A (`body.story` set, no `system_prompt`) now strips `<think>...</think>` and markdown fences, parses to JSON, and returns storyboard directly. Previously returned `{ content: "..." }` causing frontend to redirect back to homepage.

### `<think>` stripping

- **`worker/handlers/regenerate-veo-prompt.ts`** — strips `<think>...</think>` blocks from reasoning model outputs (GLM-Z1, DeepSeek R1) before `JSON.parse`.

### Gen All Veo button

- **`src/pages/Storyboard.tsx`** — "Gen All Veo" button added to header. Visible only when `isVeoTone(storyboard.tone) === true`. Iterates all scenes sequentially. State: `generatingAllVeo: boolean`.

### GLM-4.6V model

- **`worker/lib/providers.ts`**, **`src/lib/providerModels.ts`** — `glm-4.6v` (vision-language model) added to GLM provider.

### Files Changed
`src/lib/api.ts` · `src/lib/providerModels.ts` · `src/pages/Home.tsx` · `src/pages/Storyboard.tsx` · `src/pages/Settings.tsx` · `worker/index.ts` · `worker/handlers/brain-provider.ts` · `worker/handlers/regenerate-veo-prompt.ts` · `worker/lib/providers.ts`

---

## v3.7 — 2026-03-07

**Feat: multi-provider brain selector (6 providers, 29 models) + Settings test buttons + Dashboard tone badges**

### Multi-provider brain selector

- **`src/lib/providerModels.ts`** (new) — 29 brain models across 6 providers: AWS, Dashscope, Gemini, Groq, OpenRouter, GLM. `getModelsByProvider()`, `getModelById()`, `hasRequiredKey()` exports.
- **`src/pages/Home.tsx`** — Provider pill row (aws/dashscope/gemini/groq/openrouter/glm). Model `<select>` filtered by active provider. `brainModel: string` state (default `'gemini-2.0-flash'`).
- Submit routing: `aws` → `/api/brain/generate`, `dashscope` → `/api/dashscope/brain`, all others → `/api/brain/provider`.

### brain-provider.ts handler

- **`worker/handlers/brain-provider.ts`** (new) — universal OpenAI-compatible handler for Gemini, Groq, OpenRouter, GLM. Reads provider key from request headers.
- **`worker/lib/providers.ts`** (new) — `PROVIDERS` registry, `callProvider()`, `getProviderForModel()`.

### Settings test buttons

- **`src/pages/Settings.tsx`** — Test buttons for Gemini, Groq, OpenRouter, GLM. All call `/api/brain/provider` MODE B. `SecretInput` component with green border + checkmark when field has value.

### Dashboard tone badges

- **`src/pages/Dashboard.tsx`** — 8-tone color-coded pill per storyboard card. Credits badge in header.

### Tone system (8 tones)

- **`worker/lib/brain-system-prompt.ts`** (new) — `buildBrainSystemPrompt()` + `buildBrainUserPrompt()` with 8 tone presets: `documentary_viral, natural_genz, informative, narrative_storytelling, dramatic_cinematic, educational_explainer, comedy_entertainment, brand_commercial`.

### New Files
`src/lib/providerModels.ts` · `worker/handlers/brain-provider.ts` · `worker/lib/providers.ts` · `worker/lib/brain-system-prompt.ts`

### Files Changed
`src/pages/Home.tsx` · `src/pages/Settings.tsx` · `src/pages/Dashboard.tsx` · `worker/index.ts` · `worker/brain.ts`

---

## v3.3 — 2026-03-06

**Fix: Block Worker env key fallback + clear session on user change + API key warnings**

### Security Fix (critical)
- **`worker/index.ts` — `extractCredentials`** no longer falls back to `env.AWS_ACCESS_KEY_ID` / `env.AWS_SECRET_ACCESS_KEY` / `env.DASHSCOPE_API_KEY` for user-facing generation routes. Env secrets are now R2/D1 internal only.
- **`requireAwsKeys(creds)`** and **`requireDashscopeKey(creds)`** helper functions added. Every generation route calls the appropriate guard — returns `401 { error: "AWS credentials required…" }` if headers are missing.
- Routes guarded: `/api/brain/*`, `/api/image/*`, `/api/video/start`, `/api/audio/*`, `/api/dashscope/brain`, `/api/dashscope/image/start`, `/api/dashscope/video/start`.

### Session Isolation Fix
- **`src/App.tsx`** — `clearSessionData()` called when `user?.id` changes or user signs out. Clears `sessionStorage` (storyboard_result, model keys) and `localStorage` (`fuzzy_storyboard_sessions`, `video_job_*` keys).

### UI Improvements
- **`src/pages/Storyboard.tsx`** — `hasApiKeys` state: reads `fuzzy_settings_{userId}` on load. Shows red warning banner + disables Generate Image / Video / Audio buttons if no keys found.
- **`src/lib/api.ts`** — `generateImage`, `startVideoJob`, `generateAudio` now surface `error` field from 401 responses. Storyboard catch blocks show `"🔑 API key required — go to Settings"` for credential errors.

### Files Changed
`worker/index.ts` · `src/App.tsx` · `src/lib/api.ts` · `src/pages/Storyboard.tsx`

---

## v3.2 — 2026-03-06

**Fix: Isolate API keys per user — localStorage keyed by userId**

### Root Cause
Settings used shared `fuzzy_short_settings` localStorage key → all users on same device shared API keys.

### Changes
- **`src/lib/api.ts`** — `getApiHeaders(userId?)` accepts optional userId. Reads `fuzzy_settings_{userId}` when provided, falls back to legacy `fuzzy_short_settings`. Added `clearUserSessionData(userId)` utility.
- **`src/pages/Settings.tsx`** — useEffect depends on `user?.id`. One-time migration: removes old shared key and sets `migrated_{userId}` flag. Loads D1 first then user-specific localStorage. `handleSave` writes to `fuzzy_settings_{userId}` and calls `updatePreferences` for cloud sync.
- **`src/pages/Home.tsx`** — Added `useUser`. useEffect reads user-specific key + pre-fills language/artStyle/model defaults. `handleSubmit` reads user-specific storage key for API headers.
- **`src/pages/Storyboard.tsx`** — Added `useUser`. All 3 `getApiHeaders()` calls pass `user?.id`.

### Security
```
BEFORE: 'fuzzy_short_settings' — shared by all users on device ❌
AFTER:  'fuzzy_settings_{userId}' — isolated per user ✅
D1:     primary source (encrypted api_keys table)
localStorage: offline fallback per user
```

### Files Changed
`src/lib/api.ts` · `src/pages/Settings.tsx` · `src/pages/Home.tsx` · `src/pages/Storyboard.tsx`

---

## v3.1 — 2026-03-06

**Fix: Switch Clerk to development keys for .pages.dev deployment**

### Root Cause
`pk_live_` key encoded `clerk.fuzzystuf.pages.dev` as Frontend API domain. Cloudflare does not allow custom subdomains on `.pages.dev` — the subdomain can never resolve, so Clerk JS fails to load.

### Changes
- **`.env.local`** — `VITE_CLERK_PUBLISHABLE_KEY` changed from `pk_live_` to `pk_test_` (honest-squid-92.clerk.accounts.dev).
- **Worker secrets updated** — `CLERK_SECRET_KEY` + `CLERK_JWKS_URL` updated to match dev app.

### Rule Going Forward
Use `pk_test_` keys for `.pages.dev` deployments. Only switch to `pk_live_` when a real custom domain (not `.pages.dev`) is configured.

### Files Changed
`.env.local`

---

## v3.0 — 2026-03-05

**Feat: Clerk auth + Cloudflare D1 cloud sync + dashboard**

### Changes
- **Clerk authentication** — Email OTP + Google OAuth via `@clerk/clerk-react`. App gate: unauthenticated users see Auth page (sign-in/sign-up with iOS 26 Liquid Glass styling). `ClerkProvider` wraps app in `main.tsx`.
- **Cloudflare D1 database** — `fuzzy-short-db` SQLite database with 5 tables: `users`, `api_keys`, `storyboards`, `scene_assets`, `usage_log`.
- **D1 migration** — `worker/migrations/001_init.sql` with full schema + indexes.
- **`worker/lib/auth.ts`** — Clerk JWT verification via JWKS (cached 1hr on CF edge). `verifyClerkJWT` + `ensureUser` (upserts user on every protected request, 500 free credits on first login).
- **`worker/db.ts`** — All D1 operations: profile, preferences, AES-GCM encrypted API keys, storyboards CRUD, scene assets upsert (COALESCE pattern), usage log. `CREDIT_COSTS`: brain=20, image=10, video=50, audio=5, enhance=2.
- **Credit system** — `deductCredits` called in worker routes; brain routes check before generation (returns 402 on insufficient); image/video/audio deduct after success via `ctx.waitUntil`.
- **CORS updated** — Added `PUT`, `DELETE` methods and `Authorization` header.
- **`src/lib/userApi.ts`** — `useUserApi()` hook with `getToken()` JWT for all D1 API calls.
- **Dashboard page** (`/dashboard`) — Lists saved storyboards with credits badge, delete (optimistic), platform/language/scene metadata. `UserButton` in header.
- **Settings** — Loads API keys from D1 on mount (falls back to localStorage), saves to D1 + localStorage. Shows cloud/offline save status. `UserButton` in header.
- **Auto-save storyboard** — Home.tsx calls `saveStoryboard()` non-blocking after brain generation.
- **Auto-save scene assets** — Storyboard.tsx calls `saveSceneAsset()` after each image/video/audio generation.
- **Auth guard** — `App.tsx` shows loading spinner, then Auth page if not signed in.

### New Files
`worker/lib/auth.ts` · `worker/db.ts` · `worker/migrations/001_init.sql` · `src/lib/userApi.ts` · `src/pages/Auth.tsx` · `src/pages/Dashboard.tsx`

### Files Changed
`wrangler.toml` · `worker/index.ts` · `src/main.tsx` · `src/App.tsx` · `src/pages/Settings.tsx` · `src/pages/Home.tsx` · `src/pages/Storyboard.tsx`

### Setup Required (manual)
1. Create Clerk app at clerk.dev (Email OTP + Google OAuth)
2. Add `VITE_CLERK_PUBLISHABLE_KEY` to `.env.local`
3. `wrangler secret put CLERK_SECRET_KEY` + `wrangler secret put CLERK_JWKS_URL`
4. `wrangler d1 create fuzzy-short-db` → update `database_id` in `wrangler.toml`
5. `wrangler d1 execute fuzzy-short-db --file=worker/migrations/001_init.sql --remote`

---

## v2.5 — 2026-03-05

**Feat: smart video prompt per scene + interactive generation animations**

### Changes
- **Brain generates `video_prompt` per scene** — each scene in the storyboard JSON now includes a structured `video_prompt` object: `motion`, `subject_action`, `atmosphere`, `camera`, `pacing`, `full_prompt`.
- **`full_prompt` used for video generation** — `handleGenerateVideo` now uses `customVideoPrompt || videoPrompt.full_prompt || editedPrompts || image_prompt` priority chain (both Dashscope and Nova Reel branches).
- **Regenerate Video Prompt per scene** — new endpoint `POST /api/brain/regenerate-video-prompt` supports both Bedrock (Claude Sonnet 4.6) and Dashscope Qwen models. Button in the collapsible Video Prompt section.
- **Video Prompt section UI** — collapsible panel per scene (default collapsed). Expanded: Text/JSON tab toggle, motion/pacing/camera breakdown pills, subject action + atmosphere display, editable `full_prompt` textarea (200 char max + counter), Regenerate + Reset buttons.
- **Image shimmer placeholder** — animated gradient shimmer with pulsing 🖼️ icon and progress bar shown while image is generating.
- **Animated video generating indicator** — film-strip progress bars (poll-driven), spinning 🎬 icon, elapsed time display (`~Xs elapsed`), replaces plain text indicator.
- **CSS keyframes injected once on mount** — `shimmer`, `pulse-ring`, `spin`, `float-up`, `progress-bar`, `gradient-flow`.
- **`VideoPromptData` type** — added to `src/types/schema.ts`; `SceneAssets` extended with `videoPrompt?` and `customVideoPrompt?`.

### New Endpoint
`POST /api/brain/regenerate-video-prompt` — regenerates `video_prompt` for a single scene using brain model (Bedrock Claude or Qwen). Accepts: `image_prompt`, `enhanced_prompt?`, `mood`, `camera_angle`, `scene_type`, `duration_seconds`, `narration`, `art_style`, `aspect_ratio`, `scene_number`, `brain_model?`.

### Files Changed
`worker/brain.ts` · `worker/index.ts` · `src/lib/api.ts` · `src/types/schema.ts` · `src/pages/Storyboard.tsx` · `CLAUDE.md` · `GEMINI.md`

---

## v2.4 — 2026-03-05

**Feat: add qwen-image-2.0-pro and qwen-image-2.0 as primary Dashscope image models**

### Changes
- **New image models** — `qwen-image-2.0-pro` (⭐ Pro, best quality) and `qwen-image-2.0` (✨ New, balanced) added as the primary Dashscope image options.
- **`wanx2.1-t2i-plus` removed** — replaced by `qwen-image-2.0-pro`. `wanx2.1-t2i-turbo` retained as a legacy fast option.
- **Default model updated** — `handleDashscopeImageStart` fallback changed from `wanx2.1-t2i-turbo` → `qwen-image-2.0-pro`.
- Both new models use standard `input: { prompt }` format (same as `wanx2.1-t2i-turbo`). `wan2.6-image` still uses `messages[]` format — no logic changes needed.

### Image Models (updated)
| ID | Label | Provider |
|----|-------|----------|
| `nova_canvas` | Nova Canvas | AWS Bedrock |
| `sd35` | SD 3.5 Large | AWS Bedrock |
| `qwen-image-2.0-pro` | Qwen Image 2.0 Pro ⭐ | Dashscope |
| `qwen-image-2.0` | Qwen Image 2.0 ✨ | Dashscope |
| `wan2.6-image` | Wan 2.6 Image 🆕 | Dashscope |
| `wanx2.1-t2i-turbo` | Wanx 2.1 Turbo ⚡ | Dashscope |

### Files Changed
`worker/dashscope.ts` · `src/pages/Home.tsx` · `src/pages/Storyboard.tsx` · `CLAUDE.md`

---

## v2.3 — 2026-03-05

**Fix: restore wanx2.1 models + Nova Reel ARN encoding + model controls UI**

### Bug Fixes
- **Nova Reel `UnknownOperationException`** — `worker/video.ts` lines 131 + 319: removed `.replace(/%3A/gi, ':')` from `arnForUrl`. ARN is now fully percent-encoded so AWS correctly routes `GetAsyncInvoke`.
- **Dashscope "Model not exist"** — restored `wanx2.1-t2i-turbo`, `wanx2.1-t2i-plus`, `wan2.6-image` in `worker/dashscope.ts`. `wanx-v1` was never valid on `dashscope-intl.aliyuncs.com`. `wan2.6-image` uses `messages[]` input format; others use standard `{ prompt }`.

### New Features
- **Per-model video controls** — Nova Reel: optional seed input. Wan2.1: prompt_extend toggle (default on). Backend accepts both params.
- **Language-aware Polly voices** — Indonesian shows `[Marlene, Andika]`; English shows `[Ruth, Danielle, Joanna, Kimberly, Salli, Kendra, Matthew, Joey, Stephen, Gregory]`. Default voice: `id` → Marlene, `en` → Ruth.
- **ElevenLabs voice settings sliders** — stability, similarity boost, style (0–1) shown when ElevenLabs engine is selected. Passed through to API.
- **Expanded voice lists** — ElevenLabs: 9 voices (Bella, Adam, Rachel, Antoni, Josh, Arnold, Sam, Elli, Domi). Polly: 12 voices across both languages.

### Image Models (updated)
| ID | Label | Provider |
|----|-------|----------|
| `nova_canvas` | Nova Canvas | AWS Bedrock |
| `sd35` | SD 3.5 Large | AWS Bedrock |
| `wanx2.1-t2i-turbo` | Wanx 2.1 Turbo ⚡ | Dashscope |
| `wanx2.1-t2i-plus` | Wanx 2.1 Plus ⭐ | Dashscope |
| `wan2.6-image` | Wan 2.6 🆕 | Dashscope |

### Files Changed
`worker/video.ts` · `worker/dashscope.ts` · `worker/audio.ts` · `src/lib/api.ts` · `src/pages/Home.tsx` · `src/pages/Storyboard.tsx` · `CLAUDE.md` · `GEMINI.md`

---

## v2.2 — 2026-03-05

**Fix: SigV4 %3A encoding + wanx-v1 restore + remove broken wanx2.1/wan2.6 models**

- Fixed AWS SigV4 canonical URI: `buildCanonicalUri` now uses `encodeURIComponent(decoded)` without `.replace(/%3A/gi, ':')` — colons must be `%3A` in canonical URI, not literal. This fixed Nova Canvas failures.
- Temporarily restored `wanx-v1` as the only Dashscope image model (wanx2.1 and wan2.6 were suspected to be unavailable on international endpoint — later found to be incorrect, reverted in v2.3).
- Updated `CLAUDE.md` v2.0: full model list, Dashscope rules, iOS 26 design tokens, desktop layout.

---

## v2.1 — 2026-03-04

**Fix: valid Dashscope model IDs + wan2.6 messages format + canonical URI hardening**

- Corrected Dashscope image model IDs; added `wan2.6-image` with `messages[]` input format.
- `buildCanonicalUri` hardened to decode-then-re-encode each path segment.
- SD 3.5 replaces Titan V2 as AWS image model.
- Model lists synced between `CLAUDE.md`, `worker/dashscope.ts`, `src/pages/Home.tsx`, and `src/pages/Storyboard.tsx`.

---

## v2.0 — 2026-03-04

**Feat: Qwen Dashscope Singapore integration**

- Added `worker/dashscope.ts`: brain (5 Qwen models), image (Wanx), video (Wan2.1 i2v/t2v), shared async task poll + R2 re-upload.
- Home.tsx: `BRAIN_MODELS` selector includes Qwen models with tag badges.
- Storyboard.tsx: `IMAGE_MODELS` and `VIDEO_MODELS` include Dashscope options. `startDashscopePolling()` for async image + video tasks.
- Settings: `dashscopeApiKey` field added.
- `DASHSCOPE_API_KEY` wrangler secret; `X-Dashscope-Api-Key` header in CORS allowlist.

---

## v1.9 — 2026-03-03

**Fix: Dashscope negative_prompt + AWS sig hardening + image/video selectors + lightbox + desktop layout**

- `negative_prompt` moved to `parameters` (not `input`) for Wanx t2i.
- AWS SigV4 signing hardened; `%3A` vs `:` colon handling clarified in canonical URI.
- Image and video model selectors added to Home.tsx (scrollable pill row).
- Lightbox image viewer: tap image → fullscreen modal with download button.
- Desktop 2-column layout (≥768px): 300px thumbnail list + detail panel.
- `img_url` trim check for Dashscope i2v (prevents empty string from being sent).

---

## v1.8 — 2026-03-02

**Fix: image signature + toast dismiss + JSON prompt toggle + anti-hallucination brain**

- Nova Canvas signing fixed; toast auto-dismiss.
- Per-scene image prompt toggle: Text view / JSON debug view.
- Brain prompt updated with anti-hallucination instructions.

---

## v1.7 — 2026-03-02

**Fix: image signature + iOS 26 UI + duration VO constraint + rewrite VO**

- AWS SigV4 canonical URI fix for image endpoints.
- iOS 26 Liquid Glass design system applied across all pages.
- VO narration duration constraint: `charLimit = floor(durationSeconds × charsPerSec)`.
- `POST /api/brain/rewrite-vo` endpoint added; per-scene rewrite button in UI.

---

## v1.6 — 2026-03-01

**Feat: prompt enhancement, duration sliders, Nova Reel ARN polling**

- `POST /api/image/enhance-prompt` — Claude enhances raw image prompts before generation.
- Per-scene duration sliders (2–6s).
- Nova Reel async polling via `invocationArn`; `GET /api/video/status/:jobId` with KV storage.
- `errorCount` tracking in KV: after 5 consecutive Bedrock errors → marks job `failed`.

---

## v1.5 — 2026-02-28

**Feat: queue mode, editable prompts, preview modal, video cancel**

- "Minimize" button on storyboard → sets `isMinimized: true` in session store, navigates to `/`.
- `GenTaskBar` shows minimized sessions with "Resume" button.
- Editable `image_prompt` textarea per scene (orange border when edited; Reset button).
- Preview modal: click image → fullscreen lightbox; click video → modal with autoplay.
- Video cancel button stops polling and marks scene as error.
- Collapse/expand toggle per scene card.

---

## v1.4 — 2026-02-27

**Feat: voice selector + audio history, interactive cost tracker, model dropdowns**

- Per-scene audio voice selector (Polly + ElevenLabs voices).
- Audio history: last 5 takes per scene with individual playback + download.
- Interactive cost tracker bar: per-service totals, click to filter by service.
- Video + image model dropdowns per scene (override global default).
- Video download MP4 + image download PNG buttons.

---

## v1.3 — 2026-02-26

**Feat: storyboard session store + multi-session queue**

- `storyboardSessionStore` (Zustand, persisted): sessions keyed by nanoid(8), URL `?id=SESSION_ID`, max 5 sessions.
- `genTaskStore`: in-memory brain generation tasks with session link.
- `costStore`: per-session cost tracking.
- `historyStore`: persisted saved storyboards list.
- Storyboard URL uses `?id=` query param; fallback reads `sessionStorage.storyboard_result`.

---

## v1.2 — 2026-02-25

**Feat: image/video/audio generation per scene**

- `POST /api/image/generate` — Nova Canvas + Titan V2 (later replaced by SD 3.5).
- `POST /api/video/generate` — Nova Reel async start; KV job polling.
- `POST /api/audio/generate` — AWS Polly (neural/generative) + ElevenLabs.
- R2 upload for all generated assets; public URL returned.
- Per-scene status badges: idle / generating / done / error.

---

## v1.1 — 2026-02-24

**Feat: storyboard page + brain generation**

- `POST /api/brain/generate` — Claude Sonnet / Llama 4 Maverick via AWS Bedrock.
- Storyboard page reads `sessionStorage`, renders scene cards with narration, image prompt, camera angle, transition.
- Generation overlay with step indicators and elapsed timer.
- History page saves generated storyboards.

---

## v1.0 — 2026-02-23

**Feat: initial foundation**

- React + TypeScript + Vite frontend → Cloudflare Pages.
- Cloudflare Worker backend with KV + R2 bindings.
- AWS SigV4 manual signing (`worker/lib/aws-signature.ts`).
- Home page: story input, platform selector, aspect ratio, art style, brain model selector.
- Settings page: AWS keys, Gemini key, ElevenLabs key, regions.
- iOS 26 Liquid Glass design system.
- Live: `fuzzystuf.pages.dev` · Worker: `fuzzy-vid-worker.officialdian21.workers.dev`
