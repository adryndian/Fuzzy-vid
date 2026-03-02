import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { SceneAssets, SceneAssetsMap, GenerationStatus, AudioHistoryItem } from '../types/schema'
import { defaultSceneAssets, saveVideoJob, loadVideoJob, clearVideoJob, redistributeDurations } from '../types/schema'
import { generateImage, generateAudio, checkVideoStatus, startVideoJob, enhancePrompt, rewriteVO } from '../lib/api'
import { useHistoryStore } from '../store/historyStore'
import { useCostStore } from '../store/costStore'
import { useStoryboardSessionStore } from '../store/storyboardSessionStore'
import { estimateImageCost, estimateVideoCost, estimateAudioCost, formatCost } from '../lib/costEstimate'

const POLLY_VOICES = ['Ruth', 'Joanna', 'Matthew', 'Joey'] as const
const ELEVENLABS_VOICES = ['Bella', 'Adam', 'Rachel', 'Antoni'] as const

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

  // Local UI state (not persisted)
  const [storyboard, setStoryboard] = useState<Record<string, unknown> | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [rawJson, setRawJson] = useState('')
  const [imageModel, setImageModel] = useState<'nova_canvas' | 'titan_v2'>('nova_canvas')
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

  // Page-level dismissable toast
  const [pageToast, setPageToast] = useState<{msg: string, type: 'error'|'success'} | null>(null)

  // Cost tracker UI state
  const [costExpanded, setCostExpanded] = useState(false)
  const [costFilter, setCostFilter] = useState<string | null>(null)

  // Video polling refs
  const videoPollingRefs = useRef<Record<number, ReturnType<typeof setInterval>>>({})

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

  // Reset voice when engine changes
  useEffect(() => {
    setAudioVoice(audioEngine === 'polly' ? 'Ruth' : 'Bella')
  }, [audioEngine])

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
      const imgModel = (storedImageModel === 'nova_canvas' || storedImageModel === 'titan_v2')
        ? storedImageModel : 'nova_canvas'
      const storedAudioModel = sessionStorage.getItem('fuzzy_gen_audioModel')
      const audModel = (storedAudioModel === 'polly' || storedAudioModel === 'elevenlabs')
        ? storedAudioModel : 'polly'

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
      // Initialize scene durations evenly across 60s default
      const scenes = (data.scenes as Record<string, unknown>[]) || []
      const initDurations: Record<number, number> = {}
      scenes.forEach((_, i) => { initDurations[i + 1] = Math.max(2, Math.min(6, Math.round(60 / scenes.length))) })
      setSceneDurations(initDurations)
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
  const handleImageModelChange = (val: 'nova_canvas' | 'titan_v2') => {
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
  }, [updateAsset])

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

      const result = await generateImage({
        prompt: finalPrompt,
        scene_number: sceneNum,
        project_id: (data.project_id as string) || 'storyboard',
        aspect_ratio: aspectRatio,
        art_style: artStyle,
        image_model: imageModel,
      })
      const imgCost = estimateImageCost(imageModel)
      const modelLabel = imageModel === 'titan_v2' ? 'Titan V2' : 'Nova Canvas'
      updateAsset(sceneNum, { imageStatus: 'done', imageUrl: result.image_url })
      addCostEntry({ service: 'image', model: modelLabel, cost: imgCost })
      toast.success(`Scene ${sceneNum} image ready · ${formatCost(imgCost)}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      updateAsset(sceneNum, { imageStatus: 'error', imageError: msg })
      setPageToast({ msg: `Image failed: ${msg}`, type: 'error' })
    }
  }

  const handleGenerateVideo = async (scene: Record<string, unknown>) => {
    const sceneNum = scene.scene_number as number
    const sceneAsset = storedAssets[sceneNum]
    if (!sceneAsset?.imageUrl) return
    updateAsset(sceneNum, { videoStatus: 'generating', videoError: undefined })
    try {
      const data = storyboard as Record<string, unknown>
      const projectId = (data.project_id as string) || 'storyboard'
      const durationSeconds = sceneDurations[sceneNum] || 6
      const result = await startVideoJob({
        image_url: sceneAsset.imageUrl,
        prompt: editedPrompts[sceneNum] ?? (scene.image_prompt as string),
        scene_number: sceneNum,
        project_id: projectId,
        aspect_ratio: (data.aspect_ratio as string) || '9_16',
        duration_seconds: durationSeconds,
      })
      const vidCost = estimateVideoCost()
      addCostEntry({ service: 'video', model: 'Nova Reel', cost: vidCost })

      if (result.job_id) {
        updateAsset(sceneNum, { videoStatus: 'generating', videoJobId: result.job_id })
        // Save to localStorage so we can resume on page reload
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      updateAsset(sceneNum, { videoStatus: 'error', videoError: msg })
      setPageToast({ msg: `Video failed: ${msg}`, type: 'error' })
    }
  }

  const handleRewriteVO = async (scene: Record<string, unknown>, sceneNum: number) => {
    setRewritingVO(prev => ({ ...prev, [sceneNum]: true }))
    const originalText = language === 'id'
      ? (scene.text_id as string) || ''
      : (scene.text_en as string) || ''
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

  const handleGenerateAudio = async (scene: Record<string, unknown>) => {
    const sceneNum = scene.scene_number as number
    const text = customVO[sceneNum]
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      updateAsset(sceneNum, { audioStatus: 'error', audioError: msg })
      setPageToast({ msg: `Audio failed: ${msg}`, type: 'error' })
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
        padding: '10px 11px',
        display: 'flex', alignItems: 'center', gap: '10px',
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
        <div style={{ flex: 1 }}>
          <div style={{ color: '#1d1d1f', fontSize: '15px', fontWeight: 700 }}>
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
        <span style={{ fontSize: '18px' }}>🎬</span>
      </div>

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

      <div style={{ padding: '14px 11px 0', maxWidth: '720px', margin: '0 auto' }}>

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

        {/* Scenes */}
        {scenes.map((scene) => {
          const sceneNum = scene.scene_number as number
          const sceneAsset: SceneAssets = storedAssets[sceneNum] || defaultSceneAssets()
          const narration = language === 'id'
            ? (scene.text_id as string) || (scene.text_en as string)
            : (scene.text_en as string) || (scene.text_id as string)
          const hasImage = sceneAsset.imageStatus === 'done' && sceneAsset.imageUrl
          const hasVideo = sceneAsset.videoStatus === 'done' && sceneAsset.videoUrl
          const hasAudio = sceneAsset.audioStatus === 'done' && sceneAsset.audioUrl
          const isVideoPolling = sceneAsset.videoStatus === 'generating' && !!sceneAsset.videoJobId
          const pollCount = videoPollDisplayCounts[sceneNum] || 0
          const isCollapsed = collapsedScenes.has(sceneNum)
          const currentPrompt = editedPrompts[sceneNum] ?? (scene.image_prompt as string ?? '')

          return (
            <div key={sceneNum} style={glassCard}>

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
                          model: imageModel === 'titan_v2' ? 'Titan V2' : 'Nova Canvas',
                          dimensions: (() => {
                            const ar = (storyboard.aspect_ratio as string) || '9_16'
                            const dimMap: Record<string, string> = {
                              '9_16': imageModel === 'titan_v2' ? '768x1280' : '720x1280',
                              '16_9': imageModel === 'titan_v2' ? '1280x768' : '1280x720',
                              '1_1': '1024x1024',
                              '4_5': imageModel === 'titan_v2' ? '896x1152' : '896x1120',
                            }
                            return dimMap[ar] || dimMap['9_16']
                          })(),
                        }, null, 2)}
                      </pre>
                    )}
                  </div>

                  {/* Narration + Rewrite VO */}
                  {narration && (
                    <div style={{ marginBottom: '11px' }}>
                      <div style={{
                        background: 'rgba(0,0,0,0.03)',
                        border: '0.5px solid rgba(0,0,0,0.08)',
                        borderRadius: '14px',
                        padding: '10px 12px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ color: 'rgba(60,60,67,0.5)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Narration VO
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {voCharInfo[sceneNum] && (
                              <span style={{
                                fontSize: '10px', fontWeight: 600,
                                color: voCharInfo[sceneNum].count <= voCharInfo[sceneNum].limit ? '#34c759' : '#ff3b30'
                              }}>
                                {voCharInfo[sceneNum].count}/{voCharInfo[sceneNum].limit} chars
                              </span>
                            )}
                            <button onClick={() => handleCopy(customVO[sceneNum] || narration)} style={smallIconBtn}>
                              Copy
                            </button>
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
                        <p style={{ color: '#1d1d1f', fontSize: '13px', lineHeight: '1.5', fontStyle: 'italic', margin: 0 }}>
                          "{customVO[sceneNum] || narration}"
                        </p>
                      </div>
                    </div>
                  )}

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
                        onChange={e => handleImageModelChange(e.target.value as 'nova_canvas' | 'titan_v2')}
                        style={{ ...dropdownStyle, width: 'auto' }}
                      >
                        <option value="nova_canvas">Nova Canvas</option>
                        <option value="titan_v2">Titan V2</option>
                      </select>
                    </div>
                    {actionBtn('Generate Image', () => handleGenerateImage(scene), sceneAsset.imageStatus, false, '#ff6b35')}
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

                  {/* VIDEO SECTION */}
                  <div style={{
                    background: 'rgba(0,122,255,0.04)',
                    border: `0.5px solid ${hasImage ? 'rgba(0,122,255,0.15)' : 'rgba(0,0,0,0.05)'}`,
                    borderRadius: '16px',
                    padding: '10px',
                    marginBottom: '8px',
                    opacity: hasImage ? 1 : 0.5,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontSize: '13px' }}>🎬</span>
                        <span style={{ color: '#1d1d1f', fontSize: '12px', fontWeight: 600 }}>Video</span>
                      </div>
                      {!hasImage
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

                    {isVideoPolling && !hasVideo && (
                      <div style={{
                        padding: '8px',
                        background: 'rgba(0,122,255,0.06)',
                        border: '0.5px solid rgba(0,122,255,0.15)',
                        borderRadius: '12px',
                        marginBottom: '8px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <div style={{ color: '#007aff', fontSize: '12px', fontWeight: 600 }}>
                            Generating video...
                          </div>
                          <button
                            onClick={() => handleCancelVideo(sceneNum)}
                            style={{
                              padding: '2px 8px', borderRadius: '8px',
                              border: '0.5px solid rgba(255,59,48,0.3)',
                              background: 'rgba(255,59,48,0.08)',
                              color: '#ff3b30',
                              fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                        <div style={{ color: 'rgba(60,60,67,0.5)', fontSize: '11px' }}>
                          Nova Reel takes 2-5 minutes. Polling every 8s.
                        </div>
                        {pollCount > 0 && (
                          <div style={{ color: 'rgba(60,60,67,0.35)', fontSize: '10px', marginTop: '3px' }}>
                            Checked {pollCount} time{pollCount !== 1 ? 's' : ''}
                          </div>
                        )}
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

                    {actionBtn(
                      `Generate Video (${sceneDurations[sceneNum] || 6}s)`,
                      () => handleGenerateVideo(scene),
                      sceneAsset.videoStatus,
                      !hasImage,
                      '#007aff'
                    )}
                    <div style={{ fontSize: '10px', color: 'rgba(60,60,67,0.4)', marginTop: '5px' }}>
                      Est. {formatCost(estimateVideoCost())}
                    </div>
                  </div>

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
                        {(audioEngine === 'polly' ? POLLY_VOICES : ELEVENLABS_VOICES).map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>

                    {actionBtn(
                      'Generate Audio VO',
                      () => handleGenerateAudio(scene),
                      sceneAsset.audioStatus,
                      false,
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
        })}

        {/* Footer */}
        <p style={{ textAlign: 'center', color: 'rgba(60,60,67,0.3)', fontSize: '11px', marginTop: '17px' }}>
          {scenes.length} scenes · Fuzzy Short
        </p>
      </div>

      <style>{`select option { background: #f2f2f7; color: #1d1d1f; }`}</style>
    </div>
  )
}
