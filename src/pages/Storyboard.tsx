import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { SceneAssets, SceneAssetsMap, GenerationStatus } from '../types/schema'
import { defaultSceneAssets } from '../types/schema'
import { generateImage, generateVideo, generateAudio, checkVideoStatus } from '../lib/api'
import { useHistoryStore } from '../store/historyStore'
import { useCostStore } from '../store/costStore'
import { estimateImageCost, estimateVideoCost, estimateAudioCost, formatCost } from '../lib/costEstimate'

export function Storyboard() {
  const navigate = useNavigate()
  const [storyboard, setStoryboard] = useState<Record<string, unknown> | null>(null)
  const [assets, setAssets] = useState<SceneAssetsMap>({})
  const [language, setLanguage] = useState('id')
  const [rawJson, setRawJson] = useState('')
  const [imageModel, setImageModel] = useState<'nova_canvas' | 'titan_v2'>('nova_canvas')
  const [audioEngine, setAudioEngine] = useState<'polly' | 'elevenlabs'>('polly')

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

  // Cleanup polling intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(videoPollingRefs.current).forEach(clearInterval)
    }
  }, [])

  useEffect(() => {
    const raw = sessionStorage.getItem('storyboard_result')
    if (!raw) { navigate('/'); return }
    setRawJson(raw)
    try {
      const parsed = JSON.parse(raw)
      // Normalize nested wrappers
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
      const stored = localStorage.getItem('fuzzy_short_settings')
      if (stored) {
        const keys = JSON.parse(stored)
        if (keys.language) setLanguage(keys.language)
      }
      // Read model selections from Home page
      const storedImageModel = sessionStorage.getItem('fuzzy_gen_imageModel')
      if (storedImageModel === 'nova_canvas' || storedImageModel === 'titan_v2') {
        setImageModel(storedImageModel)
      }
      const storedAudioModel = sessionStorage.getItem('fuzzy_gen_audioModel')
      if (storedAudioModel === 'polly' || storedAudioModel === 'elevenlabs') {
        setAudioEngine(storedAudioModel)
      }
    } catch { navigate('/') }
  }, [navigate])

  const updateAsset = (sceneNum: number, update: Partial<SceneAssets>) => {
    setAssets(prev => ({
      ...prev,
      [sceneNum]: { ...(prev[sceneNum] || defaultSceneAssets()), ...update }
    }))
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

  // --- Video polling ---
  const pollVideoStatus = useCallback((sceneNum: number, jobId: string) => {
    // Clear any existing poll for this scene
    if (videoPollingRefs.current[sceneNum]) {
      clearInterval(videoPollingRefs.current[sceneNum])
    }
    const interval = setInterval(async () => {
      try {
        const result = await checkVideoStatus(jobId)
        if (result.status === 'done' && result.video_url) {
          clearInterval(videoPollingRefs.current[sceneNum])
          delete videoPollingRefs.current[sceneNum]
          updateAsset(sceneNum, { videoStatus: 'done', videoUrl: result.video_url, videoJobId: jobId })
          toast.success(`Scene ${sceneNum} video ready!`)
        } else if (result.status === 'failed') {
          clearInterval(videoPollingRefs.current[sceneNum])
          delete videoPollingRefs.current[sceneNum]
          updateAsset(sceneNum, { videoStatus: 'error', videoError: result.message || 'Video generation failed', videoJobId: jobId })
          toast.error(`Scene ${sceneNum} video failed`)
        }
        // If still 'processing', keep polling
      } catch {
        // Network error — keep polling, don't kill it
      }
    }, 8000)
    videoPollingRefs.current[sceneNum] = interval
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGenerateImage = async (scene: Record<string, unknown>) => {
    const sceneNum = scene.scene_number as number
    updateAsset(sceneNum, { imageStatus: 'generating', imageError: undefined })
    try {
      const data = storyboard as Record<string, unknown>
      const result = await generateImage({
        prompt: scene.image_prompt as string,
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
    const sceneAsset = assets[sceneNum]
    if (!sceneAsset?.imageUrl) return
    updateAsset(sceneNum, { videoStatus: 'generating', videoError: undefined })
    try {
      const data = storyboard as Record<string, unknown>
      const result = await generateVideo({
        image_url: sceneAsset.imageUrl,
        prompt: scene.image_prompt as string,
        scene_number: sceneNum,
        project_id: (data.project_id as string) || 'storyboard',
        aspect_ratio: (data.aspect_ratio as string) || '9_16',
      })
      const vidCost = estimateVideoCost()
      addCostEntry({ service: 'video', model: 'Nova Reel', cost: vidCost })

      if (result.video_url) {
        // Synchronous result (unlikely for Nova Reel, but handle it)
        updateAsset(sceneNum, { videoStatus: 'done', videoUrl: result.video_url })
        toast.success(`Scene ${sceneNum} video ready · ${formatCost(vidCost)}`)
      } else if (result.job_id) {
        // Async — start polling
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
      })
      const audCost = estimateAudioCost(audioEngine, text.length)
      const modelLabel = audioEngine === 'elevenlabs' ? 'ElevenLabs' : 'Polly'
      updateAsset(sceneNum, { audioStatus: 'done', audioUrl: result.audio_url })
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
    marginBottom: '16px',
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
        padding: '10px 16px',
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
    padding: '4px 10px',
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

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(10,15,30,0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <button onClick={() => navigate('/')} style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(239,225,207,0.15)',
          borderRadius: '10px', color: '#EFE1CF',
          padding: '8px 14px', cursor: 'pointer',
          fontSize: '13px', fontWeight: 600,
        }}>
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#EFE1CF', fontSize: '16px', fontWeight: 700 }}>
            {storyboard.title as string}
          </div>
          <div style={{ color: 'rgba(239,225,207,0.4)', fontSize: '11px' }}>
            {scenes.length} scenes · Storyboard
          </div>
        </div>
        {/* Save to history */}
        <button
          onClick={handleSave}
          disabled={isAlreadySaved}
          style={{
            padding: '8px 14px', borderRadius: '10px',
            border: `1px solid ${isAlreadySaved ? 'rgba(102,187,106,0.3)' : 'rgba(240,90,37,0.3)'}`,
            background: isAlreadySaved ? 'rgba(102,187,106,0.12)' : 'rgba(240,90,37,0.12)',
            color: isAlreadySaved ? '#66bb6a' : '#F05A25',
            fontSize: '12px', fontWeight: 600,
            cursor: isAlreadySaved ? 'default' : 'pointer',
          }}
        >
          {isAlreadySaved ? '✓ Saved' : 'Save'}
        </button>
        <span style={{ fontSize: '20px' }}>🎬</span>
      </div>

      {/* Interactive Cost Tracker */}
      {costEntries.length > 0 && (
        <div style={{
          background: 'rgba(15,20,35,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(240,90,37,0.2)',
        }}>
          {/* Summary bar — always visible, clickable */}
          <div
            onClick={() => setCostExpanded(!costExpanded)}
            style={{
              padding: '8px 16px',
              display: 'flex', alignItems: 'center', gap: '12px',
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
                  padding: '2px 8px', borderRadius: '10px',
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

          {/* Expanded detail panel */}
          {costExpanded && (
            <div style={{
              padding: '0 16px 12px',
              maxHeight: '240px',
              overflowY: 'auto',
            }}>
              {costFilter && (
                <div style={{ marginBottom: '8px' }}>
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
                  padding: '5px 0',
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
              <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { clearSession(); setCostExpanded(false); setCostFilter(null) }}
                  style={{
                    padding: '5px 12px', borderRadius: '8px',
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

      <div style={{ padding: '20px 16px 0', maxWidth: '720px', margin: '0 auto' }}>

        {/* Production Notes */}
        {productionNotes && (
          <div style={{ ...glassCard, padding: '16px', marginBottom: '20px' }}>
            <p style={{ color: 'rgba(239,225,207,0.5)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', margin: '0 0 10px' }}>
              Production Notes
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              {(productionNotes.color_palette as string[] || []).map((c: string, i: number) => (
                <span key={i} style={{
                  padding: '3px 10px', borderRadius: '20px',
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
          const sceneAsset = assets[sceneNum] || defaultSceneAssets()
          const narration = language === 'id'
            ? (scene.text_id as string) || (scene.text_en as string)
            : (scene.text_en as string) || (scene.text_id as string)
          const hasImage = sceneAsset.imageStatus === 'done' && sceneAsset.imageUrl
          const hasVideo = sceneAsset.videoStatus === 'done' && sceneAsset.videoUrl
          const hasAudio = sceneAsset.audioStatus === 'done' && sceneAsset.audioUrl
          const isVideoPolling = sceneAsset.videoStatus === 'generating' && !!sceneAsset.videoJobId

          return (
            <div key={sceneNum} style={glassCard}>

              {/* Scene Header */}
              <div style={{
                padding: '14px 16px 10px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '10px',
                  background: 'rgba(240,90,37,0.2)',
                  border: '1px solid rgba(240,90,37,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#F05A25', fontSize: '13px', fontWeight: 700, flexShrink: 0,
                }}>{sceneNum}</div>
                <div>
                  <div style={{ color: '#EFE1CF', fontSize: '13px', fontWeight: 600 }}>
                    Scene {sceneNum}
                  </div>
                  <div style={{ color: '#3FA9F6', fontSize: '11px' }}>
                    {(scene.scene_type as string || '').replace(/_/g, ' ')}
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                  {scene.mood && (
                    <span style={{
                      padding: '3px 8px', borderRadius: '20px',
                      background: 'rgba(255,255,255,0.06)',
                      color: 'rgba(239,225,207,0.5)', fontSize: '10px',
                    }}>{scene.mood as string}</span>
                  )}
                </div>
              </div>

              <div style={{ padding: '14px 16px' }}>

                {/* Image Prompt */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <p style={{ color: 'rgba(239,225,207,0.4)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                      Image Prompt
                    </p>
                    {scene.image_prompt && (
                      <button onClick={() => handleCopy(scene.image_prompt as string)} style={smallIconBtn}>
                        Copy
                      </button>
                    )}
                  </div>
                  <p style={{ color: 'rgba(239,225,207,0.75)', fontSize: '12px', lineHeight: '1.5', margin: 0 }}>
                    {scene.image_prompt as string}
                  </p>
                </div>

                {/* Narration */}
                {narration && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
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
                  borderRadius: '14px',
                  padding: '12px',
                  marginBottom: '10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '14px' }}>🖼️</span>
                      <span style={{ color: '#EFE1CF', fontSize: '12px', fontWeight: 600 }}>Image</span>
                    </div>
                    {statusBadge(sceneAsset.imageStatus, 'Image')}
                  </div>

                  {hasImage && (
                    <>
                      <img
                        src={sceneAsset.imageUrl}
                        alt={`Scene ${sceneNum}`}
                        style={{
                          width: '100%', borderRadius: '10px',
                          marginBottom: '8px', display: 'block',
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}
                      />
                      <div style={{ marginBottom: '10px' }}>
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
                    <p style={{ color: '#f87171', fontSize: '11px', marginBottom: '8px', margin: '0 0 8px' }}>
                      {sceneAsset.imageError}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    {(['nova_canvas', 'titan_v2'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setImageModel(m)}
                        style={{
                          padding: '4px 10px', borderRadius: '20px',
                          border: `1px solid ${imageModel === m ? 'rgba(240,90,37,0.5)' : 'rgba(255,255,255,0.1)'}`,
                          background: imageModel === m ? 'rgba(240,90,37,0.15)' : 'rgba(255,255,255,0.04)',
                          color: imageModel === m ? '#F05A25' : 'rgba(239,225,207,0.5)',
                          fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {m === 'nova_canvas' ? 'Nova Canvas' : 'Titan V2'}
                      </button>
                    ))}
                  </div>
                  {actionBtn('Generate Image', () => handleGenerateImage(scene), sceneAsset.imageStatus)}
                  <div style={{ fontSize: '10px', color: 'rgba(239,225,207,0.35)', marginTop: '6px' }}>
                    Est. {formatCost(estimateImageCost(imageModel))}
                  </div>
                </div>

                {/* VIDEO SECTION */}
                <div style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${hasImage ? 'rgba(63,169,246,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: '14px',
                  padding: '12px',
                  marginBottom: '10px',
                  opacity: hasImage ? 1 : 0.5,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '14px' }}>🎬</span>
                      <span style={{ color: '#EFE1CF', fontSize: '12px', fontWeight: 600 }}>Video</span>
                    </div>
                    {!hasImage
                      ? <span style={{ color: 'rgba(239,225,207,0.3)', fontSize: '10px' }}>Generate image first</span>
                      : statusBadge(sceneAsset.videoStatus, 'Video', isVideoPolling)
                    }
                  </div>

                  {hasVideo && (
                    <>
                      <video
                        src={sceneAsset.videoUrl}
                        controls
                        style={{
                          width: '100%', borderRadius: '10px',
                          marginBottom: '8px', display: 'block',
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}
                      />
                      <div style={{ marginBottom: '10px' }}>
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
                      padding: '12px',
                      background: 'rgba(63,169,246,0.08)',
                      border: '1px solid rgba(63,169,246,0.15)',
                      borderRadius: '10px',
                      marginBottom: '10px',
                      textAlign: 'center',
                    }}>
                      <div style={{ color: '#3FA9F6', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                        Generating video...
                      </div>
                      <div style={{ color: 'rgba(239,225,207,0.4)', fontSize: '11px' }}>
                        Nova Reel takes 2-5 minutes. Polling every 8s.
                      </div>
                    </div>
                  )}

                  {sceneAsset.videoError && (
                    <p style={{ color: '#f87171', fontSize: '11px', marginBottom: '8px', margin: '0 0 8px' }}>
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
                  <div style={{ fontSize: '10px', color: 'rgba(239,225,207,0.35)', marginTop: '6px' }}>
                    Est. {formatCost(estimateVideoCost())}
                  </div>
                </div>

                {/* AUDIO SECTION */}
                <div style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(168,85,247,0.2)',
                  borderRadius: '14px',
                  padding: '12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '14px' }}>🎵</span>
                      <span style={{ color: '#EFE1CF', fontSize: '12px', fontWeight: 600 }}>Audio VO</span>
                      <span style={{ color: 'rgba(239,225,207,0.3)', fontSize: '10px' }}>
                        {audioEngine === 'elevenlabs' ? 'ElevenLabs' : 'AWS Polly'}
                      </span>
                    </div>
                    {statusBadge(sceneAsset.audioStatus, 'Audio')}
                  </div>

                  {hasAudio && (
                    <>
                      <audio
                        src={sceneAsset.audioUrl}
                        controls
                        style={{ width: '100%', marginBottom: '8px' }}
                      />
                      <div style={{ marginBottom: '10px' }}>
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
                    <p style={{ color: '#f87171', fontSize: '11px', marginBottom: '8px', margin: '0 0 8px' }}>
                      {sceneAsset.audioError}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    {(['polly', 'elevenlabs'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setAudioEngine(m)}
                        style={{
                          padding: '4px 10px', borderRadius: '20px',
                          border: `1px solid ${audioEngine === m ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.1)'}`,
                          background: audioEngine === m ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)',
                          color: audioEngine === m ? '#A855F7' : 'rgba(239,225,207,0.5)',
                          fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {m === 'polly' ? 'AWS Polly' : 'ElevenLabs'}
                      </button>
                    ))}
                  </div>

                  {actionBtn(
                    'Generate Audio VO',
                    () => handleGenerateAudio(scene),
                    sceneAsset.audioStatus,
                    false,
                    '#A855F7'
                  )}
                  <div style={{ fontSize: '10px', color: 'rgba(239,225,207,0.35)', marginTop: '6px' }}>
                    Est. {narration ? formatCost(estimateAudioCost(audioEngine, narration.length)) : '<$0.01'}
                  </div>
                </div>

                {/* Camera + Transition info */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                  {scene.camera_angle && (
                    <span style={{
                      padding: '4px 10px', borderRadius: '20px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(239,225,207,0.45)', fontSize: '11px',
                    }}>📷 {scene.camera_angle as string}</span>
                  )}
                  {scene.transition && (
                    <span style={{
                      padding: '4px 10px', borderRadius: '20px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(239,225,207,0.45)', fontSize: '11px',
                    }}>{(scene.transition as string).replace(/_/g, ' ')}</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {/* Footer */}
        <p style={{ textAlign: 'center', color: 'rgba(239,225,207,0.2)', fontSize: '11px', marginTop: '24px' }}>
          {scenes.length} scenes · Fuzzy Short
        </p>
      </div>
    </div>
  )
}
