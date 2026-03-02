# Fuzzy Short — Claude Code Instructions

## Project Overview

AI-powered short video production app.

- Frontend: React 18 + Vite + TypeScript → deployed to Cloudflare Pages (fuzzystuf.pages.dev)
- Backend: Cloudflare Workers (worker.officialdian21.workers.dev)
- Storage: Cloudflare R2 (igome-story-storage)
- AI: AWS Bedrock (Claude Sonnet 4.6 + Llama 4 Maverick)

## Stack

```
src/                  → React frontend
worker/               → Cloudflare Worker backend
worker/lib/           → AWS Signature V4, utilities
worker/brain.ts       → AI storyboard generation
worker/image.ts       → Image generation (Nova Canvas)
worker/video.ts       → Video generation (Nova Reel)
worker/audio.ts       → Audio/TTS (Polly + ElevenLabs)
src/pages/Home.tsx    → Main form page
src/pages/Settings.tsx → API key management
src/types/schema.ts   → Shared types
```

## CRITICAL RULES — Read Before ANY Code Change

### ❌ NEVER DO THIS

- Run `npm run dev` or any dev server
- Use `import type X` with verbatimModuleSyntax issues
- Use default exports for components (always named exports)
- Use `onSuccess` in TanStack Query v5 (deprecated)
- Encode `:` as `%3A` in AWS canonical URI path
- Use hardcoded AWS credentials in code
- Commit `.wrangler/` folder
- Use Hono or any HTTP framework in Worker (plain fetch only)
- Create subfolders inside `src/pages/` or `src/components/`

### ✅ ALWAYS DO THIS

- Named exports: `export function Home()` not `export default`
- Test build before commit: `npm run build 2>&1 | tail -20`
- Deploy worker: `wrangler deploy`
- Push frontend: `git add . && git commit -m "..." && git push`
- Use inline styles (not Tailwind) in all React components
- Read file before editing: `cat worker/brain.ts`

## AWS Bedrock — Model IDs (CORRECT)

```
Claude Sonnet 4.6:  us.anthropic.claude-sonnet-4-6
Llama 4 Maverick:   us.meta.llama4-maverick-17b-instruct-v1:0
```

## AWS Bedrock — Request Format (Claude)

```typescript
{
  anthropic_version: "bedrock-2023-05-31",
  max_tokens: 8192,
  system: systemPrompt,
  messages: [{ role: "user", content: prompt }]
}
// Response: data.content[0].text
```

## AWS Bedrock — Request Format (Llama)

```typescript
{
  prompt: "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n" 
    + systemPrompt 
    + "<|eot_id|><|start_header_id|>user<|end_header_id|>\n" 
    + userPrompt 
    + "<|eot_id|><|start_header_id|>assistant<|end_header_id|>",
  max_gen_len: 8192,
  temperature: 0.7
}
// Response: data.generation
```

## AWS Signature V4 — Critical Bug Fix

```typescript
// WRONG — encodes ":" as "%3A"
encodeURIComponent(segment)

// CORRECT — keep ":" literal in path
encodeURIComponent(segment).replace(/%3A/gi, ':')
```

## Worker — extractCredentials Pattern

```typescript
// Read from request headers FIRST, fallback to env
export function extractCredentials(request: Request, env: Env) {
  const h = request.headers
  return {
    geminiApiKey:        h.get('X-Gemini-Key')           || env.GEMINI_API_KEY || '',
    awsAccessKeyId:     h.get('X-AWS-Access-Key-Id')     || env.AWS_ACCESS_KEY_ID || '',
    awsSecretAccessKey: h.get('X-AWS-Secret-Access-Key') || env.AWS_SECRET_ACCESS_KEY || '',
    brainRegion:        h.get('X-Brain-Region')          || 'us-east-1',
    imageRegion:        h.get('X-Image-Region')          || 'us-east-1',
    audioRegion:        h.get('X-Audio-Region')          || 'us-west-2',
    videoRegion:        'us-east-1', // FIXED for Nova Reel
  }
}
```

## CORS — Required Headers

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Gemini-Key, X-AWS-Access-Key-Id, X-AWS-Secret-Access-Key, X-Brain-Region, X-Image-Region, X-Audio-Region, X-ElevenLabs-Key, X-Runway-Key',
}
// Handle OPTIONS preflight at the TOP of fetch handler
if (request.method === 'OPTIONS') {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

## Frontend — API Headers Pattern

```typescript
// Load from localStorage and inject as headers
const stored = localStorage.getItem('fuzzy_short_settings')
const keys = stored ? JSON.parse(stored) : {}
const apiHeaders: Record<string, string> = {}
if (keys.geminiApiKey)        apiHeaders['X-Gemini-Key'] = keys.geminiApiKey
if (keys.awsAccessKeyId)      apiHeaders['X-AWS-Access-Key-Id'] = keys.awsAccessKeyId
if (keys.awsSecretAccessKey)  apiHeaders['X-AWS-Secret-Access-Key'] = keys.awsSecretAccessKey
if (keys.brainRegion)         apiHeaders['X-Brain-Region'] = keys.brainRegion
```

## UI Style — Inline Styles on Navy Background

```typescript
// Page background (navy gradient)
background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1527 40%, #0a1020 100%)'

// Glass card
background: 'rgba(255,255,255,0.08)'
backdropFilter: 'blur(24px) saturate(180%)'
WebkitBackdropFilter: 'blur(24px) saturate(180%)'
border: '1px solid rgba(255,255,255,0.15)'
borderRadius: '20px'
boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)'

// Input
background: 'rgba(255,255,255,0.05)'
border: '1px solid rgba(239,225,207,0.1)'
color: '#EFE1CF'

// Orange accent
color: '#F05A25'
boxShadow: '0 0 28px rgba(240,90,37,0.45)'

// Blue accent
color: '#3FA9F6'
```

## Deployment Commands

```bash
# Deploy Worker
wrangler deploy

# Build + Deploy Frontend
npm run build
git add .
git commit -m "feat/fix: description"
git push origin main

# Check Worker secrets
wrangler secret list

# Test Worker endpoint
curl -X POST https://fuzzy-vid-worker.officialdian21.workers.dev/api/brain/generate \
  -H "Content-Type: application/json" \
  -H "X-AWS-Access-Key-Id: YOUR_KEY" \
  -H "X-AWS-Secret-Access-Key: YOUR_SECRET" \
  -H "X-Brain-Region: us-east-1" \
  -d '{"title":"test","story":"test story","platform":"youtube_shorts","brain_model":"claude_sonnet","language":"id","art_style":"cinematic_realistic","total_scenes":3}'
```

## Current Status

```
✅ Brain generate (Claude Sonnet 4.6 via Bedrock)
✅ UI — navy gradient + glass cards
✅ Settings page — API keys per service
✅ Aspect ratio selector (9:16 / 16:9 / 1:1 / 4:5)
✅ Storyboard display page with scene cards
✅ Image generation per scene (Nova Canvas + Titan V2)
✅ Titan V2 preset dimensions fix (non-square aspect ratios)
✅ AI prompt enhancement before image gen (/api/image/enhance-prompt)
✅ Enhanced prompt display badge per scene
✅ Video generation per scene (Nova Reel async)
✅ /api/video/start — new endpoint with duration_seconds param
✅ /api/video/status/ — unified ARN + KV routing
✅ Per-scene duration slider (2–6s) for video generation
✅ Total duration control (15–120s) with auto-redistribute
✅ Video job localStorage persistence (saveVideoJob/loadVideoJob)
✅ Audio/narration per scene (Polly + ElevenLabs)
✅ Generation overlay animation (framer-motion)
✅ Cost tracker (session-only, per-service breakdown)
✅ Save to history + History page (localStorage)
✅ SPA routing (ASSETS binding fallback)
✅ Queue mode — minimize session, resume from GenTaskBar
✅ Scene collapse/expand + editable image prompts
✅ Preview modal (image lightbox + video autoplay)
⬜ Fix Llama 4 (signature %3A bug)
⬜ Fix Gemini (API down)
```

## Wrangler Secrets Set

```
✅ GEMINI_API_KEY
✅ AWS_SECRET_ACCESS_KEY
✅ ELEVENLABS_API_KEY
✅ R2_ACCESS_KEY_ID
✅ R2_ACCOUNT_ID
✅ R2_SECRET_ACCESS_KEY
⚠️ AWS_ACCESS_KEY_ID — verify still valid
```

## Worker URL

```
https://fuzzy-vid-worker.officialdian21.workers.dev
```

## Pages URL

```
https://fuzzystuf.pages.dev
```