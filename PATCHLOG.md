# Fuzzy Short — Patch Log

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
