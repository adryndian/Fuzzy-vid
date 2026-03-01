# 🎬 FUZZY SHORT — Gemini CLI Master Instructions

-----

## 🤖 CARA KERJA GEMINI CLI — WAJIB BACA

```
Kamu adalah Senior Full-Stack Engineer untuk project Fuzzy Short.
Working directory SELALU: ~/Fuzzy-vid (repo root)
SELALU jalankan: pwd sebelum mulai coding

WORKFLOW WAJIB untuk setiap task:
1. Baca instruksi task
2. Cek file yang relevan dulu sebelum edit
3. Buat perubahan
4. Test: npm run build 2>&1 | tail -20
5. Kalau clean: git add . && git commit -m "..." && git push
6. JANGAN stop sebelum build clean dan pushed
```

-----

## 🚫 LARANGAN KERAS

```
❌ JANGAN jalankan: npm run dev / npm start / vite
❌ JANGAN buat subfolder baru di root (fuzzy-vid/, app/, dst)
❌ JANGAN install: hono, axios, express, atau framework tidak dikenal
❌ JANGAN gunakan onSuccess di useQuery (TanStack Query v5 tidak support)
❌ JANGAN gunakan AWS SDK (pakai manual Signature V4)
❌ JANGAN taruh API keys di frontend atau VITE_ prefix
❌ JANGAN gunakan default export untuk komponen — pakai named export
```

-----

## ✅ ATURAN WAJIB

```
✅ Selalu: import { cloudflare } from '@cloudflare/vite-plugin'
✅ Selalu: import type { TypeName } untuk TypeScript types
✅ Selalu: /// <reference types="vite/client" /> di api.ts
✅ Selalu: named export → export { ComponentName }
✅ Selalu: test build setelah setiap perubahan
✅ Selalu: commit setelah build clean
```

-----

## 🏗️ TECH STACK

```
Frontend:
  React 18 + Vite + TypeScript (strict: false — sudah diset)
  Tailwind CSS + Shadcn/UI
  Zustand v5 (global state)
  TanStack Query v5 (ALL API calls + polling)
  React Router v6
  Framer Motion

Backend:
  Cloudflare Workers via @cloudflare/vite-plugin
  Cloudflare R2 → bucket: igome-story-storage
  Cloudflare KV → id: fc732a268ca9435b8de8e50f34a35365
```

-----

## 📁 STRUKTUR PROJECT

```
~/Fuzzy-vid/
├── src/
│   ├── components/
│   │   ├── glass/      → GlassCard, GlassButton, GlassInput, GlassModal, GlassBadge
│   │   ├── layout/     → Header, AppLayout
│   │   ├── forms/      → StoryInputForm
│   │   ├── scene/
│   │   │   ├── SceneCard.tsx
│   │   │   ├── SceneWorkspace.tsx
│   │   │   └── tabs/   → ImageTab, VideoTab, AudioTab
│   │   ├── storyboard/ → StoryboardGrid, ProgressBar
│   │   ├── skeletons/  → ImageSkeleton, VideoProgressBar
│   │   └── ui/         → button.tsx, tabs.tsx, shadcn components
│   ├── pages/          → Home, Storyboard, Project, Settings
│   ├── store/          → projectStore.ts, settingsStore.ts
│   ├── hooks/          → useBrainGenerate, useImageGenerate, useVideoGenerate, useAudioGenerate
│   ├── types/          → schema.ts (source of truth — JANGAN ubah interfaces)
│   ├── lib/            → api.ts, utils.ts
│   ├── styles/         → glass.css
│   └── main.tsx        → Entry point dengan QueryClientProvider
├── worker/
│   ├── index.ts        → Router + Env interface + CORS
│   ├── brain.ts        → Gemini / Llama4 / Claude
│   ├── image.ts        → Gemini / Nova Canvas / Titan V2
│   ├── video.ts        → Nova Reel / Runway Gen-4
│   ├── audio.ts        → Polly / Gemini TTS / ElevenLabs
│   ├── project.ts      → Save/load R2
│   ├── storage.ts      → R2 ops + presigned URLs
│   └── lib/
│       ├── aws-signature.ts → AWS Sig V4 manual
│       └── cors.ts          → CORS headers
├── wrangler.toml
├── vite.config.ts
└── package.json
```

-----

## 🎨 DESIGN SYSTEM

```css
Warna WAJIB (jangan deviate):
  #000000  → Pure Black (background)
  #F05A25  → Orange Fire (primary CTA)
  #3FA9F6  → Sky Blue (secondary)
  #EFE1CF  → Cream Sand (text)

Glass pattern di src/styles/glass.css:
  --glass-02: rgba(255,255,255,0.07)   → cards
  --glass-03: rgba(255,255,255,0.10)   → modals
  --blur-md: blur(20px) saturate(180%)
  --glow-orange: 0 0 24px rgba(240,90,37,0.35)
  --text-primary: #EFE1CF
```

-----

## 🔧 KONFIGURASI PENTING

### vite.config.ts (WAJIB persis seperti ini)

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [react(), cloudflare()]
})
```

### wrangler.toml

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
preview_id = "fc732a268ca9435b8de8e50f34a35365"

[vars]
ENVIRONMENT = "production"
```

### src/main.tsx (WAJIB persis seperti ini)

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './styles/glass.css'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 300000 } }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
)
```

### src/App.tsx (WAJIB persis seperti ini)

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { Storyboard } from './pages/Storyboard'
import { Project } from './pages/Project'
import { Settings } from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/storyboard/:id" element={<Storyboard />} />
        <Route path="/project/:id" element={<Project />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  )
}
```

### src/lib/api.ts

```typescript
/// <reference types="vite/client" />

const WORKERS_URL = import.meta.env.VITE_WORKERS_URL ?? ''

export const api = {
  get: async (path: string) => {
    const res = await fetch(`${WORKERS_URL}${path}`)
    return res.json()
  },
  post: async (path: string, body: unknown) => {
    const res = await fetch(`${WORKERS_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    return res.json()
  }
}

export default api
```

-----

## 🔄 TANSTACK QUERY V5 PATTERN

```typescript
// ✅ BENAR — polling tanpa onSuccess
const query = useQuery({
  queryKey: ['image-status', jobId],
  queryFn: () => api.get(`/api/image/status/${jobId}`),
  enabled: !!jobId && enabled,
  refetchInterval: (query) => {
    const data = query.state.data as { status: string } | undefined
    if (data?.status === 'done' || data?.status === 'failed') return false
    return 5000 // 5s untuk image, 30000 untuk video
  }
})

// ✅ BENAR — react ke perubahan data
useEffect(() => {
  if (query.data?.status === 'done') {
    // handle success
  }
}, [query.data])

// ❌ SALAH — onSuccess tidak ada di v5
useQuery({ onSuccess: (data) => {} }) // ERROR!
```

-----

## 🤖 AI MODELS & REGIONS

```
BRAIN:
  Gemini 1.5 Flash  → Google AI (free tier)
  Llama 4 Maverick  → us.meta.llama4-maverick-17b-instruct-v1:0
  Claude Sonnet 4.6 → us.anthropic.claude-sonnet-4-6-20251001-v1:0
  Bedrock regions   → us-west-2, us-east-1

IMAGE:
  Gemini Imagen 3  → imagen-3.0-generate-002
  Nova Canvas v1   → amazon.nova-canvas-v1:0
  Titan Image V2   → amazon.titan-image-generator-v2:0
  Regions          → us-west-2, us-east-1, ap-southeast-1

VIDEO:
  Nova Reel v1     → amazon.nova-reel-v1:0
  Region           → us-east-1 FIXED (tidak bisa diganti)
  Output           → langsung ke R2 via S3-compatible endpoint
  R2 endpoint      → https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com

AUDIO:
  AWS Polly Neural → multi-region
  Gemini TTS       → Google AI
  ElevenLabs       → user API key
  ID: Arlet (F), Satria (M)
  EN: Joanna (F), Matthew (M)
```

-----

## 📡 API ENDPOINTS

```
POST /api/brain/generate      → Generate story schema
GET  /api/brain/health        → Health check

POST /api/image/generate      → Trigger image gen (async)
GET  /api/image/status/:id    → Poll status (5s interval)

POST /api/video/generate      → Trigger video gen (async)
GET  /api/video/status/:id    → Poll status (30s interval)

POST /api/audio/generate      → TTS generation
GET  /api/audio/status/:id    → Poll audio status

POST /api/project/save        → Save JSON schema to R2
GET  /api/project/:id         → Load schema from R2

GET  /api/storage/presign?key → Get presigned download URL (1hr)
```

-----

## 🗄️ WORKER ENV INTERFACE

```typescript
export interface Env {
  JOB_STATUS: KVNamespace
  STORY_STORAGE: R2Bucket
  GEMINI_API_KEY: string
  AWS_ACCESS_KEY_ID: string
  AWS_SECRET_ACCESS_KEY: string
  R2_ACCOUNT_ID: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  RUNWAY_API_KEY: string
  ELEVENLABS_API_KEY: string
  ENVIRONMENT: string
}
```

-----

## 📊 STATUS PROJECT

```
Phase 0 — Foundation        ✅ Complete
Phase 1 — AI Brain          ✅ Complete
Phase 2 — Image Generation  ✅ Complete
Phase 3 — Video Generation  ✅ Complete
Phase 4 — Audio TTS         ✅ Complete
Phase 5 — Polish            ✅ Complete
Deploy                      ✅ Live: fuzzystuf.pages.dev

CURRENT ISSUE:
  App deployed tapi "Something went wrong"
  Error: No QueryClient set
  Fix: QueryClientProvider harus di main.tsx (bukan App.tsx)
  Status: IN PROGRESS
```

-----

## 🐛 KNOWN ISSUES — FIX SEKARANG

```
Priority 1 — BLOCKING (app crash):
  src/main.tsx → pastikan QueryClientProvider wrap App
  src/App.tsx  → JANGAN ada QueryClientProvider di sini

Priority 2 — Build warnings:
  Pastikan semua imports menggunakan named exports
  Pastikan semua type imports menggunakan 'import type'

Priority 3 — Setelah app tampil:
  Test Home page render
  Test navigasi ke Settings
  Test form input di StoryInputForm
```

-----

## 🚀 DEPLOYMENT

```bash
# Workers deploy
export CLOUDFLARE_API_TOKEN=your_token
wrangler deploy

# Pages → auto dari GitHub push
git push origin main

# Set secrets (kalau belum)
wrangler secret put GEMINI_API_KEY
wrangler secret put AWS_ACCESS_KEY_ID
wrangler secret put AWS_SECRET_ACCESS_KEY
wrangler secret put R2_ACCOUNT_ID
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
wrangler secret put RUNWAY_API_KEY
wrangler secret put ELEVENLABS_API_KEY

# Cloudflare Pages output dir → dist/client
```

-----

## 💡 PROMPT EFEKTIF UNTUK GEMINI CLI

```
# Fix build error:
Fix the build error. Run: npm run build 2>&1 | head -30
Then fix ALL errors. Then run build again to verify. 
When clean: git add . && git commit -m "fix: ..." && git push

# Fix specific file:
Fix src/main.tsx — ensure QueryClientProvider wraps App.
Check src/App.tsx — remove QueryClientProvider if present.
Then: npm run build && git add . && git commit -m "fix: QueryClient setup" && git push

# Add new feature:
Read GEMINI.md first.
Then implement [feature] following the existing patterns.
Use GlassCard for UI, TanStack Query for API calls, Zustand for state.
After done: npm run build && git commit && git push
```
