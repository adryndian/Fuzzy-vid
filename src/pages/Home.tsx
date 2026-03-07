import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { AspectRatio } from '../types/schema'
import { estimateBrainCost, formatCost } from '../lib/costEstimate'
import { useCostStore } from '../store/costStore'
import { useHistoryStore } from '../store/historyStore'
import { useGenTaskStore } from '../store/genTaskStore'
import { useStoryboardSessionStore } from '../store/storyboardSessionStore'
import { GenerationOverlay } from '../components/GenerationOverlay'
import type { GenStep } from '../components/GenerationOverlay'
import { useElapsedTimer } from '../hooks/useElapsedTimer'
import { useUser } from '@clerk/clerk-react'
import { useUserApi } from '../lib/userApi'
import { getModelsByProvider, hasRequiredKey, getModelById } from '../lib/providerModels'
import { WORKER_URL } from '../lib/api'

type Platform = 'youtube_shorts' | 'reels' | 'tiktok'
type Language = 'id' | 'en'

const PROVIDER_ORDER = ['aws', 'dashscope', 'gemini', 'groq', 'openrouter', 'glm']
const PROVIDER_META: Record<string, { emoji: string; color: string; label: string }> = {
  aws:        { emoji: '☁️',  color: '#ff9900', label: 'AWS Bedrock' },
  dashscope:  { emoji: '🧠',  color: '#ff8c00', label: 'Dashscope' },
  gemini:     { emoji: '✨',  color: '#4285f4', label: 'Google Gemini' },
  groq:       { emoji: '⚡',  color: '#f97316', label: 'Groq' },
  openrouter: { emoji: '🔀',  color: '#8b5cf6', label: 'OpenRouter' },
  glm:        { emoji: '🌐',  color: '#06b6d4', label: 'ZhipuAI GLM' },
}
const MODEL_GROUPS = getModelsByProvider()
type ArtStyle = 'cinematic_realistic' | 'anime_stylized' | 'comic_book' | '3d_render' | 'oil_painting' | 'pixel_art'

const IMAGE_MODELS = [
  { id: 'nova_canvas',        label: 'Nova Canvas',        tag: 'AWS',  desc: 'Fast & consistent', provider: 'bedrock' },
  { id: 'sd35',               label: 'SD 3.5 Large',       tag: 'AWS',  desc: 'Best quality',       provider: 'bedrock' },
  { id: 'qwen-image-2.0-pro', label: 'Qwen Image 2.0 Pro', tag: 'Qwen', desc: 'Best quality',       provider: 'dashscope' },
  { id: 'qwen-image-2.0',     label: 'Qwen Image 2.0',     tag: 'Qwen', desc: 'Balanced',            provider: 'dashscope' },
  { id: 'wan2.6-image',       label: 'Wan 2.6 Image',      tag: 'Qwen', desc: 'Latest Wan model',    provider: 'dashscope' },
  { id: 'wanx2.1-t2i-turbo', label: 'Wanx 2.1 Turbo',     tag: 'Qwen', desc: 'Fast (legacy)',       provider: 'dashscope' },
  { id: 'cogview-4',          label: 'CogView-4',          tag: 'GLM',  desc: 'Best quality',        provider: 'glm' },
  { id: 'cogview-4-flash',    label: 'CogView-4 Flash',    tag: 'GLM',  desc: 'Fast & free',         provider: 'glm' },
]

const TONES = [
  { id: 'narrative_storytelling', label: '📖 Narrative Story', desc: 'Story arc with emotional beats' },
  { id: 'documentary_viral',      label: '📰 Documentary Viral', desc: 'Journalistic + Veo 3.1 optimized' },
  { id: 'natural_genz',           label: '✌️ Natural Gen Z',  desc: 'Casual, relatable, authentic' },
  { id: 'informative',            label: '💡 Informative',    desc: 'Factual, clear, structured' },
  { id: 'product_ads',            label: '🛍️ Product Ads',   desc: 'Benefit-focused with CTA' },
  { id: 'educational',            label: '🎓 Educational',   desc: 'Step-by-step explanation' },
  { id: 'entertainment',          label: '🎉 Entertainment', desc: 'Fun, energetic, surprising' },
  { id: 'motivational',           label: '💪 Motivational',  desc: 'Empowering and uplifting' },
]
const VEO_TONES = ['documentary_viral', 'natural_genz', 'informative', 'narrative_storytelling']

const VIDEO_MODELS_HOME = [
  { id: 'nova_reel',          label: 'Nova Reel',        tag: 'AWS',  desc: 'Up to 6s',          provider: 'bedrock' },
  { id: 'wan2.6-i2v-flash',  label: 'Wan2.6 I2V',      tag: 'Qwen', desc: 'Image→Video best',  provider: 'dashscope' },
  { id: 'wanx2.1-i2v-turbo', label: 'Wan2.1 I2V',      tag: 'Qwen', desc: 'Image→Video fast',  provider: 'dashscope' },
  { id: 'wan2.6-t2v-flash',  label: 'Wan2.6 T2V',      tag: 'Qwen', desc: 'Text→Video best',   provider: 'dashscope' },
  { id: 'wan2.1-t2v-turbo',  label: 'Wan2.1 T2V',      tag: 'Qwen', desc: 'Text→Video fast',   provider: 'dashscope' },
  { id: 'cogvideox-2',        label: 'CogVideoX-2',     tag: 'GLM',  desc: 'I2V/T2V 5-10s',    provider: 'glm' },
]

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
  background: 'rgba(118,118,128,0.1)',
  border: '1px solid rgba(118,118,128,0.2)',
  borderRadius: '12px',
  padding: '10px 32px 10px 12px',
  color: '#1d1d1f',
  fontSize: '13px',
  outline: 'none',
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%233c3c43' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  fontFamily: 'inherit',
}

export function Home() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [story, setStory] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [platform, setPlatform] = useState<Platform>('youtube_shorts')
  const [brainModel, setBrainModel] = useState<string>('gemini-2.0-flash')
  const [userSettings, setUserSettings] = useState<Record<string, string>>({})
  const [language, setLanguage] = useState<Language>('id')
  const [artStyle, setArtStyle] = useState<ArtStyle>('cinematic_realistic')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9_16')
  const [imageModel, setImageModel] = useState('nova_canvas')
  const [videoModel, setVideoModel] = useState('nova_reel')
  const [audioModel, setAudioModel] = useState<'polly' | 'elevenlabs'>('polly')
  const [tone, setTone] = useState<string>('narrative_storytelling')
  const [scenes, setScenes] = useState(5)
  const [totalDuration, setTotalDuration] = useState(60)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [overlayMinimized, setOverlayMinimized] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)
  const stepTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const taskIdRef = useRef<string>('')

  const { user } = useUser()

  const handleProviderChange = (pid: string) => {
    const models = MODEL_GROUPS[pid] || []
    const first = models.find(m => pid === 'gemini' || hasRequiredKey(m, userSettings)) || models[0]
    if (first) setBrainModel(first.id)
  }

  const addCostEntry = useCostStore((s) => s.addEntry)
  const addHistoryItem = useHistoryStore((s) => s.addItem)
  const historyCount = useHistoryStore((s) => s.items.length)
  const addTask = useGenTaskStore((s) => s.addTask)
  const updateTask = useGenTaskStore((s) => s.updateTask)
  const createSession = useStoryboardSessionStore((s) => s.createSession)
  const { saveStoryboard } = useUserApi()

  const elapsedMs = useElapsedTimer(loading)

  useEffect(() => {
    if (!user?.id) return
    const storageKey = `fuzzy_settings_${user.id}`
    const stored = localStorage.getItem(storageKey)
    if (!stored) {
      setError('Please set your API keys in Settings first')
    } else {
      try {
        const keys = JSON.parse(stored)
        setUserSettings(keys)
        const hasAnyKey = keys.geminiApiKey || keys.awsAccessKeyId || keys.dashscopeApiKey ||
          keys.groqApiKey || keys.openrouterApiKey || keys.glmApiKey
        if (!hasAnyKey) {
          setError('Please set your API keys in Settings first')
        } else {
          setError('')
          if (keys.language) setLanguage(keys.language)
          if (keys.artStyle) setArtStyle(keys.artStyle)
          if (keys.defaultImageModel) setImageModel(keys.defaultImageModel)
          if (keys.defaultVideoModel) setVideoModel(keys.defaultVideoModel)
        }
      } catch { /* ignore */ }
    }
  }, [user?.id])

  const handleSubmit = async () => {
    if (!title.trim() || !story.trim()) { setError('Please fill in title and story'); return }
    setError('')
    setLoading(true)
    setOverlayMinimized(false)
    setCurrentStep(0)

    const taskId = addTask({ title, status: 'running', currentStep: 0 })
    taskIdRef.current = taskId

    let apiHeaders: Record<string, string> = {}
    try {
      const storageKey = user?.id ? `fuzzy_settings_${user.id}` : 'fuzzy_short_settings'
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const s = JSON.parse(stored)
        if (s.geminiApiKey) apiHeaders['X-Gemini-Api-Key'] = s.geminiApiKey
        if (s.awsAccessKeyId) apiHeaders['X-AWS-Access-Key-Id'] = s.awsAccessKeyId
        if (s.awsSecretAccessKey) apiHeaders['X-AWS-Secret-Access-Key'] = s.awsSecretAccessKey
        if (s.brainRegion) apiHeaders['X-Brain-Region'] = s.brainRegion
        if (s.imageRegion) apiHeaders['X-Image-Region'] = s.imageRegion
        if (s.audioRegion) apiHeaders['X-Audio-Region'] = s.audioRegion
        if (s.elevenLabsApiKey) apiHeaders['X-ElevenLabs-Key'] = s.elevenLabsApiKey
        if (s.runwayApiKey) apiHeaders['X-Runway-Key'] = s.runwayApiKey
        if (s.dashscopeApiKey) apiHeaders['X-Dashscope-Api-Key'] = s.dashscopeApiKey
        if (s.groqApiKey) apiHeaders['X-Groq-Api-Key'] = s.groqApiKey
        if (s.openrouterApiKey) apiHeaders['X-Openrouter-Api-Key'] = s.openrouterApiKey
        if (s.glmApiKey) apiHeaders['X-Glm-Api-Key'] = s.glmApiKey
      }
    } catch { /* ignore */ }

    const selectedModelDef = getModelById(brainModel)
    const modelProvider = selectedModelDef?.provider || 'gemini'

    if (modelProvider === 'aws' && !apiHeaders['X-AWS-Access-Key-Id']) {
      setError('Please add your AWS credentials in Settings first')
      setLoading(false); setCurrentStep(-1)
      updateTask(taskId, { status: 'error', error: 'Missing AWS keys' }); return
    }
    if (modelProvider === 'dashscope' && !apiHeaders['X-Dashscope-Api-Key']) {
      setError('Please add your Dashscope API key in Settings first')
      setLoading(false); setCurrentStep(-1)
      updateTask(taskId, { status: 'error', error: 'Missing Dashscope key' }); return
    }
    if (modelProvider === 'groq' && !apiHeaders['X-Groq-Api-Key']) {
      setError('Please add your Groq API key in Settings first')
      setLoading(false); setCurrentStep(-1)
      updateTask(taskId, { status: 'error', error: 'Missing Groq key' }); return
    }
    if (modelProvider === 'openrouter' && !apiHeaders['X-Openrouter-Api-Key']) {
      setError('Please add your OpenRouter API key in Settings first')
      setLoading(false); setCurrentStep(-1)
      updateTask(taskId, { status: 'error', error: 'Missing OpenRouter key' }); return
    }
    if (modelProvider === 'glm' && !apiHeaders['X-Glm-Api-Key']) {
      setError('Please add your GLM API key in Settings first')
      setLoading(false); setCurrentStep(-1)
      updateTask(taskId, { status: 'error', error: 'Missing GLM key' }); return
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

      const sceneDurationsArr = Array.from({ length: scenes }, () =>
        Math.round(totalDuration / scenes)
      )

      const brainEndpoint = modelProvider === 'aws'
        ? `${WORKER_URL}/api/brain/generate`
        : modelProvider === 'dashscope'
          ? `${WORKER_URL}/api/dashscope/brain`
          : `${WORKER_URL}/api/brain/provider`

      const res = await fetch(brainEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...apiHeaders },
        body: JSON.stringify({
          title,
          story,
          platform,
          brain_model: brainModel,
          language,
          tone,
          art_style: artStyle,
          total_scenes: scenes,
          aspect_ratio: aspectRatio,
          resolution: '1080p',
          total_duration: totalDuration,
          scene_durations: sceneDurationsArr,
        })
      })
      clearTimeout(thinkTimer)

      setCurrentStep(3)
      updateTask(taskId, { currentStep: 3 })
      const text = await res.text()

      if (res.ok) {
        try {
          const parsed = JSON.parse(text) // validate + parse
          let storyData = parsed
          if (!storyData.scenes) {
            if (Array.isArray(parsed.storyboard?.scenes)) storyData = parsed.storyboard
            else if (Array.isArray(parsed.data?.scenes)) storyData = parsed.data
            else if (Array.isArray(parsed.project?.scenes)) storyData = parsed.project
          }
          const storyboardWithMeta = { ...storyData, selected_image_model: imageModel, selected_video_model: videoModel }
          const metaText = JSON.stringify(storyboardWithMeta)
          sessionStorage.setItem('storyboard_result', metaText)
          sessionStorage.setItem('fuzzy_gen_imageModel', imageModel)
          sessionStorage.setItem('fuzzy_gen_videoModel', videoModel)
          sessionStorage.setItem('fuzzy_gen_audioModel', audioModel)

          const sessionId = createSession({
            rawJson: metaText,
            title: storyData.title || title,
            imageModel,
            audioEngine: audioModel,
            audioVoice: audioModel === 'polly' ? 'Ruth' : 'Bella',
            language,
          })

          saveStoryboard({
            id: sessionId,
            title: storyData.title || title,
            story,
            platform,
            language,
            tone,
            art_style: artStyle,
            aspect_ratio: aspectRatio,
            total_scenes: scenes,
            brain_model: brainModel,
            image_model: imageModel,
            video_model: videoModel,
            scenes_data: storyData.scenes,
            status: 'draft',
          }).catch(console.error)

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
              style: { border: '1px solid rgba(0,122,255,0.3)' },
              duration: 4000,
            }
          )

          setCurrentStep(4)
          updateTask(taskId, { status: 'done', currentStep: 4, resultJson: text, sessionId })

          setTimeout(() => {
            setLoading(false)
            setOverlayMinimized(false)
            setCurrentStep(-1)
            navigate(`/storyboard?id=${sessionId}`)
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

  // ── iOS 26 Style tokens ──────────────────────────────────
  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.75)',
    backdropFilter: 'blur(40px) saturate(200%)',
    WebkitBackdropFilter: 'blur(40px) saturate(200%)',
    border: '0.5px solid rgba(255,255,255,0.9)',
    borderRadius: '28px',
    boxShadow: '0 4px 40px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(255,255,255,0.5) inset',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(118,118,128,0.1)',
    border: '1px solid rgba(118,118,128,0.2)',
    borderRadius: '14px',
    padding: '10px 12px',
    color: '#1d1d1f',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'all 0.2s',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'rgba(60,60,67,0.6)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    fontWeight: 600,
    marginBottom: '7px',
    display: 'block',
  }

  const pillBtn = (active: boolean, activeColor = '#007aff'): React.CSSProperties => ({
    flex: 1,
    padding: '7px 4px',
    borderRadius: '12px',
    border: 'none',
    background: active ? activeColor : 'rgba(118,118,128,0.12)',
    color: active ? 'white' : '#1d1d1f',
    fontSize: '13px',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: active ? `0 4px 12px ${activeColor}4d` : 'none',
  })

  const navBtnStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.8)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '0.5px solid rgba(255,255,255,0.9)',
    borderRadius: '14px',
    color: '#1d1d1f',
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '18px',
    position: 'relative' as const,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 0 rgba(255,255,255,0.8) inset',
  }

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: 'linear-gradient(145deg, #f2f2f7 0%, #e5e5ea 50%, #f2f2f7 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '16px 11px 90px',
      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
    }}>
      <style>{`
        .glass-input:focus {
          outline: none !important;
          border-color: rgba(0,122,255,0.5) !important;
          background: rgba(255,255,255,0.9) !important;
        }
        select option { background: #f2f2f7; color: #1d1d1f; }
        .adv-section { overflow: hidden; transition: max-height 0.3s ease; }
      `}</style>

      {/* Compact Header */}
      <div style={{ textAlign: 'center', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
        <span style={{ fontSize: '24px' }}>🎬</span>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1d1d1f', letterSpacing: '-0.02em', margin: 0 }}>
          Fuzzy <span style={{ color: '#ff6b35' }}>Short</span>
        </h1>
      </div>

      {/* Main Glass Card */}
      <div style={{ ...card, width: '100%', maxWidth: '440px', padding: '20px 17px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,1), transparent)' }} />

        {/* Story Title */}
        <div style={{ marginBottom: '14px' }}>
          <span style={labelStyle}>Story Title</span>
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
          <span style={labelStyle}>The Story</span>
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
          <span style={labelStyle}>Target Platform</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {([
              { id: 'youtube_shorts', label: '▶️ Shorts' },
              { id: 'reels', label: '📸 Reels' },
              { id: 'tiktok', label: '🎵 TikTok' },
            ] as const).map(p => (
              <button key={p.id} onClick={() => setPlatform(p.id)} style={pillBtn(platform === p.id, '#007aff')}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* AI Brain */}
        <div style={{ marginBottom: '14px' }}>
          <span style={labelStyle}>AI Brain</span>

          {/* Provider pill row */}
          <style>{`.provider-pills::-webkit-scrollbar{display:none}`}</style>
          <div className="provider-pills" style={{
            display: 'flex', gap: '5px', overflowX: 'auto',
            paddingBottom: '8px', marginBottom: '8px',
          }}>
            {PROVIDER_ORDER.map(pid => {
              const meta = PROVIDER_META[pid]
              const models = MODEL_GROUPS[pid] || []
              const hasKey = pid === 'gemini' || models.some(m => hasRequiredKey(m, userSettings))
              const active = (getModelById(brainModel)?.provider || 'gemini') === pid
              return (
                <button
                  key={pid}
                  onClick={() => handleProviderChange(pid)}
                  style={{
                    flexShrink: 0,
                    padding: '6px 11px',
                    borderRadius: '11px',
                    border: active ? `1.5px solid ${meta.color}` : '0.5px solid rgba(0,0,0,0.09)',
                    background: active ? `${meta.color}18` : 'rgba(255,255,255,0.72)',
                    color: active ? meta.color : hasKey ? '#1d1d1f' : 'rgba(60,60,67,0.35)',
                    fontSize: '12px',
                    fontWeight: active ? 700 : 400,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px',
                    transition: 'all 0.15s',
                  }}
                >
                  <span>{meta.emoji}</span>
                  <span>{meta.label}</span>
                  {!hasKey && <span style={{ fontSize: '9px', opacity: 0.7 }}>🔒</span>}
                </button>
              )
            })}
          </div>

          {/* Model dropdown for selected provider */}
          {(() => {
            const currentProvider = getModelById(brainModel)?.provider || 'gemini'
            const meta = PROVIDER_META[currentProvider]
            const models = MODEL_GROUPS[currentProvider] || []
            const providerHasKey = currentProvider === 'gemini' || models.some(m => hasRequiredKey(m, userSettings))
            const sel = getModelById(brainModel)
            return (
              <>
                <select
                  value={brainModel}
                  onChange={e => setBrainModel(e.target.value)}
                  style={{
                    ...dropdownStyle,
                    borderColor: providerHasKey ? 'rgba(118,118,128,0.2)' : 'rgba(255,59,48,0.3)',
                  }}
                >
                  {models.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.label}{m.free ? ' · FREE' : ''}
                    </option>
                  ))}
                </select>

                {!providerHasKey && (
                  <div style={{
                    marginTop: '5px', padding: '4px 9px',
                    background: 'rgba(255,59,48,0.07)',
                    border: '0.5px solid rgba(255,59,48,0.2)',
                    borderRadius: '8px', fontSize: '10px', color: '#ff3b30', fontWeight: 600,
                  }}>
                    🔑 No {meta.label} key — add in Settings
                  </div>
                )}

                {sel && (
                  <div style={{
                    marginTop: '6px', padding: '5px 10px',
                    background: `${meta.color}0a`,
                    border: `0.5px solid ${meta.color}25`,
                    borderRadius: '8px',
                    display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: '11px', color: meta.color, fontWeight: 600 }}>{meta.emoji} {sel.providerLabel}</span>
                    <span style={{ color: 'rgba(60,60,67,0.25)', fontSize: '11px' }}>·</span>
                    <span style={{ fontSize: '11px', color: 'rgba(60,60,67,0.5)' }}>Speed {sel.speedLabel}</span>
                    <span style={{ color: 'rgba(60,60,67,0.25)', fontSize: '11px' }}>·</span>
                    <span style={{ fontSize: '11px', color: 'rgba(60,60,67,0.45)' }}>{sel.bestFor.slice(0, 3).join(', ')}</span>
                  </div>
                )}
              </>
            )
          })()}
        </div>

        {/* Advanced Settings Toggle */}
        <button
          onClick={() => setShowAdvanced(v => !v)}
          style={{
            width: '100%',
            padding: '9px 12px',
            background: showAdvanced ? 'rgba(0,122,255,0.07)' : 'rgba(118,118,128,0.07)',
            border: `0.5px solid ${showAdvanced ? 'rgba(0,122,255,0.2)' : 'rgba(118,118,128,0.18)'}`,
            borderRadius: '12px',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '10px',
            color: showAdvanced ? '#007aff' : 'rgba(60,60,67,0.6)',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          <span>⚙️ Language · Style · Ratio · Models</span>
          <span style={{ fontSize: '10px' }}>{showAdvanced ? '▲ hide' : '▼ show'}</span>
        </button>

        {/* Collapsible Advanced Section */}
        {showAdvanced && (<>

        {/* Language */}
        <div style={{ marginBottom: '14px' }}>
          <span style={labelStyle}>Narration Language</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {([
              { id: 'id', label: '🇮🇩 Indonesia' },
              { id: 'en', label: '🇬🇧 English' },
            ] as const).map(l => (
              <button key={l.id} onClick={() => setLanguage(l.id)}
                style={pillBtn(language === l.id, '#007aff')}>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Tone */}
        <div style={{ marginBottom: '14px' }}>
          <span style={labelStyle}>Content Tone</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
            {TONES.map(t => (
              <button key={t.id} onClick={() => setTone(t.id)} style={{
                padding: '8px 10px', borderRadius: '12px', border: 'none',
                background: tone === t.id
                  ? 'linear-gradient(135deg, #ff6b35, #ff4500)'
                  : 'rgba(118,118,128,0.08)',
                color: tone === t.id ? 'white' : '#1d1d1f',
                fontSize: '11px', fontWeight: tone === t.id ? 700 : 500,
                cursor: 'pointer', textAlign: 'left',
                boxShadow: tone === t.id ? '0 2px 12px rgba(255,107,53,0.35)' : 'none',
                transition: 'all 0.2s',
              }}>
                <div>{t.label}</div>
                <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '1px' }}>{t.desc}</div>
              </button>
            ))}
          </div>
          {VEO_TONES.includes(tone) && (
            <div style={{
              marginTop: '6px', padding: '8px 10px',
              background: 'rgba(255,107,53,0.06)',
              border: '0.5px solid rgba(255,107,53,0.2)',
              borderRadius: '10px', fontSize: '10px',
              color: 'rgba(60,60,67,0.6)',
            }}>
              🎬 Veo 3.1 prompts akan di-generate untuk tone ini — siap di-paste ke Google AI Studio
            </div>
          )}
        </div>

        {/* Art Style */}
        <div style={{ marginBottom: '14px' }}>
          <span style={labelStyle}>Art Style</span>
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
                  padding: '8px 3px',
                  borderRadius: '12px',
                  border: 'none',
                  background: artStyle === s.id ? '#007aff' : 'rgba(118,118,128,0.12)',
                  color: artStyle === s.id ? 'white' : '#1d1d1f',
                  fontSize: '12px',
                  fontWeight: artStyle === s.id ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: artStyle === s.id ? '0 4px 12px rgba(0,122,255,0.3)' : 'none',
                }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Aspect Ratio */}
        <div style={{ marginBottom: '14px' }}>
          <span style={labelStyle}>Aspect Ratio</span>
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
                  padding: '8px 3px',
                  borderRadius: '12px',
                  border: 'none',
                  background: aspectRatio === r.id ? '#007aff' : 'rgba(118,118,128,0.12)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: aspectRatio === r.id ? '0 4px 12px rgba(0,122,255,0.3)' : 'none',
                }}>
                <div style={{ fontSize: '15px', marginBottom: '2px' }}>{r.icon}</div>
                <div style={{ color: aspectRatio === r.id ? 'white' : '#1d1d1f', fontSize: '12px', fontWeight: 700 }}>{r.label}</div>
                <div style={{ color: aspectRatio === r.id ? 'rgba(255,255,255,0.75)' : 'rgba(60,60,67,0.5)', fontSize: '10px' }}>{r.desc}</div>
              </button>
            ))}
          </div>
          <div style={{
            marginTop: '6px', padding: '6px 10px',
            background: 'rgba(0,122,255,0.06)',
            border: '0.5px solid rgba(0,122,255,0.15)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <span style={{ fontSize: '11px' }}>🎬</span>
            <span style={{ color: 'rgba(60,60,67,0.5)', fontSize: '11px' }}>
              Resolution: <span style={{ color: '#007aff', fontWeight: 600 }}>1080p</span>
              {' · '}Output: <span style={{ color: '#007aff', fontWeight: 600 }}>
                {aspectRatio === '9_16' ? '1080×1920' :
                 aspectRatio === '16_9' ? '1920×1080' :
                 aspectRatio === '1_1' ? '1080×1080' : '864×1080'}
              </span>
            </span>
          </div>
        </div>

        {/* Image Model */}
        <div style={{ marginBottom: '14px' }}>
          <span style={labelStyle}>Image Model</span>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            <style>{`.model-pills::-webkit-scrollbar{display:none}`}</style>
            {IMAGE_MODELS.map(m => (
              <button
                key={m.id}
                className="model-pills"
                onClick={() => setImageModel(m.id)}
                style={{
                  flexShrink: 0,
                  padding: '6px 9px',
                  borderRadius: '10px',
                  border: imageModel === m.id ? '1.5px solid #007aff' : '0.5px solid rgba(0,0,0,0.1)',
                  background: imageModel === m.id ? 'rgba(0,122,255,0.1)' : 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: '1px',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{
                    padding: '1px 4px', borderRadius: '4px',
                    background: m.tag === 'Qwen' ? 'rgba(255,140,0,0.15)' : m.tag === 'GLM' ? 'rgba(6,182,212,0.15)' : 'rgba(0,122,255,0.12)',
                    color: m.tag === 'Qwen' ? '#ff8c00' : m.tag === 'GLM' ? '#06b6d4' : '#007aff',
                    fontSize: '8px', fontWeight: 700,
                  }}>{m.tag}</span>
                  <span style={{ color: '#1d1d1f', fontSize: '12px', fontWeight: 600 }}>{m.label}</span>
                </div>
                <span style={{ color: 'rgba(60,60,67,0.45)', fontSize: '10px' }}>{m.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Video Model */}
        <div style={{ marginBottom: '14px' }}>
          <span style={labelStyle}>Video Model</span>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            {VIDEO_MODELS_HOME.map(m => (
              <button
                key={m.id}
                onClick={() => setVideoModel(m.id)}
                style={{
                  flexShrink: 0,
                  padding: '6px 9px',
                  borderRadius: '10px',
                  border: videoModel === m.id ? '1.5px solid #007aff' : '0.5px solid rgba(0,0,0,0.1)',
                  background: videoModel === m.id ? 'rgba(0,122,255,0.1)' : 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: '1px',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{
                    padding: '1px 4px', borderRadius: '4px',
                    background: m.tag === 'Qwen' ? 'rgba(255,140,0,0.15)' : m.tag === 'GLM' ? 'rgba(6,182,212,0.15)' : 'rgba(0,122,255,0.12)',
                    color: m.tag === 'Qwen' ? '#ff8c00' : m.tag === 'GLM' ? '#06b6d4' : '#007aff',
                    fontSize: '8px', fontWeight: 700,
                  }}>{m.tag}</span>
                  <span style={{ color: '#1d1d1f', fontSize: '12px', fontWeight: 600 }}>{m.label}</span>
                </div>
                <span style={{ color: 'rgba(60,60,67,0.45)', fontSize: '10px' }}>{m.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Audio Engine */}
        <div style={{ marginBottom: '14px' }}>
          <span style={labelStyle}>Audio Engine</span>
          <select
            value={audioModel}
            onChange={e => setAudioModel(e.target.value as 'polly' | 'elevenlabs')}
            style={dropdownStyle}
          >
            <option value="polly">AWS Polly — Low Cost</option>
            <option value="elevenlabs">ElevenLabs — Premium Voice</option>
          </select>
        </div>

        </>)}

        {/* Total Duration */}
        <div style={{ marginBottom: '17px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
            <span style={labelStyle}>Total Duration</span>
            <span style={{ color: '#007aff', fontSize: '13px', fontWeight: 700 }}>{totalDuration}s</span>
          </div>
          <input
            type="range" min={15} max={120} step={5}
            value={totalDuration}
            onChange={e => setTotalDuration(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#007aff' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(60,60,67,0.4)', fontSize: '11px', marginTop: '3px' }}>
            <span>15s</span><span>120s</span>
          </div>
        </div>

        {/* Scenes */}
        <div style={{ marginBottom: '17px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px', alignItems: 'center' }}>
            <span style={labelStyle}>Scenes</span>
            <span style={{ color: '#ff6b35', fontSize: '13px', fontWeight: 700 }}>
              {scenes}
              <span style={{ fontSize: '10px', color: 'rgba(60,60,67,0.4)', marginLeft: '6px', fontWeight: 400 }}>(~{scenes * 7}s total)</span>
            </span>
          </div>
          <input
            type="range" min={3} max={15} value={scenes}
            onChange={e => setScenes(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#ff6b35' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(60,60,67,0.4)', fontSize: '11px', marginTop: '3px' }}>
            <span>3</span><span>15</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(255,59,48,0.08)',
            border: '0.5px solid rgba(255,59,48,0.2)',
            borderRadius: '12px',
            padding: '8px 12px',
            color: '#ff3b30',
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
            padding: '12px',
            borderRadius: '16px',
            border: 'none',
            background: loading ? 'rgba(255,107,53,0.5)' : 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)',
            boxShadow: loading ? 'none' : '0 4px 20px rgba(255,107,53,0.4)',
            color: 'white',
            fontSize: '16px',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s',
            letterSpacing: '0.01em',
          }}>
          {loading ? '✨ Generating Storyboard...' : '🎬 Generate Storyboard'}
        </button>
      </div>

      {/* Footer */}
      <p style={{ color: 'rgba(60,60,67,0.25)', fontSize: '10px', marginTop: '12px' }}>
        Fuzzy Short · AI Video
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
