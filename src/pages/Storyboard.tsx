import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { SceneAssets, SceneAssetsMap, GenerationStatus, AudioHistoryItem, VideoPromptData } from '../types/schema'
import { defaultSceneAssets, saveVideoJob, loadVideoJob, clearVideoJob, redistributeDurations } from '../types/schema'
import { useUser } from '@clerk/clerk-react'
import { generateImage, generateAudio, checkVideoStatus, startVideoJob, enhancePrompt, rewriteVO, regenerateVideoPrompt, getApiHeaders, WORKER_URL } from '../lib/api'
import { useUserApi } from '../lib/userApi'
import { useHistoryStore } from '../store/historyStore'
import { useCostStore } from '../store/costStore'
import { useStoryboardSessionStore } from '../store/storyboardSessionStore'
import { estimateImageCost, estimateVideoCost, estimateAudioCost, formatCost } from '../lib/costEstimate'
import VeoPromptSection from '../components/VeoPromptSection'
import { isVeoTone } from '../lib/veoSubtones'

const POLLY_VOICES_ID = ['Marlene', 'Andika'] as const
const POLLY_VOICES_EN = ['Ruth', 'Danielle', 'Joanna', 'Kimberly', 'Salli', 'Kendra', 'Matthew', 'Joey', 'Stephen', 'Gregory'] as const
const ELEVENLABS_VOICES = ['Bella', 'Adam', 'Rachel', 'Antoni', 'Josh', 'Arnold', 'Sam', 'Elli', 'Domi'] as const

const IMAGE_MODELS: { id: string; label: string; tag: 'AWS' | 'Qwen'; desc: string; provider: 'bedrock' | 'dashscope'; badge?: string }[] = [
  { id: 'nova_canvas',        label: 'Nova Canvas',        tag: 'AWS',  desc: 'Fast & consistent', provider: 'bedrock' },
  { id: 'sd35',               label: 'SD 3.5 Large',       tag: 'AWS',  desc: 'Best quality',       provider: 'bedrock' },
  { id: 'qwen-image-2.0-pro', label: 'Qwen Image 2.0 Pro', tag: 'Qwen', desc: 'Best quality',       provider: 'dashscope', badge: '⭐' },
  { id: 'qwen-image-2.0',     label: 'Qwen Image 2.0',     tag: 'Qwen', desc: 'Balanced',            provider: 'dashscope', badge: '✨' },
  { id: 'wan2.6-image',       label: 'Wan 2.6 Image',      tag: 'Qwen', desc: 'Latest Wan model',    provider: 'dashscope', badge: '🆕' },
  { id: 'wanx2.1-t2i-turbo', label: 'Wanx 2.1 Turbo',     tag: 'Qwen', desc: 'Fast (legacy)',       provider: 'dashscope', badge: '⚡' },
]

const VIDEO_MODELS: { id: string; label: string; tag: 'AWS' | 'Qwen'; desc: string; provider: 'bedrock' | 'dashscope'; badge?: string }[] = [
  { id: 'nova_reel',         label: 'Nova Reel',         tag: 'AWS',  desc: 'Up to 6s',            provider: 'bedrock' },
  { id: 'wan2.1-i2v-plus',  label: 'Wan2.1 I2V Plus',  tag: 'Qwen', desc: 'Image→Video best',    provider: 'dashscope', badge: '⭐' },
  { id: 'wan2.1-i2v-turbo', label: 'Wan2.1 I2V Turbo', tag: 'Qwen', desc: 'Image→Video fast',    provider: 'dashscope', badge: '⚡' },
  { id: 'wan2.1-t2v-plus',  label: 'Wan2.1 T2V Plus',  tag: 'Qwen', desc: 'Text→Video best',     provider: 'dashscope', badge: '📝⭐' },
  { id: 'wan2.1-t2v-turbo', label: 'Wan2.1 T2V Turbo', tag: 'Qwen', desc: 'Text→Video fast',     provider: 'dashscope', badge: '📝⚡' },
]

const dropdownStyle: React.CSSProperties = {
  background: 'rgba(118,118,128,0.1)',
  border: '0.5px solid rgba(0,0,0,0.08)',
  borderRadius: '10px',
  padding: '5px 24px 5px 8px',
  color: '#1d1d1f',
  fontSize: '11px',
  outline: 'none',
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7' viewBox='0 0 10 7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%233c3c43' stroke-width='1.2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 7px center',
  fontFamily: 'inherit',
}

interface PreviewModal {
  type: 'image' | 'video'
  url: string
  sceneNum: number
}

export function Storyboard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('id')

  // Session store
  const sessions = useStoryboardSessionStore((s) => s.sessions)
  const createSession = useStoryboardSessionStore((s) => s.createSession)
  const updateAssetInStore = useStoryboardSessionStore((s) => s.updateAsset)
  const updateSession = useStoryboardSessionStore((s) => s.updateSession)

  const { user } = useUser()
  const { saveSceneAsset } = useUserApi()

  const [hasApiKeys, setHasApiKeys] = useState(true) // optimistic default

  useEffect(() => {
    if (!user?.id) return
    const storageKey = `fuzzy_settings_${user.id}`
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        const hasAws = !!(parsed.awsAccessKeyId && parsed.awsSecretAccessKey)
        const hasDashscope = !!parsed.dashscopeApiKey
        setHasApiKeys(hasAws || hasDashscope)
      } catch { setHasApiKeys(false) }
    } else {
      setHasApiKeys(false)
    }
  }, [user?.id])

  // Local UI state (not persisted)
  const [storyboard, setStoryboard] = useState<Record<string, unknown> | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [rawJson, setRawJson] = useState('')
  const [imageModel, setImageModel] = useState<string>('nova_canvas')
  const [videoModel, setVideoModel] = useState<Record<number, string>>({})
  const [defaultVideoModel, setDefaultVideoModel] = useState('nova_reel')
  const [audioEngine, setAudioEngine] = useState<'polly' | 'elevenlabs'>('polly')
  const [audioVoice, setAudioVoice] = useState('Ruth')
  const [language, setLanguage] = useState('id')

  // Per-scene UI state
  const [collapsedScenes, setCollapsedScenes] = useState<Set<number>>(new Set())
  const [editedPrompts, setEditedPrompts] = useState<Record<number, string>>({})
  const [previewModal, setPreviewModal] = useState<PreviewModal | null>(null)

  // Duration control
  const [totalDuration, setTotalDuration] = useState(60)
  const [sceneDurations, setSceneDurations] = useState<Record<number, number>>({})

  // Prompt view toggle (text | json) per scene
  const [promptView, setPromptView] = useState<Record<number, 'text' | 'json'>>({})

  // VO Rewrite state
  const [rewritingVO, setRewritingVO] = useState<Record<number, boolean>>({})
  const [customVO, setCustomVO] = useState<Record<number, string>>({})
  const [voCharInfo, setVoCharInfo] = useState<Record<number, { count: number; limit: number }>>({})

  // Poll counts for display
  const [videoPollDisplayCounts, setVideoPollDisplayCounts] = useState<Record<number, number>>({})

  // ElevenLabs voice settings
  const [elStability, setElStability] = useState(0.7)
  const [elSimilarity, setElSimilarity] = useState(0.75)
  const [elStyle, setElStyle] = useState(0.5)

  // Per-scene video params
  const [videoSeed, setVideoSeed] = useState<Record<number, number | undefined>>({})
  const [promptExtend, setPromptExtend] = useState<Record<number, boolean>>({})

  // Video prompt UI state
  const [videoPromptExpanded, setVideoPromptExpanded] = useState<Record<number, boolean>>({})
  const [videoPromptView, setVideoPromptView] = useState<Record<number, 'text' | 'json'>>({})
  const [regenVideoPrompt, setRegenVideoPrompt] = useState<Record<number, boolean>>({})

  // Desktop layout state
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' && window.innerWidth >= 768)
  const [activeScene, setActiveScene] = useState<number>(1)
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Inject CSS animations once on mount
  useEffect(() => {
    if (document.getElementById('fuzzy-animations')) return
    const style = document.createElement('style')
    style.id = 'fuzzy-animations'
    style.textContent = `
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      @keyframes pulse-ring {
        0% { opacity: 0.6; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.1); }
        100% { opacity: 0.6; transform: scale(1); }
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes float-up {
        0% { opacity: 0; transform: translateY(4px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes progress-bar {
        0% { width: 0%; }
        100% { width: 90%; }
      }
      @keyframes gradient-flow {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
    `
    document.head.appendChild(style)
  }, [])

  // Page-level dismissable toast
  const [pageToast, setPageToast] = useState<{msg: string, type: 'error'|'success'} | null>(null)

  // Cost tracker UI state
  const [costExpanded, setCostExpanded] = useState(false)
  const [generatingAllVeo, setGeneratingAllVeo] = useState(false)
  const [costFilter, setCostFilter] = useState<string | null>(null)

  // Video polling refs
  const videoPollingRefs = useRef<Record<number, ReturnType<typeof setInterval>>>({})
  // Dashscope polling refs (image + video async tasks)
  const dashscopePollingRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({})
  // Ref for activeSessionId to avoid stale closures in polling callbacks
  const activeSessionIdRef = useRef<string | null>(null)

  // Cost tracking
  const addCostEntry = useCostStore((s) => s.addEntry)
  const sessionTotal = useCostStore((s) => s.sessionTotal)
  const costEntries = useCostStore((s) => s.entries)
  const clearSession = useCostStore((s) => s.clearSession)

  // History integration
  const historyItems = useHistoryStore((s) => s.items)
  const addHistoryItem = useHistoryStore((s) => s.addItem)
  const isAlreadySaved = rawJson
    ? historyItems.some((item) => item.storyboard_data === rawJson)
    : false

  // Get assets from store (or empty)
  const storedAssets: SceneAssetsMap = activeSessionId
    ? (sessions[activeSessionId]?.assets || {})
    : {}

  // Reset voice when engine or language changes
  useEffect(() => {
    if (audioEngine === 'polly') {
      setAudioVoice(language === 'id' ? 'Marlene' : 'Ruth')
    } else {
      setAudioVoice('Bella')
    }
  }, [audioEngine, language])

  const handleSave = () => {
    if (!storyboard || !rawJson || isAlreadySaved) return
    const scenes = (storyboard.scenes as unknown[]) || []
    addHistoryItem({
      title: (storyboard.title as string) || 'Untitled',
      platform: (storyboard.platform as string) || '',
      art_style: (storyboard.art_style as string) || '',
      language: (storyboard.language as string) || 'en',
      brain_model: '',
      scenes_count: scenes.length,
      storyboard_data: rawJson,
    })
    toast.success('Saved to history')
  }

  const handleMinimize = () => {
    if (activeSessionId) {
      updateSession(activeSessionId, { isMinimized: true })
    }
    navigate('/')
  }

  // Cleanup polling intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(videoPollingRefs.current).forEach(clearInterval)
      Object.values(dashscopePollingRefs.current).forEach(clearInterval)
    }
  }, [])

  // Auto-hide page toast after 5s
  useEffect(() => {
    if (!pageToast) return
    const t = setTimeout(() => setPageToast(null), 5000)
    return () => clearTimeout(t)
  }, [pageToast])

  // Load storyboard from session store or sessionStorage
  useEffect(() => {
    let raw: string | null = null
    let sid: string | null = null

    // Try to load from session store by ID
    if (sessionId && sessions[sessionId]) {
      const session = sessions[sessionId]
      raw = session.rawJson
      sid = sessionId
      setImageModel(session.imageModel)
      setAudioEngine(session.audioEngine)
      setAudioVoice(session.audioVoice)
      setLanguage(session.language)
    } else {
      // Fallback: create new session from sessionStorage
      raw = sessionStorage.getItem('storyboard_result')
      if (!raw) { navigate('/'); return }

      const storedImageModel = sessionStorage.getItem('fuzzy_gen_imageModel')
      const imgModel = storedImageModel && IMAGE_MODELS.some(m => m.id === storedImageModel)
        ? storedImageModel : 'nova_canvas'
      const storedAudioModel = sessionStorage.getItem('fuzzy_gen_audioModel')
      const audModel = (storedAudioModel === 'polly' || storedAudioModel === 'elevenlabs')
        ? storedAudioModel : 'polly'
      const storedVideoModel = sessionStorage.getItem('fuzzy_gen_videoModel')
      if (storedVideoModel) setDefaultVideoModel(storedVideoModel)

      setImageModel(imgModel)
      setAudioEngine(audModel)

      // Load language from settings
      const stored = localStorage.getItem('fuzzy_short_settings')
      if (stored) {
        const keys = JSON.parse(stored)
        if (keys.language) setLanguage(keys.language)
      }

      // Parse to get title
      let parsedTitle = 'Untitled'
      try {
        const parsed = JSON.parse(raw)
        let data = parsed
        if (!data.scenes) {
          if (Array.isArray(parsed.storyboard?.scenes)) data = parsed.storyboard
          else if (Array.isArray(parsed.data?.scenes)) data = parsed.data
          else if (Array.isArray(parsed.project?.scenes)) data = parsed.project
        }
        parsedTitle = data.title || 'Untitled'
      } catch { /* ignore */ }

      // Create a new session
      const newId = createSession({
        rawJson: raw,
        title: parsedTitle,
        imageModel: imgModel,
        audioEngine: audModel,
        audioVoice: audModel === 'polly' ? 'Ruth' : 'Bella',
        language: localStorage.getItem('fuzzy_short_settings')
          ? JSON.parse(localStorage.getItem('fuzzy_short_settings')!).language || 'id'
          : 'id',
      })
      sid = newId
      // Update URL with new session ID without navigating away
      window.history.replaceState(null, '', `/storyboard?id=${newId}`)
    }

    setRawJson(raw)
    setActiveSessionId(sid)
    activeSessionIdRef.current = sid

    try {
      const parsed = JSON.parse(raw)
      let data = parsed
      if (!data.scenes) {
        if (Array.isArray(parsed.storyboard?.scenes)) data = parsed.storyboard
        else if (Array.isArray(parsed.data?.scenes)) data = parsed.data
        else if (Array.isArray(parsed.project?.scenes)) data = parsed.project
      }
      if (!data.scenes || !Array.isArray(data.scenes) || data.scenes.length === 0) {
        navigate('/')
        return
      }
      setStoryboard(data)
      if (data.selected_video_model) setDefaultVideoModel(data.selected_video_model as string)
      // Initialize scene durations evenly across 60s default
      const scenes = (data.scenes as Record<string, unknown>[]) || []
      const initDurations: Record<number, number> = {}
      scenes.forEach((_, i) => { initDurations[i + 1] = Math.max(2, Math.min(6, Math.round(60 / scenes.length))) })
      setSceneDurations(initDurations)
      // Pre-populate video prompts from brain-generated JSON
      scenes.forEach((scene) => {
        const sceneNum = scene.scene_number as number
        const brainVideoPrompt = scene.video_prompt as VideoPromptData | undefined
        if (brainVideoPrompt && sid) {
          updateAssetInStore(sid, sceneNum, {
            videoPrompt: brainVideoPrompt,
            customVideoPrompt: brainVideoPrompt.full_prompt,
          })
        }
        const brainVeoPrompt = scene.veo_prompt as Record<string, unknown> | undefined
        if (brainVeoPrompt && sid) {
          updateAssetInStore(sid, sceneNum, { veoPrompt: brainVeoPrompt as SceneAssets['veoPrompt'] })
        }
      })
    } catch { navigate('/') }
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto re-poll any videos that were in 'generating' state when we load
  useEffect(() => {
    if (!activeSessionId) return
    const session = sessions[activeSessionId]
    if (!session) return
    Object.entries(session.assets).forEach(([sceneNumStr, asset]) => {
      const sceneNum = Number(sceneNumStr)
      if (asset.videoStatus === 'generating' && asset.videoJobId) {
        pollVideoStatus(sceneNum, asset.videoJobId)
      }
    })
  }, [activeSessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateAsset = useCallback((sceneNum: number, update: Partial<SceneAssets>) => {
    if (activeSessionId) {
      updateAssetInStore(activeSessionId, sceneNum, update)
    }
  }, [activeSessionId, updateAssetInStore])

  // ─── Generate All Veo Prompts ───────────────────────────────
  const handleGenerateAllVeo = async () => {
    if (!storyboard || generatingAllVeo) return
    const scenes = (storyboard.scenes as Record<string, unknown>[]) || []
    const brainModel = (storyboard.brain_model as string) || 'gemini-2.0-flash'
    const headers = { 'Content-Type': 'application/json', ...getApiHeaders(user?.id) }

    setGeneratingAllVeo(true)
    let generated = 0
    for (const scene of scenes) {
      const sceneNum = scene.scene_number as number
      try {
        const res = await fetch(`${WORKER_URL}/api/brain/regenerate-veo-prompt`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            scene_number: sceneNum,
            vo_script: (scene.vo_script as string) || '',
            image_prompt: editedPrompts[sceneNum] || (scene.image_prompt as string) || '',
            tone: (storyboard.tone as string) || 'narrative_storytelling',
            platform: (storyboard.platform as string) || 'TikTok',
            brain_model: brainModel,
          }),
        })
        const data = await res.json() as { veo_prompt?: SceneAssets['veoPrompt']; error?: string }
        if (data.veo_prompt) {
          updateAsset(sceneNum, { veoPrompt: data.veo_prompt })
          saveSceneAsset({
            storyboard_id: activeSessionId || 'storyboard',
            scene_number: sceneNum,
            video_prompt: JSON.stringify(data.veo_prompt),
          }).catch(console.error)
          generated++
        }
      } catch (e) {
        console.error(`Veo gen failed scene ${sceneNum}:`, e)
      }
    }
    setGeneratingAllVeo(false)
    if (generated > 0) {
      toast(`Veo prompts generated for ${generated}/${scenes.length} scenes`, { icon: '🎬', duration: 3000 })
    }
  }

  // ─── Duration control ──────────────────────────────────────
  const handleTotalDurationChange = (total: number) => {
    setTotalDuration(total)
    const scenes = (storyboard?.scenes as Record<string, unknown>[]) || []
    const redistributed = redistributeDurations(scenes.length, total)
    const newDurations: Record<number, number> = {}
    redistributed.forEach(d => { newDurations[d.sceneNumber] = d.durationSeconds })
    setSceneDurations(newDurations)
  }

  const handleSceneDurationChange = (sceneNum: number, duration: number) => {
    setSceneDurations(prev => ({ ...prev, [sceneNum]: duration }))
  }

  // Also update session settings when user changes them
  const handleImageModelChange = (val: string) => {
    setImageModel(val)
    if (activeSessionId) updateSession(activeSessionId, { imageModel: val })
  }

  const handleAudioEngineChange = (val: 'polly' | 'elevenlabs') => {
    setAudioEngine(val)
    if (activeSessionId) updateSession(activeSessionId, { audioEngine: val })
  }

  const handleAudioVoiceChange = (val: string) => {
    setAudioVoice(val)
    if (activeSessionId) updateSession(activeSessionId, { audioVoice: val })
  }

  // --- Copy helper ---
  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied!')
    } catch {
      toast.error('Copy failed')
    }
  }, [])

  // --- Download helper ---
  const handleDownload = useCallback(async (url: string, filename: string) => {
    toast('Downloading...', { icon: '⬇️', duration: 2000 })
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
      toast.success('Downloaded!')
    } catch {
      toast.error('Download failed')
    }
  }, [])

  // --- Cancel video polling ---
  const handleCancelVideo = useCallback((sceneNum: number) => {
    if (videoPollingRefs.current[sceneNum]) {
      clearInterval(videoPollingRefs.current[sceneNum])
      delete videoPollingRefs.current[sceneNum]
    }
    setVideoPollDisplayCounts(prev => { const n = { ...prev }; delete n[sceneNum]; return n })
    updateAsset(sceneNum, { videoStatus: 'error', videoError: 'Cancelled' })
  }, [updateAsset])

  // --- Video polling ---
  const pollVideoStatus = useCallback((sceneNum: number, jobId: string) => {
    if (videoPollingRefs.current[sceneNum]) {
      clearInterval(videoPollingRefs.current[sceneNum])
    }
    let pollCount = 0
    const interval = setInterval(async () => {
      pollCount++
      setVideoPollDisplayCounts(prev => ({ ...prev, [sceneNum]: pollCount }))

      // Timeout after 90 polls (12 min)
      if (pollCount > 90) {
        clearInterval(interval)
        delete videoPollingRefs.current[sceneNum]
        setVideoPollDisplayCounts(prev => { const n = { ...prev }; delete n[sceneNum]; return n })
        updateAsset(sceneNum, { videoStatus: 'error', videoError: 'Timed out after 12 min' })
        setPageToast({ msg: `Scene ${sceneNum} video timed out`, type: 'error' })
        return
      }

      try {
        const result = await checkVideoStatus(jobId)
        if (result.status === 'done' && result.video_url) {
          clearInterval(interval)
          delete videoPollingRefs.current[sceneNum]
          setVideoPollDisplayCounts(prev => { const n = { ...prev }; delete n[sceneNum]; return n })
          updateAsset(sceneNum, { videoStatus: 'done', videoUrl: result.video_url, videoJobId: jobId })
          toast.success(`Scene ${sceneNum} video ready!`)
          saveSceneAsset({
            storyboard_id: activeSessionIdRef.current || 'storyboard',
            scene_number: sceneNum,
            video_url: result.video_url,
            video_model: 'nova_reel',
          }).catch(console.error)
        } else if (result.status === 'failed') {
          clearInterval(interval)
          delete videoPollingRefs.current[sceneNum]
          setVideoPollDisplayCounts(prev => { const n = { ...prev }; delete n[sceneNum]; return n })
          updateAsset(sceneNum, {
            videoStatus: 'error',
            videoError: result.message || 'Video generation failed',
            videoJobId: jobId,
          })
          setPageToast({ msg: `Scene ${sceneNum} video failed`, type: 'error' })
        }
      } catch {
        // Network error — keep polling
      }
    }, 8000)
    videoPollingRefs.current[sceneNum] = interval
  }, [updateAsset, saveSceneAsset])

  const startDashscopePolling = useCallback((sceneNum: number, taskId: string, type: 'image' | 'video') => {
    const key = `${type}_${sceneNum}_${taskId}`
    if (dashscopePollingRefs.current[key]) {
      clearInterval(dashscopePollingRefs.current[key])
    }
    const intervalMs = type === 'image' ? 5000 : 8000
    const maxPolls = type === 'image' ? 60 : 90
    let pollCount = 0

    const interval = setInterval(async () => {
      pollCount++
      if (pollCount > maxPolls) {
        clearInterval(interval)
        delete dashscopePollingRefs.current[key]
        const errMsg = `Dashscope ${type} timed out`
        if (type === 'image') {
          updateAsset(sceneNum, { imageStatus: 'error', imageError: errMsg })
        } else {
          updateAsset(sceneNum, { videoStatus: 'error', videoError: errMsg })
        }
        setPageToast({ msg: `Scene ${sceneNum} ${type} timed out`, type: 'error' })
        return
      }

      try {
        const res = await fetch(`${WORKER_URL}/api/dashscope/task/${taskId}`, {
          headers: getApiHeaders(user?.id),
        })
        const data = await res.json() as { status: string; url?: string; message?: string }

        if (data.status === 'done' && data.url) {
          clearInterval(interval)
          delete dashscopePollingRefs.current[key]
          if (type === 'image') {
            updateAsset(sceneNum, { imageStatus: 'done', imageUrl: data.url })
            toast.success(`Scene ${sceneNum} image ready (Qwen)!`)
            saveSceneAsset({
              storyboard_id: activeSessionIdRef.current || 'storyboard',
              scene_number: sceneNum,
              image_url: data.url,
            }).catch(console.error)
          } else {
            updateAsset(sceneNum, { videoStatus: 'done', videoUrl: data.url })
            toast.success(`Scene ${sceneNum} video ready (Qwen)!`)
            saveSceneAsset({
              storyboard_id: activeSessionIdRef.current || 'storyboard',
              scene_number: sceneNum,
              video_url: data.url,
            }).catch(console.error)
          }
        } else if (data.status === 'error') {
          clearInterval(interval)
          delete dashscopePollingRefs.current[key]
          if (type === 'image') {
            updateAsset(sceneNum, { imageStatus: 'error', imageError: data.message || 'Dashscope error' })
          } else {
            updateAsset(sceneNum, { videoStatus: 'error', videoError: data.message || 'Dashscope error' })
          }
          setPageToast({ msg: `Scene ${sceneNum} ${type} failed: ${data.message}`, type: 'error' })
        }
        // status === 'processing' → keep polling
      } catch {
        // Network error — keep polling
      }
    }, intervalMs)

    dashscopePollingRefs.current[key] = interval
  }, [updateAsset, saveSceneAsset]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerateImage = async (scene: Record<string, unknown>) => {
    const sceneNum = scene.scene_number as number
    const prompt = editedPrompts[sceneNum] ?? (scene.image_prompt as string)
    updateAsset(sceneNum, { imageStatus: 'generating', imageError: undefined })
    try {
      const data = storyboard as Record<string, unknown>
      const artStyle = (data.art_style as string) || 'cinematic_realistic'
      const aspectRatio = (data.aspect_ratio as string) || '9_16'

      // Enhance prompt via Claude first
      let finalPrompt = prompt
      try {
        const enhanced = await enhancePrompt({
          raw_prompt: prompt,
          art_style: artStyle,
          aspect_ratio: aspectRatio,
          mood: scene.mood as string | undefined,
        })
        finalPrompt = enhanced.enhanced_prompt
        updateAsset(sceneNum, { enhancedPrompt: finalPrompt })
      } catch { /* fall through with original prompt */ }

      const selectedImageModel = IMAGE_MODELS.find(m => m.id === imageModel) || IMAGE_MODELS[0]

      if (selectedImageModel.provider === 'dashscope') {
        // Async Dashscope image generation
        const startRes = await fetch(`${WORKER_URL}/api/dashscope/image/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getApiHeaders(user?.id) },
          body: JSON.stringify({
            prompt: finalPrompt,
            image_model: selectedImageModel.id,
            aspect_ratio: aspectRatio,
            scene_number: sceneNum,
            project_id: (data.project_id as string) || 'storyboard',
          }),
        })
        const startData = await startRes.json() as { task_id?: string; error?: string }
        if (!startRes.ok || !startData.task_id) {
          throw new Error(startData.error || 'Failed to start Dashscope image task')
        }
        toast(`Scene ${sceneNum} image started (Qwen) · polling every 5s`, { icon: '🖼️', duration: 4000 })
        startDashscopePolling(sceneNum, startData.task_id, 'image')
      } else {
        // AWS Bedrock image generation
        const result = await generateImage({
          prompt: finalPrompt,
          scene_number: sceneNum,
          project_id: (data.project_id as string) || 'storyboard',
          aspect_ratio: aspectRatio,
          art_style: artStyle,
          image_model: imageModel as 'nova_canvas' | 'sd35',
        })
        const imgCost = estimateImageCost(imageModel)
        const modelLabel = imageModel === 'sd35' ? 'SD 3.5 Large' : 'Nova Canvas'
        updateAsset(sceneNum, { imageStatus: 'done', imageUrl: result.image_url })
        addCostEntry({ service: 'image', model: modelLabel, cost: imgCost })
        toast.success(`Scene ${sceneNum} image ready · ${formatCost(imgCost)}`)
        saveSceneAsset({
          storyboard_id: (data.project_id as string) || activeSessionId || 'storyboard',
          scene_number: sceneNum,
          image_url: result.image_url,
          image_model: imageModel,
          enhanced_prompt: finalPrompt,
        }).catch(console.error)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      const isKeyError = msg.toLowerCase().includes('credentials') || msg.toLowerCase().includes('api key required')
      updateAsset(sceneNum, {
        imageStatus: 'error',
        imageError: isKeyError ? '🔑 API key required — go to Settings to add your keys' : msg,
      })
      setPageToast({ msg: `Image failed: ${isKeyError ? 'API key required' : msg}`, type: 'error' })
    }
  }

  const handleGenerateVideo = async (scene: Record<string, unknown>) => {
    const sceneNum = scene.scene_number as number
    const sceneAsset = storedAssets[sceneNum]
    updateAsset(sceneNum, { videoStatus: 'generating', videoError: undefined })
    try {
      const data = storyboard as Record<string, unknown>
      const projectId = (data.project_id as string) || 'storyboard'
      const durationSeconds = sceneDurations[sceneNum] || 6
      const aspectRatio = (data.aspect_ratio as string) || '9_16'
      const selectedVideoModel = VIDEO_MODELS.find(m => m.id === (videoModel[sceneNum] || defaultVideoModel)) || VIDEO_MODELS[0]

      if (selectedVideoModel.provider === 'dashscope') {
        // Async Dashscope video generation
        const startRes = await fetch(`${WORKER_URL}/api/dashscope/video/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getApiHeaders(user?.id) },
          body: JSON.stringify({
            prompt: sceneAsset?.customVideoPrompt
              || sceneAsset?.videoPrompt?.full_prompt
              || editedPrompts[sceneNum]
              || (scene.image_prompt as string),
            image_url: sceneAsset?.imageUrl,
            video_model: selectedVideoModel.id,
            aspect_ratio: aspectRatio,
            duration_seconds: durationSeconds,
            scene_number: sceneNum,
            project_id: projectId,
            prompt_extend: promptExtend[sceneNum] !== false,
          }),
        })
        const startData = await startRes.json() as { task_id?: string; error?: string }
        if (!startRes.ok || !startData.task_id) {
          throw new Error(startData.error || 'Failed to start Dashscope video task')
        }
        toast(`Scene ${sceneNum} video started (Qwen) · polling every 8s`, { icon: '🎬', duration: 4000 })
        startDashscopePolling(sceneNum, startData.task_id, 'video')
      } else {
        // AWS Nova Reel
        if (!sceneAsset?.imageUrl) {
          updateAsset(sceneNum, { videoStatus: 'error', videoError: 'Generate image first' })
          return
        }
        const result = await startVideoJob({
          image_url: sceneAsset.imageUrl,
          prompt: sceneAsset?.customVideoPrompt
            || sceneAsset?.videoPrompt?.full_prompt
            || editedPrompts[sceneNum]
            || (scene.image_prompt as string),
          scene_number: sceneNum,
          project_id: projectId,
          aspect_ratio: aspectRatio,
          duration_seconds: durationSeconds,
          seed: videoSeed[sceneNum],
        })
        const vidCost = estimateVideoCost()
        addCostEntry({ service: 'video', model: 'Nova Reel', cost: vidCost })

        if (result.job_id) {
          updateAsset(sceneNum, { videoStatus: 'generating', videoJobId: result.job_id })
          saveVideoJob({
            jobId: result.job_id,
            sceneNumber: sceneNum,
            projectId,
            startedAt: Date.now(),
            status: 'processing',
            durationSeconds,
          })
          toast(`Scene ${sceneNum} video started (${durationSeconds}s) · polling every 8s`, { icon: '🎬', duration: 4000 })
          pollVideoStatus(sceneNum, result.job_id)
        } else {
          updateAsset(sceneNum, { videoStatus: 'error', videoError: 'No job_id returned' })
          setPageToast({ msg: 'Video generation returned no job ID', type: 'error' })
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      const isKeyError = msg.toLowerCase().includes('credentials') || msg.toLowerCase().includes('api key required')
      updateAsset(sceneNum, {
        videoStatus: 'error',
        videoError: isKeyError ? '🔑 API key required — go to Settings to add your keys' : msg,
      })
      setPageToast({ msg: `Video failed: ${isKeyError ? 'API key required' : msg}`, type: 'error' })
    }
  }

  const handleRewriteVO = async (scene: Record<string, unknown>, sceneNum: number) => {
    setRewritingVO(prev => ({ ...prev, [sceneNum]: true }))
    const originalText = (scene.vo_script as string)
      || (language === 'id'
        ? (scene.text_id as string) || ''
        : (scene.text_en as string) || '')
    const data = storyboard as Record<string, unknown>
    const artStyle = (data.art_style as string) || 'cinematic_realistic'

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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setPageToast({ msg: `Rewrite VO failed: ${msg}`, type: 'error' })
    } finally {
      setRewritingVO(prev => ({ ...prev, [sceneNum]: false }))
    }
  }

  const handleRegenerateVideoPromptScene = async (scene: Record<string, unknown>, sceneNum: number) => {
    setRegenVideoPrompt(prev => ({ ...prev, [sceneNum]: true }))
    const narration = customVO[sceneNum]
      || (scene.vo_script as string)
      || (language === 'id' ? (scene.text_id as string) : (scene.text_en as string)) || ''
    const data = storyboard as Record<string, unknown>
    const artStyle = (data.art_style as string) || 'cinematic_realistic'
    const aspectRatio = (data.aspect_ratio as string) || '9_16'
    try {
      const result = await regenerateVideoPrompt({
        image_prompt: scene.image_prompt as string,
        enhanced_prompt: storedAssets[sceneNum]?.enhancedPrompt,
        mood: scene.mood as string,
        camera_angle: scene.camera_angle as string,
        scene_type: scene.scene_type as string,
        duration_seconds: sceneDurations[sceneNum] || 4,
        narration,
        art_style: artStyle,
        aspect_ratio: aspectRatio,
        scene_number: sceneNum,
        brain_model: (storyboard as any)?.brain_model,
      })
      updateAsset(sceneNum, {
        videoPrompt: result.video_prompt,
        customVideoPrompt: result.video_prompt.full_prompt,
      })
    } catch (e: any) {
      console.error('Video prompt regen failed:', e)
      setPageToast({ msg: `Video prompt regen failed: ${e.message}`, type: 'error' })
    } finally {
      setRegenVideoPrompt(prev => ({ ...prev, [sceneNum]: false }))
    }
  }

  const handleGenerateAudio = async (scene: Record<string, unknown>) => {
    const sceneNum = scene.scene_number as number
    const text = customVO[sceneNum]
      || (scene.vo_script as string)
      || (language === 'id'
        ? (scene.text_id as string) || (scene.text_en as string)
        : (scene.text_en as string) || (scene.text_id as string))
    if (!text) return
    updateAsset(sceneNum, { audioStatus: 'generating', audioError: undefined })
    try {
      const data = storyboard as Record<string, unknown>
      const result = await generateAudio({
        text,
        language,
        scene_number: sceneNum,
        project_id: (data.project_id as string) || 'storyboard',
        engine: audioEngine,
        voice: audioVoice,
        ...(audioEngine === 'elevenlabs' ? {
          stability: elStability,
          similarity_boost: elSimilarity,
          style: elStyle,
        } : {}),
      })
      const audCost = estimateAudioCost(audioEngine, text.length)
      const modelLabel = audioEngine === 'elevenlabs' ? 'ElevenLabs' : 'Polly'
      const newHistoryItem: AudioHistoryItem = {
        url: result.audio_url,
        engine: audioEngine,
        voice: audioVoice,
        timestamp: new Date().toISOString(),
      }
      const current = storedAssets[sceneNum] || defaultSceneAssets()
      const newHistory = [newHistoryItem, ...(current.audioHistory || [])].slice(0, 5)
      updateAsset(sceneNum, {
        audioStatus: 'done',
        audioUrl: result.audio_url,
        audioHistory: newHistory,
      })
      addCostEntry({ service: 'audio', model: modelLabel, cost: audCost })
      toast.success(`Scene ${sceneNum} audio ready · ${formatCost(audCost)}`)
      saveSceneAsset({
        storyboard_id: (data.project_id as string) || activeSessionIdRef.current || 'storyboard',
        scene_number: sceneNum,
        audio_url: result.audio_url,
        audio_voice: audioVoice,
        custom_vo: customVO[sceneNum] || null,
      }).catch(console.error)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      const isKeyError = msg.toLowerCase().includes('credentials') || msg.toLowerCase().includes('api key required')
      updateAsset(sceneNum, {
        audioStatus: 'error',
        audioError: isKeyError ? '🔑 API key required — go to Settings to add your keys' : msg,
      })
      setPageToast({ msg: `Audio failed: ${isKeyError ? 'API key required' : msg}`, type: 'error' })
    }
  }

  if (!storyboard) return null

  const scenes = (storyboard.scenes as Record<string, unknown>[]) || []
  const productionNotes = storyboard.production_notes as Record<string, unknown> | undefined

  const page: React.CSSProperties = {
    minHeight: '100vh',
    width: '100%',
    background: 'linear-gradient(145deg, #f2f2f7 0%, #e5e5ea 50%, #f2f2f7 100%)',
    fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
    paddingBottom: '60px',
  }

  const glassCard: React.CSSProperties = {
    background: 'rgba(255,255,255,0.78)',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    border: '0.5px solid rgba(255,255,255,0.95)',
    borderRadius: '22px',
    boxShadow: '0 2px 24px rgba(0,0,0,0.07), 0 0 0 0.5px rgba(255,255,255,0.6) inset',
    marginBottom: '11px',
    overflow: 'hidden',
  }

  const statusBadge = (status: GenerationStatus, label: string, isVideoPolling = false) => {
    const colors: Record<GenerationStatus, string> = {
      idle: 'rgba(60,60,67,0.3)',
      generating: '#ff6b35',
      done: '#34c759',
      error: '#ff3b30',
    }
    return (
      <span style={{
        fontSize: '10px', fontWeight: 600,
        color: colors[status],
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        {status === 'generating' ? (isVideoPolling ? 'Generating (2-5 min)...' : 'Generating...') :
         status === 'done' ? `${label} Ready` :
         status === 'error' ? 'Failed' : label}
      </span>
    )
  }

  const actionBtn = (
    label: string,
    onClick: () => void,
    status: GenerationStatus,
    disabled = false,
    color = '#ff6b35'
  ) => (
    <button
      onClick={onClick}
      disabled={status === 'generating' || disabled}
      style={{
        padding: '8px 12px',
        borderRadius: '12px',
        border: 'none',
        background: status === 'done' ? 'rgba(52,199,89,0.12)' :
                    disabled ? 'rgba(118,118,128,0.1)' :
                    status === 'generating' ? `${color}33` :
                    color,
        color: status === 'done' ? '#34c759' :
               disabled ? 'rgba(60,60,67,0.3)' : 'white',
        fontSize: '13px', fontWeight: 600,
        cursor: (status === 'generating' || disabled) ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        opacity: status === 'generating' ? 0.7 : 1,
        boxShadow: (!disabled && status !== 'done' && status !== 'generating') ? `0 3px 10px ${color}4d` : 'none',
      }}>
      {status === 'generating' ? 'Generating...' :
       status === 'done' ? 'Re-generate' : label}
    </button>
  )

  const smallIconBtn: React.CSSProperties = {
    padding: '4px 9px',
    borderRadius: '8px',
    border: '0.5px solid rgba(0,0,0,0.1)',
    background: 'rgba(255,255,255,0.9)',
    color: '#1d1d1f',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  }

  // Cost tracker data
  const serviceTotals: Record<string, number> = {}
  const serviceColors: Record<string, string> = {
    Brain: '#007aff',
    image: '#ff6b35',
    video: '#34c759',
    audio: '#af52de',
  }
  for (const e of costEntries) {
    serviceTotals[e.service] = (serviceTotals[e.service] || 0) + e.cost
  }
  const filteredEntries = costFilter
    ? costEntries.filter(e => e.service === costFilter)
    : costEntries

  // ─── Scene thumbnail row (desktop left column) ────────────
  const renderSceneThumbnail = (scene: Record<string, unknown>) => {
    const sceneNum = scene.scene_number as number
    const sceneAsset: SceneAssets = storedAssets[sceneNum] || defaultSceneAssets()
    const hasImage = sceneAsset.imageStatus === 'done' && sceneAsset.imageUrl
    const hasVideo = sceneAsset.videoStatus === 'done' && sceneAsset.videoUrl
    const hasAudio = sceneAsset.audioStatus === 'done' && sceneAsset.audioUrl
    const isActive = activeScene === sceneNum
    return (
      <div
        key={sceneNum}
        onClick={() => setActiveScene(sceneNum)}
        style={{
          display: 'flex', alignItems: 'center', gap: '9px',
          padding: '10px 12px',
          cursor: 'pointer',
          borderLeft: isActive ? '3px solid #007aff' : '3px solid transparent',
          background: isActive ? 'rgba(0,122,255,0.06)' : 'transparent',
          borderBottom: '0.5px solid rgba(0,0,0,0.05)',
          transition: 'all 0.15s',
        }}
      >
        <div style={{
          width: '56px', height: '56px', borderRadius: '8px',
          overflow: 'hidden', flexShrink: 0,
          background: 'rgba(118,118,128,0.1)',
        }}>
          {hasImage ? (
            <img src={sceneAsset.imageUrl!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff6b35', fontSize: '18px', fontWeight: 700 }}>
              {sceneNum}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#1d1d1f', fontSize: '13px', fontWeight: 600 }}>Scene {sceneNum}</div>
          <div style={{ color: 'rgba(60,60,67,0.5)', fontSize: '10px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {(scene.scene_type as string || '').replace(/_/g, ' ')}
          </div>
          <div style={{ display: 'flex', gap: '3px', marginTop: '3px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', opacity: hasImage ? 1 : 0.2 }}>🖼️</span>
            <span style={{ fontSize: '11px', opacity: hasVideo ? 1 : 0.2 }}>🎬</span>
            <span style={{ fontSize: '11px', opacity: hasAudio ? 1 : 0.2 }}>🎵</span>
            <span style={{ color: 'rgba(60,60,67,0.4)', fontSize: '10px', marginLeft: '4px' }}>{sceneDurations[sceneNum] || 6}s</span>
          </div>
        </div>
      </div>
    )
  }

  // ─── Full scene card ──────────────────────────────────────
  const renderSceneCard = (scene: Record<string, unknown>) => {
    const sceneNum = scene.scene_number as number
    const sceneAsset: SceneAssets = storedAssets[sceneNum] || defaultSceneAssets()
    const narration = (scene.vo_script as string)
      || (language === 'id'
        ? (scene.text_id as string) || (scene.text_en as string)
        : (scene.text_en as string) || (scene.text_id as string))
    const hasImage = sceneAsset.imageStatus === 'done' && sceneAsset.imageUrl
    const hasVideo = sceneAsset.videoStatus === 'done' && sceneAsset.videoUrl
    const hasAudio = sceneAsset.audioStatus === 'done' && sceneAsset.audioUrl
    const isVideoPolling = sceneAsset.videoStatus === 'generating' && !!sceneAsset.videoJobId
    const pollCount = videoPollDisplayCounts[sceneNum] || 0
    const isCollapsed = collapsedScenes.has(sceneNum)
    const currentPrompt = editedPrompts[sceneNum] ?? (scene.image_prompt as string ?? '')

    return (
      <div key={sceneNum} style={isDesktop ? { ...glassCard, marginBottom: '16px' } : glassCard}>

        {/* Scene Header */}
        <div style={{
          padding: '10px 11px 7px',
          borderBottom: isCollapsed ? 'none' : '0.5px solid rgba(0,0,0,0.06)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '9px',
            background: 'rgba(255,107,53,0.12)',
            border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#ff6b35', fontSize: '12px', fontWeight: 700, flexShrink: 0,
          }}>{sceneNum}</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#1d1d1f', fontSize: '13px', fontWeight: 600 }}>
              Scene {sceneNum}
            </div>
            <div style={{ color: '#007aff', fontSize: '10px' }}>
              {(scene.scene_type as string || '').replace(/_/g, ' ')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {scene.mood && (
              <span style={{
                padding: '2px 7px', borderRadius: '20px',
                background: 'rgba(118,118,128,0.1)',
                color: 'rgba(60,60,67,0.6)', fontSize: '10px',
              }}>{scene.mood as string}</span>
            )}
            {/* Status summary badges when collapsed */}
            {isCollapsed && (
              <>
                {hasImage && <span style={{ fontSize: '12px' }} title="Image ready">🖼️</span>}
                {hasVideo && <span style={{ fontSize: '12px' }} title="Video ready">🎬</span>}
                {hasAudio && <span style={{ fontSize: '12px' }} title="Audio ready">🎵</span>}
                {isVideoPolling && <span style={{ fontSize: '12px' }} title="Video generating...">⏳</span>}
              </>
            )}
            {/* Minimize/expand toggle */}
            <button
              onClick={() => setCollapsedScenes(prev => {
                const next = new Set(prev)
                if (next.has(sceneNum)) next.delete(sceneNum)
                else next.add(sceneNum)
                return next
              })}
              title={isCollapsed ? 'Expand scene' : 'Collapse scene'}
              style={{
                padding: '3px 8px',
                borderRadius: '8px',
                border: '0.5px solid rgba(0,0,0,0.1)',
                background: 'rgba(255,255,255,0.8)',
                color: 'rgba(60,60,67,0.6)',
                fontSize: '11px', fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {isCollapsed ? '▼ Expand' : '▲ Collapse'}
            </button>
          </div>
        </div>

        {/* Scene body — hidden when collapsed */}
        {!isCollapsed && (
          <div style={{ padding: '10px 11px' }}>

            {/* Image Prompt — editable textarea or JSON view */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                <p style={{ color: 'rgba(60,60,67,0.5)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, margin: 0 }}>
                  Image Prompt
                </p>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {/* Text / JSON toggle */}
                  <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '0.5px solid rgba(0,0,0,0.1)' }}>
                    <button
                      onClick={() => setPromptView(prev => ({ ...prev, [sceneNum]: 'text' }))}
                      style={{
                        padding: '2px 7px', border: 'none',
                        background: (promptView[sceneNum] || 'text') === 'text' ? 'rgba(0,122,255,0.12)' : 'transparent',
                        color: (promptView[sceneNum] || 'text') === 'text' ? '#007aff' : 'rgba(60,60,67,0.4)',
                        fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                      }}
                    >📝 Text</button>
                    <button
                      onClick={() => setPromptView(prev => ({ ...prev, [sceneNum]: 'json' }))}
                      style={{
                        padding: '2px 7px', border: 'none',
                        background: promptView[sceneNum] === 'json' ? 'rgba(0,122,255,0.12)' : 'transparent',
                        color: promptView[sceneNum] === 'json' ? '#007aff' : 'rgba(60,60,67,0.4)',
                        fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                      }}
                    >{'{ }'} JSON</button>
                  </div>
                  {currentPrompt !== (scene.image_prompt as string) && (
                    <button
                      onClick={() => setEditedPrompts(prev => { const n = { ...prev }; delete n[sceneNum]; return n })}
                      style={{ ...smallIconBtn, color: '#ff3b30', borderColor: 'rgba(255,59,48,0.2)', fontSize: '10px' }}
                    >
                      Reset
                    </button>
                  )}
                  <button onClick={() => handleCopy(currentPrompt)} style={smallIconBtn}>
                    Copy
                  </button>
                </div>
              </div>
              {(promptView[sceneNum] || 'text') === 'text' ? (
                <textarea
                  value={currentPrompt}
                  onChange={e => setEditedPrompts(prev => ({ ...prev, [sceneNum]: e.target.value }))}
                  rows={3}
                  style={{
                    width: '100%',
                    background: 'rgba(118,118,128,0.07)',
                    border: currentPrompt !== (scene.image_prompt as string)
                      ? '1px solid rgba(255,107,53,0.4)'
                      : '0.5px solid rgba(0,0,0,0.08)',
                    borderRadius: '10px',
                    padding: '7px 9px',
                    color: '#1d1d1f',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    resize: 'vertical',
                    outline: 'none',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                />
              ) : (
                <pre style={{
                  background: 'rgba(0,0,0,0.04)',
                  border: '0.5px solid rgba(0,0,0,0.08)',
                  borderRadius: '10px',
                  padding: '9px',
                  fontSize: '10px',
                  color: '#1d1d1f',
                  lineHeight: '1.6',
                  overflow: 'auto',
                  margin: 0,
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                }}>
                  {JSON.stringify({
                    raw_prompt: scene.image_prompt as string,
                    enhanced_prompt: sceneAsset.enhancedPrompt || null,
                    art_style: (storyboard.art_style as string) || '',
                    aspect_ratio: (storyboard.aspect_ratio as string) || '9_16',
                    mood: (scene.mood as string) || '',
                    camera_angle: (scene.camera_angle as string) || '',
                    model: imageModel === 'sd35' ? 'SD 3.5 Large' : 'Nova Canvas',
                    dimensions: (() => {
                      const ar = (storyboard.aspect_ratio as string) || '9_16'
                      const dimMap: Record<string, string> = {
                        '9_16': '720x1280',
                        '16_9': '1280x720',
                        '1_1': '1024x1024',
                        '4_5': '896x1120',
                      }
                      return dimMap[ar] || dimMap['9_16']
                    })(),
                  }, null, 2)}
                </pre>
              )}
            </div>


            {/* IMAGE SECTION */}
            <div style={{
              background: 'rgba(0,0,0,0.03)',
              border: '0.5px solid rgba(0,0,0,0.08)',
              borderRadius: '16px',
              padding: '10px',
              marginBottom: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '13px' }}>🖼️</span>
                  <span style={{ color: '#1d1d1f', fontSize: '12px', fontWeight: 600 }}>Image</span>
                </div>
                {statusBadge(sceneAsset.imageStatus, 'Image')}
              </div>

              {sceneAsset.imageStatus === 'generating' && !hasImage && (() => {
                const ar = (storyboard.aspect_ratio as string) || '9_16'
                const ratioMap: Record<string, string> = {
                  '9_16': '177.77%', '16_9': '56.25%', '1_1': '100%', '4_5': '125%',
                }
                return (
                  <div style={{
                    width: '100%',
                    paddingBottom: ratioMap[ar] || '177.77%',
                    position: 'relative',
                    borderRadius: '9px',
                    overflow: 'hidden',
                    background: 'linear-gradient(90deg, rgba(118,118,128,0.1) 25%, rgba(118,118,128,0.2) 50%, rgba(118,118,128,0.1) 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite linear',
                    marginBottom: '6px',
                  }}>
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: '8px',
                    }}>
                      <span style={{ fontSize: '24px', animation: 'pulse-ring 1.5s infinite', display: 'block' }}>🖼️</span>
                      <span style={{ color: 'rgba(60,60,67,0.6)', fontSize: '11px', fontWeight: 600 }}>Generating image...</span>
                      <div style={{ width: '60%', height: '3px', background: 'rgba(118,118,128,0.15)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: '2px', background: 'linear-gradient(90deg, #ff6b35, #ff8c00)', animation: 'progress-bar 3s ease-out forwards' }} />
                      </div>
                    </div>
                  </div>
                )
              })()}

              {hasImage && (
                <>
                  <div style={{ position: 'relative', cursor: 'pointer', marginBottom: '6px' }}
                    onClick={() => setPreviewModal({ type: 'image', url: sceneAsset.imageUrl!, sceneNum })}
                  >
                    <img
                      src={sceneAsset.imageUrl}
                      alt={`Scene ${sceneNum}`}
                      style={{
                        width: '100%', borderRadius: '9px',
                        display: 'block',
                        border: '1px solid rgba(255,255,255,0.1)',
                        transition: 'opacity 0.2s',
                      }}
                    />
                    <div style={{
                      position: 'absolute', inset: 0,
                      borderRadius: '9px',
                      background: 'rgba(0,0,0,0)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: 0,
                      transition: 'all 0.2s',
                    }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLDivElement).style.opacity = '1';
                        (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.4)'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLDivElement).style.opacity = '0';
                        (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0)'
                      }}
                    >
                      <span style={{ color: 'white', fontSize: '22px' }}>🔍</span>
                    </div>
                  </div>
                  <div style={{ marginBottom: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setPreviewModal({ type: 'image', url: sceneAsset.imageUrl!, sceneNum })}
                      style={smallIconBtn}
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => handleDownload(sceneAsset.imageUrl!, `scene-${sceneNum}-image.png`)}
                      style={smallIconBtn}
                    >
                      Download PNG
                    </button>
                  </div>
                </>
              )}

              {sceneAsset.imageError && (
                <p style={{ color: '#ff3b30', fontSize: '11px', marginBottom: '6px', margin: '0 0 6px' }}>
                  {sceneAsset.imageError}
                </p>
              )}

              {/* Image model dropdown */}
              <div style={{ marginBottom: '7px' }}>
                <select
                  value={imageModel}
                  onChange={e => handleImageModelChange(e.target.value)}
                  style={{ ...dropdownStyle, width: 'auto' }}
                >
                  <optgroup label="AWS Bedrock">
                    {IMAGE_MODELS.filter(m => m.provider === 'bedrock').map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Qwen Dashscope">
                    {IMAGE_MODELS.filter(m => m.provider === 'dashscope').map(m => (
                      <option key={m.id} value={m.id}>{m.badge} {m.label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              {actionBtn('Generate Image', () => handleGenerateImage(scene), sceneAsset.imageStatus, !hasApiKeys, '#ff6b35')}
              <div style={{ fontSize: '10px', color: 'rgba(60,60,67,0.4)', marginTop: '5px' }}>
                Est. {formatCost(estimateImageCost(imageModel))}
              </div>
              {sceneAsset.enhancedPrompt && (
                <div style={{
                  marginTop: '7px',
                  padding: '6px 8px',
                  background: 'rgba(0,122,255,0.06)',
                  border: '0.5px solid rgba(0,122,255,0.2)',
                  borderRadius: '10px',
                }}>
                  <p style={{ color: '#007aff', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, margin: '0 0 3px' }}>
                    ✨ AI Enhanced Prompt
                  </p>
                  <p style={{ color: 'rgba(60,60,67,0.6)', fontSize: '10px', lineHeight: '1.5', margin: 0 }}>
                    {sceneAsset.enhancedPrompt}
                  </p>
                </div>
              )}
            </div>

            {/* VIDEO PROMPT SECTION — Veo 3.1 for Veo-compatible tones, standard otherwise */}
            {isVeoTone((storyboard.tone as string) || 'narrative_storytelling') ? (
              <VeoPromptSection
                sceneNumber={sceneNum}
                veoPrompt={storedAssets[sceneNum]?.veoPrompt || null}
                voScript={(scene.vo_script as string) || ''}
                imagePrompt={editedPrompts[sceneNum] || (scene.image_prompt as string) || ''}
                tone={(storyboard.tone as string) || 'narrative_storytelling'}
                platform={(storyboard.platform as string) || 'TikTok'}
                brainModel={(storyboard.brain_model as string) || 'gemini-2.0-flash'}
                apiHeaders={getApiHeaders(user?.id)}
                onUpdate={(vp) => {
                  updateAsset(sceneNum, { veoPrompt: vp })
                  saveSceneAsset({
                    storyboard_id: activeSessionId || 'storyboard',
                    scene_number: sceneNum,
                    video_prompt: JSON.stringify(vp),
                  }).catch(console.error)
                }}
              />
            ) : (
            (() => {
              const videoPrompt = storedAssets[sceneNum]?.videoPrompt
              const customVideoPromptVal = storedAssets[sceneNum]?.customVideoPrompt || ''
              const hasVideoPrompt = !!videoPrompt
              const isExpanded = videoPromptExpanded[sceneNum] || false
              const view = videoPromptView[sceneNum] || 'text'
              const isRegening = regenVideoPrompt[sceneNum] || false
              return (
                <div style={{
                  background: 'rgba(0,122,255,0.04)',
                  border: '0.5px solid rgba(0,122,255,0.12)',
                  borderRadius: '16px',
                  marginBottom: '8px',
                  overflow: 'hidden',
                }}>
                  <div
                    onClick={() => setVideoPromptExpanded(prev => ({ ...prev, [sceneNum]: !prev[sceneNum] }))}
                    style={{
                      padding: '8px 10px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px' }}>🎥</span>
                      <span style={{ color: '#1d1d1f', fontSize: '12px', fontWeight: 600 }}>Video Prompt</span>
                      {hasVideoPrompt ? (
                        <span style={{ padding: '1px 6px', borderRadius: '10px', background: 'rgba(52,199,89,0.12)', color: '#34c759', fontSize: '10px', fontWeight: 600 }}>✓ Ready</span>
                      ) : (
                        <span style={{ padding: '1px 6px', borderRadius: '10px', background: 'rgba(118,118,128,0.1)', color: 'rgba(60,60,67,0.4)', fontSize: '10px' }}>Using image prompt</span>
                      )}
                    </div>
                    <span style={{ color: 'rgba(60,60,67,0.4)', fontSize: '11px' }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {isExpanded && (
                    <div style={{ padding: '0 10px 10px', borderTop: '0.5px solid rgba(0,122,255,0.08)' }}>
                      {/* Text/JSON tab toggle */}
                      <div style={{ display: 'flex', gap: '4px', marginTop: '8px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '0.5px solid rgba(0,0,0,0.1)' }}>
                          <button
                            onClick={() => setVideoPromptView(prev => ({ ...prev, [sceneNum]: 'text' }))}
                            style={{
                              padding: '2px 7px', border: 'none',
                              background: view === 'text' ? 'rgba(0,122,255,0.12)' : 'transparent',
                              color: view === 'text' ? '#007aff' : 'rgba(60,60,67,0.4)',
                              fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                            }}
                          >📝 Text</button>
                          <button
                            onClick={() => setVideoPromptView(prev => ({ ...prev, [sceneNum]: 'json' }))}
                            style={{
                              padding: '2px 7px', border: 'none',
                              background: view === 'json' ? 'rgba(0,122,255,0.12)' : 'transparent',
                              color: view === 'json' ? '#007aff' : 'rgba(60,60,67,0.4)',
                              fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                            }}
                          >{'{ }'} JSON</button>
                        </div>
                      </div>

                      {view === 'text' ? (
                        <>
                          {videoPrompt && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                              {([
                                { label: 'Motion', value: videoPrompt.motion, color: '#007aff' },
                                { label: 'Pacing', value: videoPrompt.pacing, color: '#af52de' },
                                { label: 'Camera', value: videoPrompt.camera, color: '#ff6b35' },
                              ] as { label: string; value: string; color: string }[]).map(({ label, value, color }) => value && (
                                <span key={label} style={{
                                  padding: '2px 7px', borderRadius: '10px',
                                  background: `${color}18`,
                                  border: `0.5px solid ${color}33`,
                                  color, fontSize: '10px',
                                }}>
                                  {label}: {value}
                                </span>
                              ))}
                            </div>
                          )}
                          {videoPrompt && videoPrompt.subject_action && (
                            <div style={{ marginBottom: '6px' }}>
                              <div style={{ color: 'rgba(60,60,67,0.4)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Subject Action</div>
                              <div style={{ color: 'rgba(60,60,67,0.65)', fontSize: '11px', lineHeight: '1.4' }}>{videoPrompt.subject_action}</div>
                            </div>
                          )}
                          {videoPrompt && videoPrompt.atmosphere && (
                            <div style={{ marginBottom: '8px' }}>
                              <div style={{ color: 'rgba(60,60,67,0.4)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Atmosphere</div>
                              <div style={{ color: 'rgba(60,60,67,0.65)', fontSize: '11px', lineHeight: '1.4' }}>{videoPrompt.atmosphere}</div>
                            </div>
                          )}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                              <span style={{ color: 'rgba(60,60,67,0.4)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Full Prompt (editable)</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ fontSize: '10px', fontWeight: 600, color: (customVideoPromptVal.length) > 200 ? '#ff3b30' : 'rgba(60,60,67,0.4)' }}>
                                  {customVideoPromptVal.length}/200
                                </span>
                                {customVideoPromptVal && (
                                  <button onClick={() => handleCopy(customVideoPromptVal)} style={smallIconBtn}>
                                    Copy
                                  </button>
                                )}
                              </div>
                            </div>
                            <textarea
                              value={customVideoPromptVal}
                              onChange={e => updateAsset(sceneNum, { customVideoPrompt: e.target.value })}
                              maxLength={250}
                              rows={3}
                              placeholder={videoPrompt?.full_prompt || 'Camera movement, subject action, atmosphere...'}
                              style={{
                                width: '100%',
                                background: 'rgba(118,118,128,0.07)',
                                border: '0.5px solid rgba(0,122,255,0.2)',
                                borderRadius: '10px',
                                padding: '7px 9px',
                                color: '#1d1d1f', fontSize: '12px', lineHeight: '1.5',
                                resize: 'vertical', outline: 'none',
                                fontFamily: 'inherit', boxSizing: 'border-box',
                              }}
                            />
                          </div>
                        </>
                      ) : (
                        <pre style={{
                          background: 'rgba(0,0,0,0.04)',
                          border: '0.5px solid rgba(0,0,0,0.08)',
                          borderRadius: '10px', padding: '9px',
                          fontSize: '10px', color: '#1d1d1f', lineHeight: '1.6',
                          overflow: 'auto', margin: 0,
                          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                        }}>
                          {JSON.stringify(videoPrompt || { message: 'No video prompt generated yet' }, null, 2)}
                        </pre>
                      )}

                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleRegenerateVideoPromptScene(scene, sceneNum)}
                          disabled={isRegening}
                          style={{
                            padding: '5px 10px', borderRadius: '10px',
                            background: 'rgba(0,122,255,0.12)',
                            border: '0.5px solid rgba(0,122,255,0.25)',
                            color: '#007aff', fontSize: '11px', fontWeight: 600,
                            cursor: isRegening ? 'not-allowed' : 'pointer',
                            opacity: isRegening ? 0.6 : 1,
                          }}
                        >
                          {isRegening ? '⏳ Regenerating...' : '🔄 Regenerate'}
                        </button>
                        {videoPrompt && customVideoPromptVal !== videoPrompt.full_prompt && (
                          <button
                            onClick={() => updateAsset(sceneNum, { customVideoPrompt: videoPrompt.full_prompt })}
                            style={{
                              padding: '5px 10px', borderRadius: '10px',
                              background: 'rgba(255,59,48,0.08)',
                              border: '0.5px solid rgba(255,59,48,0.2)',
                              color: '#ff3b30', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                            }}
                          >Reset</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()
            )}

            {/* VIDEO SECTION */}
            {(() => {
              const curVidModelId = videoModel[sceneNum] || defaultVideoModel
              const curVidModel = VIDEO_MODELS.find(m => m.id === curVidModelId) || VIDEO_MODELS[0]
              const isT2V = curVidModel.provider === 'dashscope' && curVidModelId.includes('t2v')
              const canGenVideo = hasImage || isT2V
              return (
            <div style={{
              background: 'rgba(0,122,255,0.04)',
              border: `0.5px solid ${canGenVideo ? 'rgba(0,122,255,0.15)' : 'rgba(0,0,0,0.05)'}`,
              borderRadius: '16px',
              padding: '10px',
              marginBottom: '8px',
              opacity: canGenVideo ? 1 : 0.5,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '13px' }}>🎬</span>
                  <span style={{ color: '#1d1d1f', fontSize: '12px', fontWeight: 600 }}>Video</span>
                </div>
                {!canGenVideo
                  ? <span style={{ color: 'rgba(60,60,67,0.3)', fontSize: '10px' }}>Generate image first</span>
                  : statusBadge(sceneAsset.videoStatus, 'Video', isVideoPolling)
                }
              </div>

              {hasVideo && (
                <>
                  <div style={{ position: 'relative', cursor: 'pointer', marginBottom: '6px' }}
                    onClick={() => setPreviewModal({ type: 'video', url: sceneAsset.videoUrl!, sceneNum })}
                  >
                    <video
                      src={sceneAsset.videoUrl}
                      style={{
                        width: '100%', borderRadius: '9px',
                        display: 'block',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    />
                    <div style={{
                      position: 'absolute', inset: 0,
                      borderRadius: '9px',
                      background: 'rgba(0,0,0,0.35)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ color: 'white', fontSize: '28px' }}>▶</span>
                    </div>
                  </div>
                  <div style={{ marginBottom: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setPreviewModal({ type: 'video', url: sceneAsset.videoUrl!, sceneNum })}
                      style={smallIconBtn}
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => handleDownload(sceneAsset.videoUrl!, `scene-${sceneNum}-video.mp4`)}
                      style={smallIconBtn}
                    >
                      Download MP4
                    </button>
                  </div>
                </>
              )}

              {(isVideoPolling || (sceneAsset.videoStatus === 'generating' && !hasVideo)) && !hasVideo && (
                <div style={{
                  padding: '10px',
                  background: 'rgba(0,122,255,0.05)',
                  border: '0.5px solid rgba(0,122,255,0.15)',
                  borderRadius: '12px',
                  marginBottom: '8px',
                  animation: 'float-up 0.3s ease-out',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '16px', animation: 'spin 3s linear infinite', display: 'inline-block' }}>🎬</span>
                      <div>
                        <div style={{ color: '#007aff', fontSize: '12px', fontWeight: 600 }}>Generating video...</div>
                        <div style={{ color: 'rgba(60,60,67,0.5)', fontSize: '10px' }}>
                          Takes 2-5 min · {pollCount > 0 ? `~${pollCount * 8}s elapsed` : 'starting...'}
                        </div>
                      </div>
                    </div>
                    {isVideoPolling && (
                      <button
                        onClick={() => handleCancelVideo(sceneNum)}
                        style={{
                          padding: '3px 8px', borderRadius: '8px',
                          border: '0.5px solid rgba(255,59,48,0.3)',
                          background: 'rgba(255,59,48,0.08)',
                          color: '#ff3b30',
                          fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                        }}
                      >Cancel</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '3px', marginBottom: '5px' }}>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} style={{
                        flex: 1, height: '5px', borderRadius: '2px',
                        background: i < (pollCount % 9) ? '#007aff' : 'rgba(0,122,255,0.15)',
                        transition: 'background 0.3s ease',
                      }} />
                    ))}
                  </div>
                  <div style={{ color: 'rgba(60,60,67,0.4)', fontSize: '10px' }}>
                    Polling every 8s{pollCount > 0 ? ` · checked ${pollCount}×` : ''}
                  </div>
                </div>
              )}

              {sceneAsset.videoError && (
                <p style={{ color: '#ff3b30', fontSize: '11px', marginBottom: '6px', margin: '0 0 6px' }}>
                  {sceneAsset.videoError}
                </p>
              )}

              {/* Duration slider */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'rgba(60,60,67,0.5)', fontSize: '10px' }}>⏱ Duration</span>
                  <span style={{ color: '#007aff', fontSize: '10px', fontWeight: 700 }}>{sceneDurations[sceneNum] || 6}s</span>
                </div>
                <input
                  type="range" min={2} max={6} step={1}
                  value={sceneDurations[sceneNum] || 6}
                  onChange={e => handleSceneDurationChange(sceneNum, Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#007aff', height: '3px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(60,60,67,0.3)', fontSize: '9px' }}>2s</span>
                  <span style={{ color: 'rgba(60,60,67,0.3)', fontSize: '9px' }}>6s</span>
                </div>
              </div>

              {/* Video model selector */}
              <div style={{ marginBottom: '7px' }}>
                <select
                  value={videoModel[sceneNum] || defaultVideoModel}
                  onChange={e => setVideoModel(prev => ({ ...prev, [sceneNum]: e.target.value }))}
                  style={{ ...dropdownStyle, width: 'auto' }}
                >
                  <optgroup label="AWS Bedrock">
                    {VIDEO_MODELS.filter(m => m.provider === 'bedrock').map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Qwen Dashscope">
                    {VIDEO_MODELS.filter(m => m.provider === 'dashscope').map(m => (
                      <option key={m.id} value={m.id}>{m.badge} {m.label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Model-specific params */}
              {(() => {
                const curVidModelId = videoModel[sceneNum] || defaultVideoModel
                const curVidModel = VIDEO_MODELS.find(m => m.id === curVidModelId) || VIDEO_MODELS[0]
                if (curVidModel.provider === 'bedrock') {
                  return (
                    <div style={{ marginBottom: '7px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: 'rgba(60,60,67,0.5)', fontSize: '10px', flexShrink: 0 }}>Seed</span>
                      <input
                        type="number"
                        placeholder="Random"
                        value={videoSeed[sceneNum] ?? ''}
                        onChange={e => setVideoSeed(prev => ({
                          ...prev,
                          [sceneNum]: e.target.value ? Number(e.target.value) : undefined,
                        }))}
                        style={{
                          width: '90px',
                          background: 'rgba(118,118,128,0.1)',
                          border: '0.5px solid rgba(0,0,0,0.1)',
                          borderRadius: '8px',
                          padding: '3px 7px',
                          color: '#1d1d1f',
                          fontSize: '11px',
                          outline: 'none',
                          fontFamily: 'inherit',
                        }}
                      />
                      <span style={{ color: 'rgba(60,60,67,0.35)', fontSize: '10px' }}>6s (API limit)</span>
                    </div>
                  )
                }
                if (curVidModel.provider === 'dashscope') {
                  return (
                    <div style={{ marginBottom: '7px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={promptExtend[sceneNum] !== false}
                          onChange={e => setPromptExtend(prev => ({ ...prev, [sceneNum]: e.target.checked }))}
                          style={{ accentColor: '#007aff' }}
                        />
                        <span style={{ color: 'rgba(60,60,67,0.6)', fontSize: '10px' }}>Prompt Extend</span>
                      </label>
                    </div>
                  )
                }
                return null
              })()}

              {(() => {
                const curVidModel = VIDEO_MODELS.find(m => m.id === (videoModel[sceneNum] || defaultVideoModel)) || VIDEO_MODELS[0]
                const vidNeedsImage = curVidModel.provider === 'bedrock' || curVidModel.id.includes('i2v')
                return actionBtn(
                  `Generate Video (${sceneDurations[sceneNum] || 6}s)`,
                  () => handleGenerateVideo(scene),
                  sceneAsset.videoStatus,
                  !hasApiKeys || (vidNeedsImage && !hasImage),
                  '#007aff'
                )
              })()}
              <div style={{ fontSize: '10px', color: 'rgba(60,60,67,0.4)', marginTop: '5px' }}>
                Est. {formatCost(estimateVideoCost())}
              </div>
            </div>
              )
            })()}

            {/* AUDIO SECTION */}
            <div style={{
              background: 'rgba(175,82,222,0.05)',
              border: '0.5px solid rgba(175,82,222,0.18)',
              borderRadius: '16px',
              padding: '10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '13px' }}>🎵</span>
                  <span style={{ color: '#1d1d1f', fontSize: '12px', fontWeight: 600 }}>Audio VO</span>
                </div>
                {statusBadge(sceneAsset.audioStatus, 'Audio')}
              </div>

              {/* VO text that will be spoken */}
              {(customVO[sceneNum] || narration) && (
                <div style={{
                  background: 'rgba(175,82,222,0.06)',
                  border: '0.5px solid rgba(175,82,222,0.18)',
                  borderRadius: '10px',
                  padding: '8px 10px',
                  marginBottom: '8px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ color: '#af52de', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      VO Script {customVO[sceneNum] ? '(edited)' : ''}
                    </span>
                    <button
                      onClick={() => handleCopy(customVO[sceneNum] || narration)}
                      style={{ ...smallIconBtn, color: '#af52de', borderColor: 'rgba(175,82,222,0.25)' }}
                    >
                      Copy
                    </button>
                  </div>
                  <p style={{ color: '#1d1d1f', fontSize: '12px', lineHeight: '1.5', fontStyle: 'italic', margin: 0 }}>
                    "{customVO[sceneNum] || narration}"
                  </p>
                </div>
              )}

              {/* Audio history (newest first) */}
              {sceneAsset.audioHistory && sceneAsset.audioHistory.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  {sceneAsset.audioHistory.map((item, idx) => (
                    <div key={idx} style={{
                      marginBottom: '6px',
                      padding: '6px',
                      background: 'rgba(175,82,222,0.06)',
                      border: '0.5px solid rgba(175,82,222,0.15)',
                      borderRadius: '10px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: 'rgba(60,60,67,0.5)', fontSize: '10px' }}>
                          {idx === 0 ? '▶ Latest' : `Take ${sceneAsset.audioHistory.length - idx}`}
                          {' · '}{item.engine === 'elevenlabs' ? 'ElevenLabs' : 'Polly'}
                          {' · '}{item.voice}
                        </span>
                        <span style={{ color: 'rgba(60,60,67,0.35)', fontSize: '10px' }}>
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <audio src={item.url} controls style={{ width: '100%', height: '28px' }} />
                      <button
                        onClick={() => handleDownload(item.url, `scene-${sceneNum}-audio-take${sceneAsset.audioHistory.length - idx}.mp3`)}
                        style={{ ...smallIconBtn, marginTop: '4px' }}
                      >
                        Download MP3
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Legacy single audio (if no history yet but has audioUrl) */}
              {hasAudio && (!sceneAsset.audioHistory || sceneAsset.audioHistory.length === 0) && (
                <>
                  <audio
                    src={sceneAsset.audioUrl}
                    controls
                    style={{ width: '100%', marginBottom: '6px' }}
                  />
                  <div style={{ marginBottom: '8px' }}>
                    <button
                      onClick={() => handleDownload(sceneAsset.audioUrl!, `scene-${sceneNum}-audio.mp3`)}
                      style={smallIconBtn}
                    >
                      Download MP3
                    </button>
                  </div>
                </>
              )}

              {sceneAsset.audioError && (
                <p style={{ color: '#ff3b30', fontSize: '11px', marginBottom: '6px', margin: '0 0 6px' }}>
                  {sceneAsset.audioError}
                </p>
              )}

              {/* Engine + voice dropdowns */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '7px', flexWrap: 'wrap' }}>
                <select
                  value={audioEngine}
                  onChange={e => handleAudioEngineChange(e.target.value as 'polly' | 'elevenlabs')}
                  style={dropdownStyle}
                >
                  <option value="polly">AWS Polly</option>
                  <option value="elevenlabs">ElevenLabs</option>
                </select>
                <select
                  value={audioVoice}
                  onChange={e => handleAudioVoiceChange(e.target.value)}
                  style={dropdownStyle}
                >
                  {audioEngine === 'polly' ? (
                    language === 'id' ? (
                      POLLY_VOICES_ID.map(v => <option key={v} value={v}>{v}</option>)
                    ) : (
                      POLLY_VOICES_EN.map(v => <option key={v} value={v}>{v}</option>)
                    )
                  ) : (
                    ELEVENLABS_VOICES.map(v => <option key={v} value={v}>{v}</option>)
                  )}
                </select>
              </div>

              {/* ElevenLabs voice settings sliders */}
              {audioEngine === 'elevenlabs' && (
                <div style={{ marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {([
                    { label: 'Stability', value: elStability, set: setElStability },
                    { label: 'Similarity', value: elSimilarity, set: setElSimilarity },
                    { label: 'Style', value: elStyle, set: setElStyle },
                  ] as const).map(({ label, value, set }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: 'rgba(60,60,67,0.5)', fontSize: '10px', width: '60px', flexShrink: 0 }}>{label}</span>
                      <input
                        type="range" min={0} max={1} step={0.05}
                        value={value}
                        onChange={e => set(Number(e.target.value))}
                        style={{ flex: 1, accentColor: '#af52de', height: '3px' }}
                      />
                      <span style={{ color: '#af52de', fontSize: '10px', fontWeight: 700, width: '28px', textAlign: 'right' }}>{value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              {actionBtn(
                'Generate Audio VO',
                () => handleGenerateAudio(scene),
                sceneAsset.audioStatus,
                !hasApiKeys,
                '#af52de'
              )}
              <div style={{ fontSize: '10px', color: 'rgba(60,60,67,0.4)', marginTop: '5px' }}>
                Est. {narration ? formatCost(estimateAudioCost(audioEngine, narration.length)) : '<$0.01'}
              </div>
            </div>

            {/* Camera + Transition info */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
              {scene.camera_angle && (
                <span style={{
                  padding: '3px 8px', borderRadius: '20px',
                  background: 'rgba(118,118,128,0.08)',
                  border: 'none',
                  color: 'rgba(60,60,67,0.5)', fontSize: '11px',
                }}>📷 {scene.camera_angle as string}</span>
              )}
              {scene.transition && (
                <span style={{
                  padding: '3px 8px', borderRadius: '20px',
                  background: 'rgba(118,118,128,0.08)',
                  border: 'none',
                  color: 'rgba(60,60,67,0.5)', fontSize: '11px',
                }}>{(scene.transition as string).replace(/_/g, ' ')}</span>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={page}>

      {/* Preview Modal */}
      {previewModal && (
        <div
          onClick={() => setPreviewModal(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.92)',
            backdropFilter: 'blur(16px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }}>
            <button
              onClick={() => setPreviewModal(null)}
              style={{
                position: 'absolute', top: '-36px', right: 0,
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                color: '#EFE1CF', fontSize: '13px', fontWeight: 600,
                padding: '4px 10px', cursor: 'pointer',
              }}
            >
              ✕ Close
            </button>
            {previewModal.type === 'image' ? (
              <>
                <img
                  src={previewModal.url}
                  alt={`Scene ${previewModal.sceneNum} preview`}
                  style={{
                    maxWidth: '90vw', maxHeight: '85vh',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    display: 'block',
                  }}
                />
                <button
                  onClick={e => { e.stopPropagation(); handleDownload(previewModal.url, `scene_${previewModal.sceneNum}.jpg`) }}
                  style={{
                    position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(255,255,255,0.15)',
                    border: '0.5px solid rgba(255,255,255,0.3)',
                    borderRadius: '14px', padding: '10px 20px',
                    color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  ⬇️ Download
                </button>
              </>
            ) : (
              <video
                src={previewModal.url}
                controls
                autoPlay
                style={{
                  maxWidth: '90vw', maxHeight: '85vh',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  display: 'block',
                }}
              />
            )}
            <div style={{ textAlign: 'center', color: 'rgba(239,225,207,0.4)', fontSize: '11px', marginTop: '8px' }}>
              Scene {previewModal.sceneNum} · {previewModal.type === 'image' ? 'Image' : 'Video'} Preview
            </div>
          </div>
        </div>
      )}

      {/* Page Toast */}
      {pageToast && (
        <div style={{
          position: 'fixed', top: '16px', left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999, maxWidth: '320px', width: '90%',
          background: pageToast.type === 'error'
            ? 'rgba(255,59,48,0.95)' : 'rgba(52,199,89,0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '14px', padding: '12px 16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'flex-start', gap: '10px',
        }}>
          <span style={{ color: 'white', fontSize: '12px', flex: 1, lineHeight: '1.4' }}>
            {pageToast.msg}
          </span>
          <button onClick={() => setPageToast(null)} style={{
            background: 'rgba(255,255,255,0.25)',
            border: 'none', borderRadius: '6px',
            color: 'white', fontSize: '11px',
            padding: '2px 7px', cursor: 'pointer',
            flexShrink: 0,
          }}>✕</button>
        </div>
      )}

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(242,242,247,0.85)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        borderBottom: '0.5px solid rgba(0,0,0,0.1)',
        padding: isDesktop ? '10px 24px' : '10px 11px',
      }}>
      <div style={{
        maxWidth: isDesktop ? '1400px' : undefined,
        margin: isDesktop ? '0 auto' : undefined,
        display: 'flex', alignItems: 'center', gap: '10px',
        width: '100%',
      }}>
        <button onClick={() => navigate('/')} style={{
          background: 'rgba(255,255,255,0.85)',
          border: '0.5px solid rgba(0,0,0,0.12)',
          borderRadius: '12px', color: '#007aff',
          padding: '6px 12px', cursor: 'pointer',
          fontSize: '13px', fontWeight: 600,
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          ← Back
        </button>
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <div style={{ color: '#1d1d1f', fontSize: '15px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {storyboard.title as string}
          </div>
          <div style={{ color: 'rgba(60,60,67,0.5)', fontSize: '11px' }}>
            {scenes.length} scenes · Storyboard
          </div>
        </div>
        {/* Minimize to queue */}
        <button
          onClick={handleMinimize}
          title="Minimize to queue — continue generating in background"
          style={{
            flexShrink: 0,
            padding: '6px 12px', borderRadius: '10px',
            border: '0.5px solid rgba(0,122,255,0.25)',
            background: 'rgba(0,122,255,0.1)',
            color: '#007aff',
            fontSize: '12px', fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ↙ Minimize
        </button>
        <button
          onClick={handleSave}
          disabled={isAlreadySaved}
          style={{
            flexShrink: 0,
            padding: '6px 12px', borderRadius: '10px',
            border: `0.5px solid ${isAlreadySaved ? 'rgba(52,199,89,0.3)' : 'rgba(255,107,53,0.3)'}`,
            background: isAlreadySaved ? 'rgba(52,199,89,0.1)' : 'rgba(255,107,53,0.1)',
            color: isAlreadySaved ? '#34c759' : '#ff6b35',
            fontSize: '12px', fontWeight: 600,
            cursor: isAlreadySaved ? 'default' : 'pointer',
          }}
        >
          {isAlreadySaved ? '✓ Saved' : 'Save'}
        </button>
        {isVeoTone((storyboard.tone as string) || '') && (
          <button
            onClick={handleGenerateAllVeo}
            disabled={generatingAllVeo}
            style={{
              flexShrink: 0,
              padding: '6px 12px', borderRadius: '10px',
              background: generatingAllVeo ? 'rgba(118,118,128,0.08)' : 'rgba(255,107,53,0.1)',
              border: `0.5px solid ${generatingAllVeo ? 'rgba(118,118,128,0.2)' : 'rgba(255,107,53,0.3)'}`,
              color: generatingAllVeo ? 'rgba(60,60,67,0.4)' : '#ff6b35',
              fontSize: '11px', fontWeight: 700,
              cursor: generatingAllVeo ? 'not-allowed' : 'pointer',
            }}
          >
            {generatingAllVeo ? '⏳ Generating...' : '🎬 Gen All Veo'}
          </button>
        )}
        {isVeoTone((storyboard.tone as string) || '') && (
          <button
            onClick={() => {
              const scenes = (storyboard.scenes as Record<string, unknown>[]) || []
              const allPrompts = scenes.map((s: Record<string, unknown>) => {
                const sNum = s.scene_number as number
                const veo = storedAssets[sNum]?.veoPrompt
                return [
                  `=== SCENE ${sNum} ===`,
                  `VO: "${s.vo_script as string}"`,
                  ``,
                  `VEO 3.1 PROMPT:`,
                  veo?.full_veo_prompt || '(not generated yet)',
                  ``,
                ].join('\n')
              }).join('\n')
              const blob = new Blob([allPrompts], { type: 'text/plain' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `veo-prompts-${((storyboard.title as string) || 'storyboard').replace(/\s/g, '-')}.txt`
              a.click()
              URL.revokeObjectURL(url)
            }}
            style={{
              flexShrink: 0,
              padding: '6px 12px', borderRadius: '10px',
              background: 'rgba(255,107,53,0.1)',
              border: '0.5px solid rgba(255,107,53,0.3)',
              color: '#ff6b35', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            🎬 Export Veo
          </button>
        )}
        <span style={{ fontSize: '18px', flexShrink: 0 }}>🎬</span>
      </div>
      </div>

      {/* API Key Warning */}
      {!hasApiKeys && (
        <div style={{
          margin: '12px 16px 0',
          padding: '12px 14px',
          background: 'rgba(255,59,48,0.08)',
          border: '0.5px solid rgba(255,59,48,0.3)',
          borderRadius: '14px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontSize: '18px' }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#ff3b30' }}>API Keys Required</div>
            <div style={{ fontSize: '11px', color: 'rgba(60,60,67,0.6)', marginTop: '2px' }}>
              Add your AWS or Dashscope keys in Settings to generate images and videos
            </div>
          </div>
          <button
            onClick={() => navigate('/settings')}
            style={{
              padding: '6px 12px', borderRadius: '10px',
              background: 'rgba(255,59,48,0.1)',
              border: '0.5px solid rgba(255,59,48,0.3)',
              color: '#ff3b30', fontSize: '11px', fontWeight: 700,
              cursor: 'pointer', flexShrink: 0,
            }}
          >Settings →</button>
        </div>
      )}

      {/* Interactive Cost Tracker */}
      {costEntries.length > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '0.5px solid rgba(0,0,0,0.08)',
        }}>
          <div
            onClick={() => setCostExpanded(!costExpanded)}
            style={{
              padding: '6px 12px',
              display: 'flex', alignItems: 'center', gap: '10px',
              flexWrap: 'wrap',
              fontSize: '12px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <span style={{ color: '#ff6b35', fontWeight: 700 }}>
              Session: {formatCost(sessionTotal)}
            </span>
            {Object.entries(serviceTotals).map(([svc, total]) => (
              <button
                key={svc}
                onClick={(e) => {
                  e.stopPropagation()
                  setCostFilter(prev => prev === svc ? null : svc)
                }}
                style={{
                  padding: '2px 7px', borderRadius: '10px',
                  border: `1px solid ${costFilter === svc ? (serviceColors[svc] || '#EFE1CF') : 'rgba(255,255,255,0.1)'}`,
                  background: costFilter === svc ? `${serviceColors[svc] || '#EFE1CF'}22` : 'rgba(255,255,255,0.04)',
                  color: serviceColors[svc] || 'rgba(239,225,207,0.5)',
                  fontSize: '11px', fontWeight: 500, cursor: 'pointer',
                }}
              >
                {svc}: {formatCost(total)}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', color: 'rgba(60,60,67,0.4)', fontSize: '10px' }}>
              {costExpanded ? '▲ collapse' : '▼ details'}
            </span>
          </div>

          {costExpanded && (
            <div style={{
              padding: '0 12px 10px',
              maxHeight: '240px',
              overflowY: 'auto',
            }}>
              {costFilter && (
                <div style={{ marginBottom: '7px' }}>
                  <button
                    onClick={() => setCostFilter(null)}
                    style={{
                      ...smallIconBtn,
                      fontSize: '10px',
                      color: '#3FA9F6',
                      borderColor: 'rgba(63,169,246,0.3)',
                    }}
                  >
                    Show All
                  </button>
                </div>
              )}
              {[...filteredEntries].reverse().map((entry, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '4px 0',
                  borderBottom: '0.5px solid rgba(0,0,0,0.05)',
                  fontSize: '11px',
                }}>
                  <span style={{ color: 'rgba(60,60,67,0.35)', fontSize: '10px', minWidth: '50px' }}>
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{
                    padding: '1px 6px', borderRadius: '6px',
                    background: `${serviceColors[entry.service] || '#EFE1CF'}18`,
                    color: serviceColors[entry.service] || '#EFE1CF',
                    fontSize: '10px', fontWeight: 600,
                  }}>
                    {entry.service}
                  </span>
                  <span style={{ color: 'rgba(60,60,67,0.5)', flex: 1 }}>
                    {entry.model}
                  </span>
                  <span style={{ color: '#1d1d1f', fontWeight: 600 }}>
                    {formatCost(entry.cost)}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { clearSession(); setCostExpanded(false); setCostFilter(null) }}
                  style={{
                    padding: '4px 10px', borderRadius: '8px',
                    border: '0.5px solid rgba(255,59,48,0.25)',
                    background: 'rgba(255,59,48,0.08)',
                    color: '#ff3b30',
                    fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Clear Session
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ padding: isDesktop ? '14px 0 0' : '14px 11px 0', maxWidth: isDesktop ? 'none' : '720px', margin: '0 auto' }}>

        {/* Production Notes + Duration — centered on desktop */}
        <div style={{ padding: isDesktop ? '0 24px' : undefined, maxWidth: isDesktop ? '720px' : undefined, margin: isDesktop ? '0 auto' : undefined }}>
        {/* Production Notes */}
        {productionNotes && (
          <div style={{ ...glassCard, padding: '11px', marginBottom: '14px' }}>
            <p style={{ color: 'rgba(60,60,67,0.5)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: '7px', margin: '0 0 7px' }}>
              Production Notes
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
              {(productionNotes.color_palette as string[] || []).map((c: string, i: number) => (
                <span key={i} style={{
                  padding: '2px 8px', borderRadius: '20px',
                  background: 'rgba(118,118,128,0.1)',
                  border: 'none',
                  color: '#1d1d1f', fontSize: '11px',
                }}>{c}</span>
              ))}
            </div>
            {productionNotes.music_tone && (
              <p style={{ color: 'rgba(60,60,67,0.5)', fontSize: '12px', margin: 0 }}>
                🎵 {productionNotes.music_tone as string}
              </p>
            )}
          </div>
        )}

        {/* Total Duration Control */}
        <div style={{
          background: 'rgba(255,255,255,0.7)',
          border: '0.5px solid rgba(255,255,255,0.9)',
          borderRadius: '16px',
          padding: '10px 12px',
          marginBottom: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: 'rgba(60,60,67,0.6)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
              Target Total Duration
            </span>
            <span style={{ color: '#007aff', fontSize: '10px', fontWeight: 700 }}>
              {totalDuration}s · {Object.values(sceneDurations).reduce((a, b) => a + b, 0)}s allocated
            </span>
          </div>
          <input
            type="range" min={15} max={120} step={5}
            value={totalDuration}
            onChange={e => handleTotalDurationChange(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#007aff', height: '3px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
            <span style={{ color: 'rgba(60,60,67,0.3)', fontSize: '9px' }}>15s</span>
            <span style={{ color: 'rgba(60,60,67,0.3)', fontSize: '9px' }}>120s</span>
          </div>
        </div>
        </div>

        {/* Scenes — responsive 2-col on desktop */}
        {isDesktop ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '300px 1fr',
            height: 'calc(100vh - 56px)',
            overflow: 'hidden',
          }}>
            {/* LEFT: Scene thumbnail list */}
            <div style={{ overflowY: 'auto', borderRight: '0.5px solid rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.4)' }}>
              {scenes.map(scene => renderSceneThumbnail(scene))}
            </div>
            {/* RIGHT: Active scene detail */}
            <div style={{ overflowY: 'auto', padding: '16px 20px' }}>
              {scenes.filter(s => (s.scene_number as number) === activeScene).map(s => renderSceneCard(s))}
            </div>
          </div>
        ) : (
          scenes.map(scene => renderSceneCard(scene))
        )}

        {/* Footer */}
        {!isDesktop && (
          <p style={{ textAlign: 'center', color: 'rgba(60,60,67,0.3)', fontSize: '11px', marginTop: '17px' }}>
            {scenes.length} scenes · Fuzzy Short
          </p>
        )}
      </div>

      <style>{`select option { background: #f2f2f7; color: #1d1d1f; }`}</style>
    </div>
  )
}
