import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { SceneAssets, SceneAssetsMap, GenerationStatus } from '../types/schema'
import { defaultSceneAssets } from '../types/schema'
import { generateImage, generateVideo, generateAudio } from '../lib/api'
import { useHistoryStore } from '../store/historyStore'

export function Storyboard() {
  const navigate = useNavigate()
  const [storyboard, setStoryboard] = useState<Record<string, unknown> | null>(null)
  const [assets, setAssets] = useState<SceneAssetsMap>({})
  const [language, setLanguage] = useState('id')
  const [rawJson, setRawJson] = useState('')

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
    } catch { navigate('/') }
  }, [navigate])

  const updateAsset = (sceneNum: number, update: Partial<SceneAssets>) => {
    setAssets(prev => ({
      ...prev,
      [sceneNum]: { ...(prev[sceneNum] || defaultSceneAssets()), ...update }
    }))
  }

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
      })
      updateAsset(sceneNum, { imageStatus: 'done', imageUrl: result.image_url })
      toast.success(`Scene ${sceneNum} image ready`)
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
      updateAsset(sceneNum, { videoStatus: 'done', videoUrl: result.video_url })
      toast.success(`Scene ${sceneNum} video ready`)
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
        engine: 'polly',
      })
      updateAsset(sceneNum, { audioStatus: 'done', audioUrl: result.audio_url })
      toast.success(`Scene ${sceneNum} audio ready`)
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

  const statusBadge = (status: GenerationStatus, label: string) => {
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
        {status === 'generating' ? 'Generating...' :
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
                  <p style={{ color: 'rgba(239,225,207,0.4)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px', margin: '0 0 4px' }}>
                    Image Prompt
                  </p>
                  <p style={{ color: 'rgba(239,225,207,0.75)', fontSize: '12px', lineHeight: '1.5', margin: 0 }}>
                    {scene.image_prompt as string}
                  </p>
                </div>

                {/* Narration */}
                {narration && (
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ color: 'rgba(239,225,207,0.4)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px', margin: '0 0 4px' }}>
                      Narration VO
                    </p>
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
                    <img
                      src={sceneAsset.imageUrl}
                      alt={`Scene ${sceneNum}`}
                      style={{
                        width: '100%', borderRadius: '10px',
                        marginBottom: '10px', display: 'block',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    />
                  )}

                  {sceneAsset.imageError && (
                    <p style={{ color: '#f87171', fontSize: '11px', marginBottom: '8px', margin: '0 0 8px' }}>
                      {sceneAsset.imageError}
                    </p>
                  )}

                  {actionBtn('Generate Image', () => handleGenerateImage(scene), sceneAsset.imageStatus)}
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
                      : statusBadge(sceneAsset.videoStatus, 'Video')
                    }
                  </div>

                  {hasVideo && (
                    <video
                      src={sceneAsset.videoUrl}
                      controls
                      style={{
                        width: '100%', borderRadius: '10px',
                        marginBottom: '10px', display: 'block',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    />
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
                      <span style={{ color: 'rgba(239,225,207,0.3)', fontSize: '10px' }}>AWS Polly</span>
                    </div>
                    {statusBadge(sceneAsset.audioStatus, 'Audio')}
                  </div>

                  {hasAudio && (
                    <audio
                      src={sceneAsset.audioUrl}
                      controls
                      style={{ width: '100%', marginBottom: '10px' }}
                    />
                  )}

                  {sceneAsset.audioError && (
                    <p style={{ color: '#f87171', fontSize: '11px', marginBottom: '8px', margin: '0 0 8px' }}>
                      {sceneAsset.audioError}
                    </p>
                  )}

                  {actionBtn(
                    'Generate Audio VO',
                    () => handleGenerateAudio(scene),
                    sceneAsset.audioStatus,
                    false,
                    '#A855F7'
                  )}
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
