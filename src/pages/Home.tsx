import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { AspectRatio } from '../types/schema'
import { estimateBrainCost, formatCost } from '../lib/costEstimate'
import { useCostStore } from '../store/costStore'
import { useHistoryStore } from '../store/historyStore'
import { GenerationOverlay } from '../components/GenerationOverlay'
import type { GenStep } from '../components/GenerationOverlay'
import { useElapsedTimer } from '../hooks/useElapsedTimer'

type Platform = 'youtube_shorts' | 'reels' | 'tiktok'
type BrainModel = 'gemini' | 'llama4_maverick' | 'claude_sonnet'
type Language = 'id' | 'en'
type ArtStyle = 'cinematic_realistic' | 'anime_stylized' | 'comic_book' | '3d_render' | 'oil_painting' | 'pixel_art'

const STEP_LABELS = [
  'Connecting to AI...',
  'Sending prompt...',
  'AI is thinking...',
  'Parsing response...',
  'Done!',
]

function buildSteps(current: number): GenStep[] {
  return STEP_LABELS.map((label, i) => ({
    label,
    status: i < current ? 'done' : i === current ? 'active' : 'pending',
  }))
}

export function Home() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [story, setStory] = useState('')
  const [platform, setPlatform] = useState<Platform>('youtube_shorts')
  const [brainModel, setBrainModel] = useState<BrainModel>('gemini')
  const [language, setLanguage] = useState<Language>('id')
  const [artStyle, setArtStyle] = useState<ArtStyle>('cinematic_realistic')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9_16')
  const [scenes, setScenes] = useState(5)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)
  const stepTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const addCostEntry = useCostStore((s) => s.addEntry)
  const addHistoryItem = useHistoryStore((s) => s.addItem)
  const historyCount = useHistoryStore((s) => s.items.length)

  const elapsedMs = useElapsedTimer(loading)

  useEffect(() => {
    const stored = localStorage.getItem('fuzzy_short_settings')
    if (!stored) {
      setError('Please set your API keys in Settings first')
    } else {
      const keys = JSON.parse(stored)
      if (!keys.geminiApiKey && !keys.awsAccessKeyId) {
        setError('Please set your API keys in Settings first')
      }
    }
  }, [])

  const handleSubmit = async () => {
    if (!title.trim() || !story.trim()) { setError('Please fill in title and story'); return }
    setError('')
    setLoading(true)
    setCurrentStep(0) // Connecting to AI...

    // Load settings from localStorage
    let apiHeaders: Record<string, string> = {}
    try {
      const stored = localStorage.getItem('fuzzy_short_settings')
      if (stored) {
        const s = JSON.parse(stored)
        if (s.geminiApiKey) apiHeaders['X-Gemini-Key'] = s.geminiApiKey
        if (s.awsAccessKeyId) apiHeaders['X-AWS-Access-Key-Id'] = s.awsAccessKeyId
        if (s.awsSecretAccessKey) apiHeaders['X-AWS-Secret-Access-Key'] = s.awsSecretAccessKey
        if (s.brainRegion) apiHeaders['X-Brain-Region'] = s.brainRegion
        if (s.imageRegion) apiHeaders['X-Image-Region'] = s.imageRegion
        if (s.audioRegion) apiHeaders['X-Audio-Region'] = s.audioRegion
        if (s.elevenLabsApiKey) apiHeaders['X-ElevenLabs-Key'] = s.elevenLabsApiKey
        if (s.runwayApiKey) apiHeaders['X-Runway-Key'] = s.runwayApiKey
      }
    } catch { /* ignore */ }

    if (!apiHeaders['X-Gemini-Key'] && !apiHeaders['X-AWS-Access-Key-Id']) {
      setError('Please add your API keys in Settings first')
      setLoading(false)
      setCurrentStep(-1)
      return
    }

    // Progress step 1 after short delay
    stepTimerRef.current = setTimeout(() => setCurrentStep(1), 100)

    try {
      // Step 2 after 1.5s
      const thinkTimer = setTimeout(() => setCurrentStep(2), 1500)

      const res = await fetch('https://fuzzy-vid-worker.officialdian21.workers.dev/api/brain/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...apiHeaders },
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
        })
      })
      clearTimeout(thinkTimer)

      setCurrentStep(3) // Parsing response
      const text = await res.text()

      if (res.ok) {
        try {
          JSON.parse(text) // validate
          sessionStorage.setItem('storyboard_result', text)

          // Save to history
          addHistoryItem({
            title,
            platform,
            art_style: artStyle,
            language,
            brain_model: brainModel,
            scenes_count: scenes,
            storyboard_data: text,
          })

          // Cost toast
          const cost = estimateBrainCost(brainModel, scenes)
          addCostEntry({ service: 'Brain', model: brainModel, cost })
          toast(
            `Storyboard ${formatCost(cost)}`,
            {
              icon: '🧠',
              style: {
                border: '1px solid rgba(240,90,37,0.3)',
              },
              duration: 4000,
            }
          )

          setCurrentStep(4) // Done!
          // Navigate after brief delay to show "Done!"
          setTimeout(() => {
            setLoading(false)
            setCurrentStep(-1)
            navigate('/storyboard')
          }, 800)
          return
        } catch {
          setError('AI returned malformed JSON. Please try again.')
        }
      } else {
        let errData: Record<string, unknown> = {}
        try { errData = JSON.parse(text) } catch { /* ignore */ }
        setError((errData?.message as string) || (errData?.error as string) || `Error ${res.status}`)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Check Worker deployment'
      setError(`Request failed: ${msg}`)
    }
    setLoading(false)
    setCurrentStep(-1)
  }

  useEffect(() => {
    return () => {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current)
    }
  }, [])

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    backdropFilter: 'blur(40px) saturate(200%)',
    WebkitBackdropFilter: 'blur(40px) saturate(200%)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '20px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '12px 16px',
    color: '#EFE1CF',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'all 0.2s',
  }

  const label: React.CSSProperties = {
    fontSize: '11px',
    color: 'rgba(239,225,207,0.5)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    marginBottom: '8px',
    display: 'block',
  }

  const pillBtn = (active: boolean, color = '#F05A25'): React.CSSProperties => ({
    flex: 1,
    padding: '8px 4px',
    borderRadius: '10px',
    border: `1px solid ${active ? color : 'rgba(239,225,207,0.1)'}`,
    background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
    color: active ? color : 'rgba(239,225,207,0.55)',
    fontSize: '13px',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    transition: 'all 0.2s',
  })

  const navBtnStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(239,225,207,0.15)',
    borderRadius: '12px',
    color: '#EFE1CF',
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '18px',
    position: 'relative' as const,
  }

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1527 50%, #060d1a 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '60px 16px 40px',
      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
    }}>
      <style>{`
        .glass-input:focus {
          outline: none !important;
          border-color: rgba(240,90,37,0.6) !important;
        }
      `}</style>

      {/* Top-right nav buttons */}
      <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 50, display: 'flex', gap: '8px' }}>
        {/* History Button */}
        <button onClick={() => navigate('/history')} style={navBtnStyle}>
          🕐
          {historyCount > 0 && (
            <span style={{
              position: 'absolute', top: '-4px', right: '-4px',
              background: '#F05A25', color: 'white',
              fontSize: '9px', fontWeight: 800,
              width: '18px', height: '18px',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(240,90,37,0.5)',
            }}>
              {historyCount > 99 ? '99' : historyCount}
            </span>
          )}
        </button>
        {/* Settings Button */}
        <button onClick={() => navigate('/settings')} style={navBtnStyle}>
          ⚙️
        </button>
      </div>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ fontSize: '44px', marginBottom: '8px' }}>🎬</div>
        <h1 style={{ fontSize: '36px', fontWeight: 800, color: '#EFE1CF', letterSpacing: '-0.02em', margin: 0 }}>
          Fuzzy <span style={{ color: '#F05A25' }}>Short</span>
        </h1>
        <p style={{ color: 'rgba(239,225,207,0.5)', fontSize: '14px', marginTop: '6px' }}>
          AI-powered short video production
        </p>
      </div>

      {/* Main Glass Card */}
      <div style={{ ...card, width: '100%', maxWidth: '440px', padding: '28px 24px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)' }} />

        {/* Story Title */}
        <div style={{ marginBottom: '20px' }}>
          <span style={label}>Story Title</span>
          <input
            style={inputStyle}
            className="glass-input"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Enter a catchy title..."
          />
        </div>

        {/* Story */}
        <div style={{ marginBottom: '20px' }}>
          <span style={label}>The Story</span>
          <textarea
            style={{ ...inputStyle, minHeight: '80px', resize: 'none' as const }}
            className="glass-input"
            value={story}
            onChange={e => setStory(e.target.value)}
            placeholder="Describe your story... AI will build a cinematic storyboard."
          />
        </div>

        {/* Platform */}
        <div style={{ marginBottom: '20px' }}>
          <span style={label}>Target Platform</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {([
              { id: 'youtube_shorts', label: '▶️ Shorts' },
              { id: 'reels', label: '📸 Reels' },
              { id: 'tiktok', label: '🎵 TikTok' },
            ] as const).map(p => (
              <button key={p.id} onClick={() => setPlatform(p.id)} style={pillBtn(platform === p.id)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* AI Brain */}
        <div style={{ marginBottom: '20px' }}>
          <span style={label}>AI Brain</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {([
              { id: 'gemini', label: 'Gemini', sub: 'Fast & Free' },
              { id: 'llama4_maverick', label: 'Llama 4', sub: 'Balanced' },
              { id: 'claude_sonnet', label: 'Claude', sub: 'Best Quality' },
            ] as const).map(m => (
              <button key={m.id} onClick={() => setBrainModel(m.id)}
                style={{
                  flex: 1,
                  padding: '10px 6px',
                  borderRadius: '12px',
                  border: `1px solid ${brainModel === m.id ? 'rgba(255,255,255,0.3)' : 'rgba(239,225,207,0.08)'}`,
                  background: brainModel === m.id ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}>
                <div style={{ color: '#EFE1CF', fontSize: '13px', fontWeight: 600 }}>{m.label}</div>
                <div style={{ color: 'rgba(239,225,207,0.45)', fontSize: '11px', marginTop: '2px' }}>{m.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div style={{ marginBottom: '20px' }}>
          <span style={label}>Narration Language</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {([
              { id: 'id', label: '🇮🇩 Indonesia' },
              { id: 'en', label: '🇬🇧 English' },
            ] as const).map(l => (
              <button key={l.id} onClick={() => setLanguage(l.id)}
                style={pillBtn(language === l.id, '#3FA9F6')}>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Art Style */}
        <div style={{ marginBottom: '20px' }}>
          <span style={label}>Art Style</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {([
              { id: 'cinematic_realistic', label: '🎬 Cinematic' },
              { id: 'anime_stylized', label: '⛩️ Anime' },
              { id: 'comic_book', label: '💥 Comic' },
              { id: '3d_render', label: '🎮 3D Render' },
              { id: 'oil_painting', label: '🎨 Oil Paint' },
              { id: 'pixel_art', label: '👾 Pixel Art' },
            ] as const).map(s => (
              <button key={s.id} onClick={() => setArtStyle(s.id)}
                style={{
                  padding: '9px 4px',
                  borderRadius: '10px',
                  border: `1px solid ${artStyle === s.id ? '#F05A25' : 'rgba(239,225,207,0.08)'}`,
                  background: artStyle === s.id ? 'rgba(240,90,37,0.18)' : 'rgba(255,255,255,0.04)',
                  color: artStyle === s.id ? '#EFE1CF' : 'rgba(239,225,207,0.5)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Aspect Ratio */}
        <div style={{ marginBottom: '20px' }}>
          <span style={label}>Aspect Ratio</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {([
              { id: '9_16', label: '9:16', desc: 'Vertical', icon: '📱' },
              { id: '16_9', label: '16:9', desc: 'Landscape', icon: '🖥️' },
              { id: '1_1', label: '1:1', desc: 'Square', icon: '⬜' },
              { id: '4_5', label: '4:5', desc: 'Portrait', icon: '🖼️' },
            ] as const).map(r => (
              <button key={r.id} onClick={() => setAspectRatio(r.id)}
                style={{
                  flex: 1,
                  padding: '10px 4px',
                  borderRadius: '12px',
                  border: `1px solid ${aspectRatio === r.id ? '#F05A25' : 'rgba(239,225,207,0.08)'}`,
                  background: aspectRatio === r.id ? 'rgba(240,90,37,0.18)' : 'rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}>
                <div style={{ fontSize: '16px', marginBottom: '2px' }}>{r.icon}</div>
                <div style={{ color: aspectRatio === r.id ? '#F05A25' : '#EFE1CF', fontSize: '12px', fontWeight: 700 }}>{r.label}</div>
                <div style={{ color: 'rgba(239,225,207,0.4)', fontSize: '10px' }}>{r.desc}</div>
              </button>
            ))}
          </div>
          <div style={{
            marginTop: '8px', padding: '8px 12px',
            background: 'rgba(63,169,246,0.08)',
            border: '1px solid rgba(63,169,246,0.15)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <span style={{ fontSize: '12px' }}>🎬</span>
            <span style={{ color: 'rgba(239,225,207,0.5)', fontSize: '11px' }}>
              Resolution: <span style={{ color: '#3FA9F6', fontWeight: 600 }}>1080p</span>
              {' · '}Output: <span style={{ color: '#3FA9F6', fontWeight: 600 }}>
                {aspectRatio === '9_16' ? '1080×1920' :
                 aspectRatio === '16_9' ? '1920×1080' :
                 aspectRatio === '1_1' ? '1080×1080' : '864×1080'}
              </span>
            </span>
          </div>
        </div>

        {/* Scenes */}
        <div style={{ marginBottom: '24px' }}>
          <span style={label}>
            Scenes: <span style={{ color: '#F05A25', fontWeight: 700 }}>{scenes}</span>
          </span>
          <input
            type="range" min={3} max={15} value={scenes}
            onChange={e => setScenes(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#F05A25' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(239,225,207,0.3)', fontSize: '11px', marginTop: '4px' }}>
            <span>3</span><span>15</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '12px',
            padding: '10px 14px',
            color: '#f87171',
            fontSize: '13px',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '14px',
            border: 'none',
            background: loading ? 'rgba(240,90,37,0.5)' : 'linear-gradient(135deg, #F05A25, #d94e1f)',
            boxShadow: loading ? 'none' : '0 0 32px rgba(240,90,37,0.5), 0 4px 16px rgba(0,0,0,0.4)',
            color: 'white',
            fontSize: '15px',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s',
            letterSpacing: '0.01em',
          }}>
          {loading ? '✨ Generating Storyboard...' : '🎬 Generate Storyboard'}
        </button>
      </div>

      {/* Footer */}
      <p style={{ color: 'rgba(239,225,207,0.2)', fontSize: '11px', marginTop: '24px' }}>
        iOS 26 Liquid Glass Edition
      </p>

      {/* Generation Overlay */}
      <GenerationOverlay
        isOpen={loading}
        steps={buildSteps(currentStep)}
        currentStep={currentStep}
        elapsedMs={elapsedMs}
      />
    </div>
  )
}
