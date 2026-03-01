import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { AspectRatio } from '../types/schema'
import { estimateBrainCost, formatCost } from '../lib/costEstimate'
import { useCostStore } from '../store/costStore'
import { useHistoryStore } from '../store/historyStore'
import { useGenTaskStore } from '../store/genTaskStore'
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

const dropdownStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '10px',
  padding: '9px 32px 9px 12px',
  color: '#EFE1CF',
  fontSize: '13px',
  outline: 'none',
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23EFE1CF' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  fontFamily: 'inherit',
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
  const [imageModel, setImageModel] = useState<'nova_canvas' | 'titan_v2'>('nova_canvas')
  const [audioModel, setAudioModel] = useState<'polly' | 'elevenlabs'>('polly')
  const [scenes, setScenes] = useState(5)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [overlayMinimized, setOverlayMinimized] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)
  const stepTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const taskIdRef = useRef<string>('')

  const addCostEntry = useCostStore((s) => s.addEntry)
  const addHistoryItem = useHistoryStore((s) => s.addItem)
  const historyCount = useHistoryStore((s) => s.items.length)
  const addTask = useGenTaskStore((s) => s.addTask)
  const updateTask = useGenTaskStore((s) => s.updateTask)

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
    setOverlayMinimized(false)
    setCurrentStep(0)

    // Create queue task
    const taskId = addTask({ title, status: 'running', currentStep: 0 })
    taskIdRef.current = taskId

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
      updateTask(taskId, { status: 'error', error: 'Missing API keys' })
      return
    }

    stepTimerRef.current = setTimeout(() => {
      setCurrentStep(1)
      updateTask(taskId, { currentStep: 1 })
    }, 100)

    try {
      const thinkTimer = setTimeout(() => {
        setCurrentStep(2)
        updateTask(taskId, { currentStep: 2 })
      }, 1500)

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

      setCurrentStep(3)
      updateTask(taskId, { currentStep: 3 })
      const text = await res.text()

      if (res.ok) {
        try {
          JSON.parse(text) // validate
          sessionStorage.setItem('storyboard_result', text)
          sessionStorage.setItem('fuzzy_gen_imageModel', imageModel)
          sessionStorage.setItem('fuzzy_gen_audioModel', audioModel)

          addHistoryItem({
            title,
            platform,
            art_style: artStyle,
            language,
            brain_model: brainModel,
            scenes_count: scenes,
            storyboard_data: text,
          })

          const cost = estimateBrainCost(brainModel, scenes)
          addCostEntry({ service: 'Brain', model: brainModel, cost })
          toast(
            `Storyboard ${formatCost(cost)}`,
            {
              icon: '🧠',
              style: { border: '1px solid rgba(240,90,37,0.3)' },
              duration: 4000,
            }
          )

          setCurrentStep(4)
          updateTask(taskId, { status: 'done', currentStep: 4, resultJson: text })

          setTimeout(() => {
            setLoading(false)
            setOverlayMinimized(false)
            setCurrentStep(-1)
            navigate('/storyboard')
          }, 800)
          return
        } catch {
          setError('AI returned malformed JSON. Please try again.')
          updateTask(taskId, { status: 'error', error: 'Malformed JSON response' })
        }
      } else {
        let errData: Record<string, unknown> = {}
        try { errData = JSON.parse(text) } catch { /* ignore */ }
        const msg = (errData?.message as string) || (errData?.error as string) || `Error ${res.status}`
        setError(msg)
        updateTask(taskId, { status: 'error', error: msg })
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Check Worker deployment'
      setError(`Request failed: ${msg}`)
      updateTask(taskId, { status: 'error', error: msg })
    }
    setLoading(false)
    setOverlayMinimized(false)
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
    padding: '8px 11px',
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
    marginBottom: '6px',
    display: 'block',
  }

  const pillBtn = (active: boolean, color = '#F05A25'): React.CSSProperties => ({
    flex: 1,
    padding: '6px 3px',
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
      padding: '42px 11px 28px',
      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
    }}>
      <style>{`
        .glass-input:focus {
          outline: none !important;
          border-color: rgba(240,90,37,0.6) !important;
        }
        select option { background: #0d1527; color: #EFE1CF; }
      `}</style>

      {/* Top-right nav buttons */}
      <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 50, display: 'flex', gap: '8px' }}>
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
        <button onClick={() => navigate('/settings')} style={navBtnStyle}>
          ⚙️
        </button>
      </div>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '22px' }}>
        <div style={{ fontSize: '40px', marginBottom: '6px' }}>🎬</div>
        <h1 style={{ fontSize: '34px', fontWeight: 800, color: '#EFE1CF', letterSpacing: '-0.02em', margin: 0 }}>
          Fuzzy <span style={{ color: '#F05A25' }}>Short</span>
        </h1>
        <p style={{ color: 'rgba(239,225,207,0.5)', fontSize: '13px', marginTop: '5px' }}>
          AI-powered short video production
        </p>
      </div>

      {/* Main Glass Card */}
      <div style={{ ...card, width: '100%', maxWidth: '440px', padding: '20px 17px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)' }} />

        {/* Story Title */}
        <div style={{ marginBottom: '14px' }}>
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
        <div style={{ marginBottom: '14px' }}>
          <span style={label}>The Story</span>
          <textarea
            style={{ ...inputStyle, minHeight: '72px', resize: 'none' as const }}
            className="glass-input"
            value={story}
            onChange={e => setStory(e.target.value)}
            placeholder="Describe your story... AI will build a cinematic storyboard."
          />
        </div>

        {/* Platform */}
        <div style={{ marginBottom: '14px' }}>
          <span style={label}>Target Platform</span>
          <div style={{ display: 'flex', gap: '6px' }}>
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

        {/* AI Brain — dropdown */}
        <div style={{ marginBottom: '14px' }}>
          <span style={label}>AI Brain</span>
          <select
            value={brainModel}
            onChange={e => setBrainModel(e.target.value as BrainModel)}
            style={dropdownStyle}
          >
            <option value="gemini">Gemini — Fast &amp; Free</option>
            <option value="llama4_maverick">Llama 4 — Balanced</option>
            <option value="claude_sonnet">Claude Sonnet — Best Quality</option>
          </select>
        </div>

        {/* Language */}
        <div style={{ marginBottom: '14px' }}>
          <span style={label}>Narration Language</span>
          <div style={{ display: 'flex', gap: '6px' }}>
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
        <div style={{ marginBottom: '14px' }}>
          <span style={label}>Art Style</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
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
                  padding: '7px 3px',
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
        <div style={{ marginBottom: '14px' }}>
          <span style={label}>Aspect Ratio</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {([
              { id: '9_16', label: '9:16', desc: 'Vertical', icon: '📱' },
              { id: '16_9', label: '16:9', desc: 'Landscape', icon: '🖥️' },
              { id: '1_1', label: '1:1', desc: 'Square', icon: '⬜' },
              { id: '4_5', label: '4:5', desc: 'Portrait', icon: '🖼️' },
            ] as const).map(r => (
              <button key={r.id} onClick={() => setAspectRatio(r.id)}
                style={{
                  flex: 1,
                  padding: '7px 3px',
                  borderRadius: '12px',
                  border: `1px solid ${aspectRatio === r.id ? '#F05A25' : 'rgba(239,225,207,0.08)'}`,
                  background: aspectRatio === r.id ? 'rgba(240,90,37,0.18)' : 'rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}>
                <div style={{ fontSize: '15px', marginBottom: '2px' }}>{r.icon}</div>
                <div style={{ color: aspectRatio === r.id ? '#F05A25' : '#EFE1CF', fontSize: '12px', fontWeight: 700 }}>{r.label}</div>
                <div style={{ color: 'rgba(239,225,207,0.4)', fontSize: '10px' }}>{r.desc}</div>
              </button>
            ))}
          </div>
          <div style={{
            marginTop: '6px', padding: '6px 10px',
            background: 'rgba(63,169,246,0.08)',
            border: '1px solid rgba(63,169,246,0.15)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <span style={{ fontSize: '11px' }}>🎬</span>
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

        {/* Image Model — dropdown */}
        <div style={{ marginBottom: '14px' }}>
          <span style={label}>Image Model</span>
          <select
            value={imageModel}
            onChange={e => setImageModel(e.target.value as 'nova_canvas' | 'titan_v2')}
            style={dropdownStyle}
          >
            <option value="nova_canvas">Nova Canvas — Best Quality</option>
            <option value="titan_v2">Titan V2 — Fast &amp; Cheap</option>
          </select>
        </div>

        {/* Audio Engine — dropdown */}
        <div style={{ marginBottom: '14px' }}>
          <span style={label}>Audio Engine</span>
          <select
            value={audioModel}
            onChange={e => setAudioModel(e.target.value as 'polly' | 'elevenlabs')}
            style={dropdownStyle}
          >
            <option value="polly">AWS Polly — Low Cost</option>
            <option value="elevenlabs">ElevenLabs — Premium Voice</option>
          </select>
        </div>

        {/* Video Model Info */}
        <div style={{
          marginBottom: '14px',
          padding: '7px 10px',
          background: 'rgba(63,169,246,0.06)',
          border: '1px solid rgba(63,169,246,0.12)',
          borderRadius: '10px',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <span style={{ fontSize: '11px' }}>🎬</span>
          <span style={{ color: 'rgba(239,225,207,0.5)', fontSize: '11px' }}>
            Video: <span style={{ color: '#3FA9F6', fontWeight: 600 }}>Nova Reel</span> (only available model)
          </span>
        </div>

        {/* Scenes */}
        <div style={{ marginBottom: '17px' }}>
          <span style={label}>
            Scenes: <span style={{ color: '#F05A25', fontWeight: 700 }}>{scenes}</span>
          </span>
          <input
            type="range" min={3} max={15} value={scenes}
            onChange={e => setScenes(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#F05A25' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(239,225,207,0.3)', fontSize: '11px', marginTop: '3px' }}>
            <span>3</span><span>15</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '12px',
            padding: '8px 12px',
            color: '#f87171',
            fontSize: '13px',
            marginBottom: '11px',
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
            padding: '11px',
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
      <p style={{ color: 'rgba(239,225,207,0.2)', fontSize: '11px', marginTop: '17px' }}>
        iOS 26 Liquid Glass Edition
      </p>

      {/* Generation Overlay */}
      <GenerationOverlay
        isOpen={loading && !overlayMinimized}
        steps={buildSteps(currentStep)}
        currentStep={currentStep}
        elapsedMs={elapsedMs}
        onMinimize={() => setOverlayMinimized(true)}
      />
    </div>
  )
}
