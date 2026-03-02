# Fix Image Signature + iOS 26 UI Redesign

# Read CLAUDE.md first. YOLO mode recommended.

# After ALL tasks: npm run build && wrangler deploy && git push

-----

## TASK 1 — Fix AWS Signature Colon Encoding (ROOT CAUSE)

This is the SAME bug as before but not fully fixed.
The colon “:” in ALL model IDs must NEVER be encoded as “%3A”.

Read worker/lib/aws-signature.ts completely.

Find the canonical URI building logic and apply this fix:

```typescript
// Find the function that encodes the URL path
// It likely looks like one of these patterns:

// PATTERN A — split and encode segments
const canonicalUri = urlPath
  .split('/')
  .map(segment => encodeURIComponent(segment))  // ← BUG HERE
  .join('/')

// FIX PATTERN A:
const canonicalUri = urlPath
  .split('/')
  .map(segment => 
    encodeURIComponent(segment)
      .replace(/%3A/gi, ':')   // keep colon literal
      .replace(/%2F/gi, '/')   // keep slash literal
  )
  .join('/')

// PATTERN B — regex replace
const canonicalUri = urlPath.replace(/[^a-zA-Z0-9\-._~\/]/g, (char) => {
  return encodeURIComponent(char)
})

// FIX PATTERN B:
const canonicalUri = urlPath.replace(/[^a-zA-Z0-9\-._~\/:]/g, (char) => {
  return encodeURIComponent(char)  // ":" is now in safe list
})
```

After fixing, add this verification log temporarily:

```typescript
console.log('[AWS-SIG] canonicalUri:', canonicalUri)
// Must show: /model/amazon.nova-canvas-v1:0/invoke (NOT %3A)
```

-----

## TASK 2 — Fix Model ID in worker/image.ts

Read worker/image.ts completely.
Make sure model ID is correct:

```typescript
// CORRECT Nova Canvas model ID
const IMAGE_MODEL = 'amazon.nova-canvas-v1:0'

// Endpoint construction — DO NOT encode the full URL manually
// Let signRequest handle encoding
const region = creds.imageRegion || 'us-east-1'
const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/amazon.nova-canvas-v1%3A0/invoke`
// NOTE: Nova Canvas and Titan use %3A in URL (exception!)
// Only cross-region inference profiles (us.anthropic.*) use literal ":"
```

Actually for Amazon-owned models (amazon.*), test BOTH:

1. First try with literal colon: `amazon.nova-canvas-v1:0`
1. If 403, try with encoded: `amazon.nova-canvas-v1%3A0`

Add this logic to image.ts:

```typescript
async function invokeImageModel(
  endpoint: string,
  payload: string,
  creds: Credentials,
  region: string
): Promise<Response> {
  const { signRequest } = await import('./lib/aws-signature')
  
  // Try literal colon first
  const signedHeaders = await signRequest({
    method: 'POST',
    url: endpoint,
    region,
    service: 'bedrock',
    accessKeyId: creds.awsAccessKeyId,
    secretAccessKey: creds.awsSecretAccessKey,
    body: payload,
    headers: { 'Content-Type': 'application/json' }
  })

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: signedHeaders,
    body: payload
  })

  return res
}
```

-----

## TASK 3 — Duration-Aware VO Text in worker/brain.ts

Update brain.ts system prompt and prompt builder to include character constraints.

Add this helper function:

```typescript
function getVoCharLimit(durationSeconds: number, language: string): number {
  // Characters per second by language
  const charsPerSecond = language === 'id' ? 15 : 18
  return Math.floor(durationSeconds * charsPerSecond)
}
```

Update the system prompt to include duration constraints per scene:

```typescript
const systemPrompt = `You are an expert short video content creator and storyteller.
Generate a complete storyboard in valid JSON format only. No markdown, no explanation.

CRITICAL DURATION RULES:
- Each scene has a specific duration in seconds
- The narration text (text_id and text_en) MUST fit within that duration
- Indonesian narration: maximum ${getVoCharLimit(avgDuration, 'id')} characters per scene
- English narration: maximum ${getVoCharLimit(avgDuration, 'en')} characters per scene  
- Count characters carefully — shorter is better than longer
- Audio will be cut off if narration exceeds duration`
```

Update the prompt to include per-scene duration targets:

```typescript
// In handleBrainRequest, read duration from body
const scene_durations = body.scene_durations as number[] || []
const total_duration = body.total_duration as number || 60
const avgDuration = scene_durations.length > 0
  ? total_duration / scene_durations.length
  : total_duration / total_scenes

// Add to prompt:
const prompt = `
Title: ${title}
Story: ${story}
Platform: ${platform}
Art Style: ${art_style}
Total Scenes: ${total_scenes}
Language: ${narasi_language}
Frame: ${frameSpec}
Resolution: ${resolution}
Total Video Duration: ${total_duration} seconds

SCENE DURATION TARGETS:
${scene_durations.length > 0
  ? scene_durations.map((d, i) => 
    `Scene ${i+1}: ${d}s → max ${getVoCharLimit(d, narasi_language)} chars narration`
  ).join('\n')
  : `Each scene: ~${Math.round(total_duration/total_scenes)}s → max ${getVoCharLimit(Math.round(total_duration/total_scenes), narasi_language)} chars narration`
}

Return JSON with this exact structure:
{
  "project_id": "unique_id",
  "title": "...",
  "aspect_ratio": "${body.aspect_ratio || '9_16'}",
  "art_style": "${art_style}",
  "total_duration": ${total_duration},
  "scenes": [
    {
      "scene_number": 1,
      "scene_type": "opening_hook|rising_action|climax|resolution|cta",
      "duration_seconds": <from scene duration targets>,
      "char_limit": <calculated char limit>,
      "image_prompt": "detailed visual description",
      "text_id": "narasi bahasa indonesia (max X chars)",
      "text_en": "english narration (max X chars)",
      "mood": "...",
      "camera_angle": "...",
      "transition": "..."
    }
  ],
  "production_notes": {
    "color_palette": [],
    "music_tone": "...",
    "typography_style": "...",
    "target_audience": "...",
    "cta_implicit": "..."
  }
}`
```

-----

## TASK 4 — Add Re-generate VO Text Endpoint in worker/brain.ts

Add new handler for rewriting VO text per scene:

```typescript
export async function handleRewriteVO(
  request: Request,
  env: Env,
  creds: Credentials
): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-AWS-Access-Key-Id, X-AWS-Secret-Access-Key, X-Brain-Region',
  }

  const body = await request.json() as {
    original_text: string
    duration_seconds: number
    language: string
    scene_context: string
    art_style: string
  }

  const charLimit = body.language === 'id'
    ? Math.floor(body.duration_seconds * 15)
    : Math.floor(body.duration_seconds * 18)

  const systemPrompt = `You are an expert video narration writer.
Rewrite the given narration to fit exactly within ${body.duration_seconds} seconds.
Maximum ${charLimit} characters.
Keep the same meaning and emotional tone.
Return ONLY the rewritten text — no quotes, no explanation, no JSON.`

  const userPrompt = `Scene context: ${body.scene_context}
Original narration: "${body.original_text}"
Language: ${body.language === 'id' ? 'Indonesian' : 'English'}
Target duration: ${body.duration_seconds} seconds
Max characters: ${charLimit}

Rewrite to fit within ${charLimit} characters:`

  const region = creds.brainRegion || 'us-east-1'
  const modelId = 'us.anthropic.claude-sonnet-4-6'
  const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/invoke`

  const payload = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 200,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  })

  const { signRequest } = await import('./lib/aws-signature')
  const signedHeaders = await signRequest({
    method: 'POST',
    url: endpoint,
    region,
    service: 'bedrock',
    accessKeyId: creds.awsAccessKeyId,
    secretAccessKey: creds.awsSecretAccessKey,
    body: payload,
    headers: { 'Content-Type': 'application/json' }
  })

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: signedHeaders,
    body: payload
  })

  if (!res.ok) {
    return Response.json({ error: 'Rewrite failed' }, { status: 500, headers: corsHeaders })
  }

  const data = await res.json() as { content: [{ text: string }] }
  const rewritten = data.content[0].text.trim()

  return Response.json({
    rewritten_text: rewritten,
    char_count: rewritten.length,
    char_limit: charLimit,
    fits: rewritten.length <= charLimit
  }, { headers: corsHeaders })
}
```

Add route in worker/index.ts:

```typescript
if (path === '/api/brain/rewrite-vo') {
  const { handleRewriteVO } = await import('./brain')
  return handleRewriteVO(request, env, creds)
}
```

-----

## TASK 5 — Add rewriteVO to src/lib/api.ts

```typescript
export async function rewriteVO(params: {
  original_text: string
  duration_seconds: number
  language: string
  scene_context: string
  art_style: string
}): Promise<{ rewritten_text: string; char_count: number; char_limit: number; fits: boolean }> {
  const res = await fetch(`${WORKER_URL}/api/brain/rewrite-vo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getApiHeaders() },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error('VO rewrite failed')
  return res.json()
}
```

-----

## TASK 6 — iOS 26 Liquid Glass UI Redesign

### Design Tokens

```
Background: linear-gradient(145deg, #f5f5f7 0%, #e8e8ed 50%, #f0f0f5 100%)
OR dark mode: linear-gradient(145deg, #1c1c1e 0%, #2c2c2e 50%, #1c1c1e 100%)

Glass Card:
  background: rgba(255,255,255,0.72)
  backdropFilter: blur(40px) saturate(200%)
  WebkitBackdropFilter: blur(40px) saturate(200%)
  border: 1px solid rgba(255,255,255,0.9)
  borderRadius: 22px
  boxShadow: 
    0 2px 20px rgba(0,0,0,0.08),
    0 0 0 0.5px rgba(255,255,255,0.6) inset,
    0 1px 0 rgba(255,255,255,1) inset

Text Primary:   #1d1d1f
Text Secondary: rgba(60,60,67,0.6)
Text Tertiary:  rgba(60,60,67,0.3)

Accent Orange:  #ff6b35  (iOS style warm orange)
Accent Blue:    #007aff  (iOS system blue)
Accent Green:   #34c759  (iOS system green)
Accent Purple:  #af52de  (iOS system purple)
Accent Red:     #ff3b30  (iOS system red)

Button Glass:
  background: rgba(255,255,255,0.8)
  border: 1px solid rgba(255,255,255,0.9)
  borderRadius: 14px
  boxShadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 0 rgba(255,255,255,0.8) inset

Active/Selected Button:
  background: #007aff
  color: white
  boxShadow: 0 4px 12px rgba(0,122,255,0.35)
```

### Apply iOS 26 to src/pages/Home.tsx

Replace entire page style with:

```typescript
// Page background
background: 'linear-gradient(145deg, #f2f2f7 0%, #e5e5ea 50%, #f2f2f7 100%)'
minHeight: '100vh'

// Main glass card container
background: 'rgba(255,255,255,0.75)'
backdropFilter: 'blur(40px) saturate(200%)'
WebkitBackdropFilter: 'blur(40px) saturate(200%)'
border: '0.5px solid rgba(255,255,255,0.9)'
borderRadius: '28px'
boxShadow: '0 4px 40px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(255,255,255,0.5) inset'
margin: '20px 16px'
padding: '24px 20px'
overflow: 'hidden'

// Section labels
color: 'rgba(60,60,67,0.6)'
fontSize: '12px'
fontWeight: 600
textTransform: 'uppercase'
letterSpacing: '0.06em'

// Option buttons (unselected)
background: 'rgba(118,118,128,0.12)'
border: 'none'
borderRadius: '12px'
color: '#1d1d1f'

// Option buttons (selected)
background: '#007aff'
color: 'white'
boxShadow: '0 4px 12px rgba(0,122,255,0.3)'

// Generate button
background: 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)'
borderRadius: '16px'
boxShadow: '0 4px 20px rgba(255,107,53,0.4)'
color: 'white'
fontSize: '16px'
fontWeight: 700

// Input fields
background: 'rgba(118,118,128,0.1)'
border: '1px solid rgba(118,118,128,0.2)'
borderRadius: '14px'
color: '#1d1d1f'
```

### Apply iOS 26 to src/pages/Storyboard.tsx

```typescript
// Page background  
background: 'linear-gradient(145deg, #f2f2f7 0%, #e5e5ea 50%, #f2f2f7 100%)'

// Sticky header
background: 'rgba(242,242,247,0.85)'
backdropFilter: 'blur(30px)'
WebkitBackdropFilter: 'blur(30px)'
borderBottom: '0.5px solid rgba(0,0,0,0.1)'

// Scene card (glass)
background: 'rgba(255,255,255,0.78)'
backdropFilter: 'blur(40px) saturate(180%)'
WebkitBackdropFilter: 'blur(40px) saturate(180%)'
border: '0.5px solid rgba(255,255,255,0.95)'
borderRadius: '22px'
boxShadow: '0 2px 24px rgba(0,0,0,0.07), 0 0 0 0.5px rgba(255,255,255,0.6) inset'

// Scene number badge
background: 'rgba(255,107,53,0.12)'
border: 'none'
color: '#ff6b35'

// Section dividers inside card
borderTop: '0.5px solid rgba(0,0,0,0.06)'

// Image section container
background: 'rgba(0,0,0,0.03)'
border: '0.5px solid rgba(0,0,0,0.08)'
borderRadius: '16px'

// Video section container
background: 'rgba(0,122,255,0.04)'
border: '0.5px solid rgba(0,122,255,0.15)'
borderRadius: '16px'

// Audio section container
background: 'rgba(175,82,222,0.05)'
border: '0.5px solid rgba(175,82,222,0.18)'
borderRadius: '16px'

// Action buttons
background: 'rgba(255,255,255,0.9)'
border: '0.5px solid rgba(0,0,0,0.1)'
borderRadius: '12px'
boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
color: '#1d1d1f'

// Generate image button (active)
background: 'linear-gradient(135deg, #ff6b35, #ff4500)'
color: 'white'
border: 'none'
boxShadow: '0 3px 10px rgba(255,107,53,0.35)'

// Generate video button (active)
background: 'linear-gradient(135deg, #007aff, #0055ff)'
color: 'white'
border: 'none'
boxShadow: '0 3px 10px rgba(0,122,255,0.3)'

// Generate audio button (active)
background: 'linear-gradient(135deg, #af52de, #8e24d0)'
color: 'white'
border: 'none'
boxShadow: '0 3px 10px rgba(175,82,222,0.3)'

// Download buttons
background: 'rgba(52,199,89,0.1)'
border: '0.5px solid rgba(52,199,89,0.3)'
color: '#34c759'
borderRadius: '10px'

// Export ZIP button
background: 'rgba(175,82,222,0.1)'
border: '0.5px solid rgba(175,82,222,0.25)'
color: '#af52de'

// Success state
background: 'rgba(52,199,89,0.1)'
color: '#34c759'

// Error state
background: 'rgba(255,59,48,0.08)'
color: '#ff3b30'

// Text colors
Primary: '#1d1d1f'
Secondary: 'rgba(60,60,67,0.6)'
Tertiary: 'rgba(60,60,67,0.3)'

// JSON view
background: 'rgba(0,0,0,0.04)'
borderRadius: '14px'
color: '#007aff'  // JSON syntax color

// Slider accent
accentColor: '#007aff'

// Back button
background: 'rgba(255,255,255,0.85)'
border: '0.5px solid rgba(0,0,0,0.12)'
borderRadius: '12px'
color: '#007aff'
boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
```

### Apply iOS 26 to src/pages/Settings.tsx

```typescript
// Page background
background: 'linear-gradient(145deg, #f2f2f7 0%, #e5e5ea 100%)'

// Tab bar
background: 'rgba(255,255,255,0.7)'
backdropFilter: 'blur(20px)'
border: '0.5px solid rgba(0,0,0,0.08)'
borderRadius: '16px'

// Active tab
background: 'white'
boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
color: '#1d1d1f'
borderRadius: '12px'

// Card sections
background: 'rgba(255,255,255,0.75)'
backdropFilter: 'blur(30px)'
border: '0.5px solid rgba(255,255,255,0.9)'
borderRadius: '20px'
boxShadow: '0 2px 16px rgba(0,0,0,0.06)'

// Input fields
background: 'rgba(118,118,128,0.1)'
border: '1px solid transparent'
borderRadius: '12px'
color: '#1d1d1f'

// Save button
background: 'linear-gradient(135deg, #ff6b35, #ff4500)'
color: 'white'
borderRadius: '16px'
boxShadow: '0 4px 16px rgba(255,107,53,0.4)'

// Test buttons
background: 'rgba(0,122,255,0.1)'
border: '0.5px solid rgba(0,122,255,0.25)'
color: '#007aff'
borderRadius: '12px'

// Section titles
color: '#1d1d1f'
fontSize: '15px'
fontWeight: 700

// Labels
color: 'rgba(60,60,67,0.6)'
fontSize: '11px'
textTransform: 'uppercase'
letterSpacing: '0.06em'

// Security note card
background: 'rgba(0,122,255,0.06)'
border: '0.5px solid rgba(0,122,255,0.2)'
```

-----

## TASK 7 — Add VO Rewrite UI in Storyboard.tsx

In each scene card, add Rewrite VO section below narration text:

```typescript
// Add state
const [rewritingVO, setRewritingVO] = useState<Record<number, boolean>>({})
const [customVO, setCustomVO] = useState<Record<number, string>>({})
const [voCharInfo, setVoCharInfo] = useState<Record<number, { count: number; limit: number }>>({})

// Handler
const handleRewriteVO = async (scene: Record<string, unknown>, sceneNum: number) => {
  setRewritingVO(prev => ({ ...prev, [sceneNum]: true }))
  const originalText = language === 'id'
    ? (scene.text_id as string) || ''
    : (scene.text_en as string) || ''

  try {
    const result = await rewriteVO({
      original_text: customVO[sceneNum] || originalText,
      duration_seconds: sceneDurations[sceneNum] || 4,
      language,
      scene_context: scene.image_prompt as string,
      art_style: artStyle,
    })
    setCustomVO(prev => ({ ...prev, [sceneNum]: result.rewritten_text }))
    setVoCharInfo(prev => ({ ...prev, [sceneNum]: { count: result.char_count, limit: result.char_limit } }))
  } catch (e: any) {
    console.error('Rewrite VO failed:', e)
  } finally {
    setRewritingVO(prev => ({ ...prev, [sceneNum]: false }))
  }
}

// UI — add this inside each scene card, below narration paragraph:
<div style={{
  background: 'rgba(0,0,0,0.03)',
  border: '0.5px solid rgba(0,0,0,0.08)',
  borderRadius: '14px',
  padding: '10px 12px',
  marginBottom: '12px',
}}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
    <span style={{ color: 'rgba(60,60,67,0.6)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      Narration VO
    </span>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {voCharInfo[sceneNum] && (
        <span style={{
          fontSize: '10px', fontWeight: 600,
          color: voCharInfo[sceneNum].count <= voCharInfo[sceneNum].limit ? '#34c759' : '#ff3b30'
        }}>
          {voCharInfo[sceneNum].count}/{voCharInfo[sceneNum].limit} chars
        </span>
      )}
      <button
        onClick={() => handleRewriteVO(scene, sceneNum)}
        disabled={rewritingVO[sceneNum]}
        style={{
          padding: '4px 10px', borderRadius: '8px',
          background: 'rgba(0,122,255,0.1)',
          border: '0.5px solid rgba(0,122,255,0.25)',
          color: '#007aff', fontSize: '10px', fontWeight: 600,
          cursor: rewritingVO[sceneNum] ? 'not-allowed' : 'pointer',
          opacity: rewritingVO[sceneNum] ? 0.6 : 1,
        }}>
        {rewritingVO[sceneNum] ? '⏳...' : `✏️ Rewrite (${sceneDurations[sceneNum] || 4}s)`}
      </button>
    </div>
  </div>
  <p style={{ color: '#1d1d1f', fontSize: '13px', lineHeight: '1.5', fontStyle: 'italic' }}>
    "{customVO[sceneNum] || narration}"
  </p>
</div>
```

Make sure handleGenerateAudio uses customVO if available:

```typescript
const text = customVO[sceneNum]
  || (language === 'id'
    ? (scene.text_id as string) || (scene.text_en as string)
    : (scene.text_en as string) || (scene.text_id as string))
```

-----

## TASK 8 — Update Home.tsx to send duration data to Worker

In handleSubmit, send scene_durations and total_duration:

```typescript
// Read from state (add these states in Home.tsx)
const [totalDuration, setTotalDuration] = useState(60)
// scene durations initialized to even split

body: JSON.stringify({
  title,
  story,
  platform,
  brain_model: brainModel,
  language,
  art_style: artStyle,
  total_scenes: scenes,
  aspect_ratio: aspectRatio,
  resolution: '1080p',
  total_duration: totalDuration,
  scene_durations: Array.from({ length: scenes }, (_, i) =>
    Math.round(totalDuration / scenes)
  ),
})
```

Also add Total Duration slider to Home.tsx ABOVE the scenes slider:

```typescript
{/* Total Duration */}
<div style={{ marginBottom: '20px' }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
    <span style={labelStyle}>Total Duration</span>
    <span style={{ color: '#007aff', fontSize: '13px', fontWeight: 700 }}>{totalDuration}s</span>
  </div>
  <input type="range" min={15} max={120} step={5}
    value={totalDuration}
    onChange={e => setTotalDuration(Number(e.target.value))}
    style={{ width: '100%', accentColor: '#007aff' }}
  />
  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
    <span style={{ color: 'rgba(60,60,67,0.4)', fontSize: '10px' }}>15s</span>
    <span style={{ color: 'rgba(60,60,67,0.4)', fontSize: '10px' }}>120s</span>
  </div>
</div>
```

-----

## TASK 9 — Build, Deploy, Test All

```bash
# TypeScript check first
npx tsc --noEmit 2>&1 | head -20

# Build
npm run build 2>&1 | tail -20
# Must be 0 errors

# Deploy worker
wrangler deploy

# Test image generation (should be 200 now, not 403)
curl -X POST https://fuzzy-vid-worker.officialdian21.workers.dev/api/image/generate \
  -H "Content-Type: application/json" \
  -H "X-AWS-Access-Key-Id: YOUR_AWS_ACCESS_KEY_ID" \
  -H "X-AWS-Secret-Access-Key: YOUR_AWS_SECRET_ACCESS_KEY" \
  -H "X-Image-Region: us-east-1" \
  -d '{"prompt":"Ancient Persian market, cinematic","scene_number":1,"project_id":"test","aspect_ratio":"9_16","art_style":"cinematic_realistic"}' \
  2>&1 | tail -5

# Test VO rewrite
curl -X POST https://fuzzy-vid-worker.officialdian21.workers.dev/api/brain/rewrite-vo \
  -H "Content-Type: application/json" \
  -H "X-AWS-Access-Key-Id: YOUR_AWS_ACCESS_KEY_ID" \
  -H "X-AWS-Secret-Access-Key: YOUR_AWS_SECRET_ACCESS_KEY" \
  -H "X-Brain-Region: us-east-1" \
  -d '{"original_text":"Ini adalah narasi yang panjang untuk scene pembuka video","duration_seconds":3,"language":"id","scene_context":"Ancient market","art_style":"cinematic_realistic"}' \
  2>&1 | tail -5

# Push
git add .
git commit -m "fix: image signature + iOS 26 UI + duration VO constraint + rewrite VO"
git push origin main
```

-----

## Expected Results

```
✅ Image generation — no more 403 signature error
✅ iOS 26 liquid glass UI — white transparent cards
✅ Duration controls VO text length
✅ Rewrite VO button per scene with char counter
✅ Total duration slider in Home.tsx
✅ Scene durations sent to Brain for accurate VO
```