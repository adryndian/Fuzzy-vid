import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { SceneAssets, SceneAssetsMap, GenerationStatus, AudioHistoryItem } from '../types/schema'
import { defaultSceneAssets } from '../types/schema'
import { generateImage, generateVideo, generateAudio, checkVideoStatus } from '../lib/api'
import { useHistoryStore } from '../store/historyStore'
import { useCostStore } from '../store/costStore'
import { useStoryboardSessionStore } from '../store/storyboardSessionStore'
import { estimateImageCost, estimateVideoCost, estimateAudioCost, formatCost } from '../lib/costEstimate'

const POLLY_VOICES = ['Ruth', 'Joanna', 'Matthew', 'Joey'] as const
const ELEVENLABS_VOICES = ['Bella', 'Adam', 'Rachel', 'Antoni'] as const

const dropdownStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '8px',
  padding: '5px 24px 5px 8px',
  color: '#EFE1CF',
  fontSize: '11px',
  outline: 'none',
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7' viewBox='0 0 10 7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23EFE1CF' stroke-width='1.2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
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

  // Poll counts for display
  const [videoPollDisplayCounts, setVideoPollDisplayCounts] = useState<Record<number, number>>({})

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
        toast.error(`Scene ${sceneNum} video timed out`)
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
          toast.error(`Scene ${sceneNum} video failed`)
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
      const result = await generateImage({
        prompt,
        scene_number: sceneNum,
        project_id: (data.project_id as string) || 'storyboard',
        aspect_ratio: (data.aspect_ratio as string) || '9_16',
        art_style: (data.art_style as string) || 'cinematic_realistic',
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
      toast.error(`Image failed: ${msg}`)
    }
  }

  const handleGenerateVideo = async (scene: Record<string, unknown>) => {
    const sceneNum = scene.scene_number as number
    const sceneAsset = storedAssets[sceneNum]
    if (!sceneAsset?.imageUrl) return
    updateAsset(sceneNum, { videoStatus: 'generating', videoError: undefined })
    try {
      const data = storyboard as Record<string, unknown>
      const result = await generateVideo({
        image_url: sceneAsset.imageUrl,
        prompt: editedPrompts[sceneNum] ?? (scene.image_prompt as string),
        scene_number: sceneNum,
        project_id: (data.project_id as string) || 'storyboard',
        aspect_ratio: (data.aspect_ratio as string) || '9_16',
      })
      const vidCost = estimateVideoCost()
      addCostEntry({ service: 'video', model: 'Nova Reel', cost: vidCost })

      if (result.video_url) {
        updateAsset(sceneNum, { videoStatus: 'done', videoUrl: result.video_url })
        toast.success(`Scene ${sceneNum} video ready · ${formatCost(vidCost)}`)
      } else if (result.job_id) {
        updateAsset(sceneNum, { videoStatus: 'generating', videoJobId: result.job_id })
        toast(`Scene ${sceneNum} video started · polling every 8s`, { icon: '🎬', duration: 4000 })
        pollVideoStatus(sceneNum, result.job_id)
      } else {
        updateAsset(sceneNum, { videoStatus: 'error', videoError: 'No job_id or video_url returned' })
        toast.error('Video generation returned no job ID')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      updateAsset(sceneNum, { videoStatus: 'error', videoError: msg })
      toast.error(`Video failed: ${msg}`)
    }
  }

  const handleGenerateAudio = async (scene: Record<string, unknown>) => {
    const sceneNum = scene.scene_number as number
    const text = language === 'id'
      ? (scene.text_id as string) || (scene.text_en as string)
      : (scene.text_en as string) || (scene.text_id as string)
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
      toast.error(`Audio failed: ${msg}`)
    }
  }

  if (!storyboard) return null

  const scenes = (storyboard.scenes as Record<string, unknown>[]) || []
  const productionNotes = storyboard.production_notes as Record<string, unknown> | undefined

  const page: React.CSSProperties = {
    minHeight: '100vh',
    width: '100%',
    background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1527 50%, #060d1a 100%)',
    fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
    paddingBottom: '60px',
  }

  const glassCard: React.CSSProperties = {
    background: 'rgba(255,255,255,0.07)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '20px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
    marginBottom: '11px',
    overflow: 'hidden',
  }

  const statusBadge = (status: GenerationStatus, label: string, isVideoPolling = false) => {
    const colors: Record<GenerationStatus, string> = {
      idle: 'rgba(239,225,207,0.3)',
      generating: '#F05A25',
      done: '#4ade80',
      error: '#f87171',
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
    color = '#F05A25'
  ) => (
    <button
      onClick={onClick}
      disabled={status === 'generating' || disabled}
      style={{
        padding: '7px 11px',
        borderRadius: '12px',
        border: `1px solid ${status === 'done' ? '#4ade80' : disabled ? 'rgba(239,225,207,0.1)' : color + '66'}`,
        background: status === 'done' ? 'rgba(74,222,128,0.12)' :
                    disabled ? 'rgba(255,255,255,0.03)' :
                    `${color}18`,
        color: status === 'done' ? '#4ade80' :
               disabled ? 'rgba(239,225,207,0.25)' : color,
        fontSize: '13px', fontWeight: 600,
        cursor: (status === 'generating' || disabled) ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        opacity: status === 'generating' ? 0.7 : 1,
      }}>
      {status === 'generating' ? 'Generating...' :
       status === 'done' ? 'Re-generate' : label}
    </button>
  )

  const smallIconBtn: React.CSSProperties = {
    padding: '3px 8px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(239,225,207,0.6)',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  }

  // Cost tracker data
  const serviceTotals: Record<string, number> = {}
  const serviceColors: Record<string, string> = {
    Brain: '#3FA9F6',
    image: '#F05A25',
    video: '#4ade80',
    audio: '#A855F7',
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

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(10,15,30,0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '10px 11px',
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <button onClick={() => navigate('/')} style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(239,225,207,0.15)',
          borderRadius: '10px', color: '#EFE1CF',
          padding: '6px 12px', cursor: 'pointer',
          fontSize: '13px', fontWeight: 600,
        }}>
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#EFE1CF', fontSize: '15px', fontWeight: 700 }}>
            {storyboard.title as string}
          </div>
          <div style={{ color: 'rgba(239,225,207,0.4)', fontSize: '11px' }}>
            {scenes.length} scenes · Storyboard
          </div>
        </div>
        {/* Minimize to queue */}
        <button
          onClick={handleMinimize}
          title="Minimize to queue — continue generating in background"
          style={{
            padding: '6px 12px', borderRadius: '10px',
            border: '1px solid rgba(63,169,246,0.3)',
            background: 'rgba(63,169,246,0.1)',
            color: '#3FA9F6',
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
            border: `1px solid ${isAlreadySaved ? 'rgba(102,187,106,0.3)' : 'rgba(240,90,37,0.3)'}`,
            background: isAlreadySaved ? 'rgba(102,187,106,0.12)' : 'rgba(240,90,37,0.12)',
            color: isAlreadySaved ? '#66bb6a' : '#F05A25',
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
          background: 'rgba(15,20,35,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(240,90,37,0.2)',
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
            <span style={{ color: '#F05A25', fontWeight: 700 }}>
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
            <span style={{ marginLeft: 'auto', color: 'rgba(239,225,207,0.35)', fontSize: '10px' }}>
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
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  fontSize: '11px',
                }}>
                  <span style={{ color: 'rgba(239,225,207,0.3)', fontSize: '10px', minWidth: '50px' }}>
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
                  <span style={{ color: 'rgba(239,225,207,0.5)', flex: 1 }}>
                    {entry.model}
                  </span>
                  <span style={{ color: '#EFE1CF', fontWeight: 600 }}>
                    {formatCost(entry.cost)}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { clearSession(); setCostExpanded(false); setCostFilter(null) }}
                  style={{
                    padding: '4px 10px', borderRadius: '8px',
                    border: '1px solid rgba(248,113,113,0.3)',
                    background: 'rgba(248,113,113,0.1)',
                    color: '#f87171',
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
            <p style={{ color: 'rgba(239,225,207,0.5)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '7px', margin: '0 0 7px' }}>
              Production Notes
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
              {(productionNotes.color_palette as string[] || []).map((c: string, i: number) => (
                <span key={i} style={{
                  padding: '2px 8px', borderRadius: '20px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#EFE1CF', fontSize: '11px',
                }}>{c}</span>
              ))}
            </div>
            {productionNotes.music_tone && (
              <p style={{ color: 'rgba(239,225,207,0.5)', fontSize: '12px', margin: 0 }}>
                🎵 {productionNotes.music_tone as string}
              </p>
            )}
          </div>
        )}

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
                borderBottom: isCollapsed ? 'none' : '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '9px',
                  background: 'rgba(240,90,37,0.2)',
                  border: '1px solid rgba(240,90,37,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#F05A25', fontSize: '12px', fontWeight: 700, flexShrink: 0,
                }}>{sceneNum}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#EFE1CF', fontSize: '13px', fontWeight: 600 }}>
                    Scene {sceneNum}
                  </div>
                  <div style={{ color: '#3FA9F6', fontSize: '10px' }}>
                    {(scene.scene_type as string || '').replace(/_/g, ' ')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {scene.mood && (
                    <span style={{
                      padding: '2px 7px', borderRadius: '20px',
                      background: 'rgba(255,255,255,0.06)',
                      color: 'rgba(239,225,207,0.5)', fontSize: '10px',
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
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.05)',
                      color: 'rgba(239,225,207,0.5)',
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

                  {/* Image Prompt — editable textarea */}
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <p style={{ color: 'rgba(239,225,207,0.4)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                        Image Prompt
                      </p>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {currentPrompt !== (scene.image_prompt as string) && (
                          <button
                            onClick={() => setEditedPrompts(prev => { const n = { ...prev }; delete n[sceneNum]; return n })}
                            style={{ ...smallIconBtn, color: '#f87171', borderColor: 'rgba(248,113,113,0.3)', fontSize: '10px' }}
                          >
                            Reset
                          </button>
                        )}
                        <button onClick={() => handleCopy(currentPrompt)} style={smallIconBtn}>
                          Copy
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={currentPrompt}
                      onChange={e => setEditedPrompts(prev => ({ ...prev, [sceneNum]: e.target.value }))}
                      rows={3}
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.04)',
                        border: currentPrompt !== (scene.image_prompt as string)
                          ? '1px solid rgba(240,90,37,0.4)'
                          : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px',
                        padding: '6px 8px',
                        color: 'rgba(239,225,207,0.85)',
                        fontSize: '12px',
                        lineHeight: '1.5',
                        resize: 'vertical',
                        outline: 'none',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.2s',
                      }}
                    />
                  </div>

                  {/* Narration */}
                  {narration && (
                    <div style={{ marginBottom: '11px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <p style={{ color: 'rgba(239,225,207,0.4)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                          Narration VO
                        </p>
                        <button onClick={() => handleCopy(narration)} style={smallIconBtn}>
                          Copy
                        </button>
                      </div>
                      <p style={{ color: '#EFE1CF', fontSize: '13px', lineHeight: '1.6', fontStyle: 'italic', margin: 0 }}>
                        "{narration}"
                      </p>
                    </div>
                  )}

                  {/* IMAGE SECTION */}
                  <div style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                    padding: '8px',
                    marginBottom: '7px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontSize: '13px' }}>🖼️</span>
                        <span style={{ color: '#EFE1CF', fontSize: '12px', fontWeight: 600 }}>Image</span>
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
                      <p style={{ color: '#f87171', fontSize: '11px', marginBottom: '6px', margin: '0 0 6px' }}>
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
                    {actionBtn('Generate Image', () => handleGenerateImage(scene), sceneAsset.imageStatus)}
                    <div style={{ fontSize: '10px', color: 'rgba(239,225,207,0.35)', marginTop: '5px' }}>
                      Est. {formatCost(estimateImageCost(imageModel))}
                    </div>
                  </div>

                  {/* VIDEO SECTION */}
                  <div style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${hasImage ? 'rgba(63,169,246,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: '12px',
                    padding: '8px',
                    marginBottom: '7px',
                    opacity: hasImage ? 1 : 0.5,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontSize: '13px' }}>🎬</span>
                        <span style={{ color: '#EFE1CF', fontSize: '12px', fontWeight: 600 }}>Video</span>
                      </div>
                      {!hasImage
                        ? <span style={{ color: 'rgba(239,225,207,0.3)', fontSize: '10px' }}>Generate image first</span>
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
                        background: 'rgba(63,169,246,0.08)',
                        border: '1px solid rgba(63,169,246,0.15)',
                        borderRadius: '9px',
                        marginBottom: '8px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <div style={{ color: '#3FA9F6', fontSize: '12px', fontWeight: 600 }}>
                            Generating video...
                          </div>
                          <button
                            onClick={() => handleCancelVideo(sceneNum)}
                            style={{
                              padding: '2px 8px', borderRadius: '8px',
                              border: '1px solid rgba(248,113,113,0.4)',
                              background: 'rgba(248,113,113,0.1)',
                              color: '#f87171',
                              fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                        <div style={{ color: 'rgba(239,225,207,0.4)', fontSize: '11px' }}>
                          Nova Reel takes 2-5 minutes. Polling every 8s.
                        </div>
                        {pollCount > 0 && (
                          <div style={{ color: 'rgba(239,225,207,0.3)', fontSize: '10px', marginTop: '3px' }}>
                            Checked {pollCount} time{pollCount !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    )}

                    {sceneAsset.videoError && (
                      <p style={{ color: '#f87171', fontSize: '11px', marginBottom: '6px', margin: '0 0 6px' }}>
                        {sceneAsset.videoError}
                      </p>
                    )}

                    {actionBtn(
                      'Generate Video',
                      () => handleGenerateVideo(scene),
                      sceneAsset.videoStatus,
                      !hasImage,
                      '#3FA9F6'
                    )}
                    <div style={{ fontSize: '10px', color: 'rgba(239,225,207,0.35)', marginTop: '5px' }}>
                      Est. {formatCost(estimateVideoCost())}
                    </div>
                  </div>

                  {/* AUDIO SECTION */}
                  <div style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(168,85,247,0.2)',
                    borderRadius: '12px',
                    padding: '8px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontSize: '13px' }}>🎵</span>
                        <span style={{ color: '#EFE1CF', fontSize: '12px', fontWeight: 600 }}>Audio VO</span>
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
                            background: 'rgba(168,85,247,0.06)',
                            border: '1px solid rgba(168,85,247,0.15)',
                            borderRadius: '8px',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ color: 'rgba(239,225,207,0.5)', fontSize: '10px' }}>
                                {idx === 0 ? '▶ Latest' : `Take ${sceneAsset.audioHistory.length - idx}`}
                                {' · '}{item.engine === 'elevenlabs' ? 'ElevenLabs' : 'Polly'}
                                {' · '}{item.voice}
                              </span>
                              <span style={{ color: 'rgba(239,225,207,0.3)', fontSize: '10px' }}>
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
                      <p style={{ color: '#f87171', fontSize: '11px', marginBottom: '6px', margin: '0 0 6px' }}>
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
                      '#A855F7'
                    )}
                    <div style={{ fontSize: '10px', color: 'rgba(239,225,207,0.35)', marginTop: '5px' }}>
                      Est. {narration ? formatCost(estimateAudioCost(audioEngine, narration.length)) : '<$0.01'}
                    </div>
                  </div>

                  {/* Camera + Transition info */}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {scene.camera_angle && (
                      <span style={{
                        padding: '3px 8px', borderRadius: '20px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: 'rgba(239,225,207,0.45)', fontSize: '11px',
                      }}>📷 {scene.camera_angle as string}</span>
                    )}
                    {scene.transition && (
                      <span style={{
                        padding: '3px 8px', borderRadius: '20px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: 'rgba(239,225,207,0.45)', fontSize: '11px',
                      }}>{(scene.transition as string).replace(/_/g, ' ')}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Footer */}
        <p style={{ textAlign: 'center', color: 'rgba(239,225,207,0.2)', fontSize: '11px', marginTop: '17px' }}>
          {scenes.length} scenes · Fuzzy Short
        </p>
      </div>

      <style>{`select option { background: #0d1527; color: #EFE1CF; }`}</style>
    </div>
  )
}
