import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useHistoryStore } from '../store/historyStore'

interface Scene {
  scene_number: number
  scene_type: string
  image_prompt: string
  text_id?: string
  text_en?: string
  mood?: string
  camera_angle?: string
  transition?: string
}

interface StoryboardData {
  title?: string
  language?: string
  platform?: string
  art_style?: string
  aspect_ratio?: string
  scenes?: Scene[]
}

const SCENE_TYPE_COLORS: Record<string, string> = {
  opening_hook: '#F05A25',
  rising_action: '#3FA9F6',
  climax: '#e040fb',
  resolution: '#66bb6a',
}

function sceneTypeColor(t: string) {
  return SCENE_TYPE_COLORS[t] || '#EFE1CF'
}

function sceneTypeLabel(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function Storyboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<StoryboardData | null>(null)
  const [error, setError] = useState('')
  const [rawJson, setRawJson] = useState('')
  const historyItems = useHistoryStore((s) => s.items)
  const addHistoryItem = useHistoryStore((s) => s.addItem)

  const isAlreadySaved = rawJson
    ? historyItems.some((item) => item.storyboard_data === rawJson)
    : false

  const handleSave = () => {
    if (!data || !rawJson || isAlreadySaved) return
    addHistoryItem({
      title: data.title || 'Untitled',
      platform: data.platform || '',
      art_style: data.art_style || '',
      language: data.language || 'en',
      brain_model: '',
      scenes_count: data.scenes?.length || 0,
      storyboard_data: rawJson,
    })
    toast.success('Saved to history')
  }

  useEffect(() => {
    const raw = sessionStorage.getItem('storyboard_result')
    if (!raw) {
      setError('No storyboard data found. Please generate one first.')
      return
    }
    setRawJson(raw)
    try {
      const parsed = JSON.parse(raw) as any
      // Normalize: handle cases where AI wraps scenes inside a nested object
      let normalized: StoryboardData = parsed
      if (!normalized.scenes) {
        if (Array.isArray(parsed.storyboard?.scenes)) normalized = parsed.storyboard
        else if (Array.isArray(parsed.data?.scenes)) normalized = parsed.data
        else if (Array.isArray(parsed.project?.scenes)) normalized = parsed.project
      }
      if (!normalized.scenes || !Array.isArray(normalized.scenes) || normalized.scenes.length === 0) {
        const keys = Object.keys(parsed).join(', ')
        setError(`Storyboard data is missing scenes. Keys found: ${keys || 'none'}. Please regenerate.`)
        return
      }
      setData(normalized)
    } catch {
      setError('Failed to parse storyboard data. Please regenerate.')
    }
  }, [])

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '20px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1527 40%, #0a1020 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 16px',
        fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
      }}>
        <div style={{ ...card, padding: '32px 28px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
          <p style={{ color: '#f87171', fontSize: '15px', marginBottom: '24px' }}>{error}</p>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '12px 28px', borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg, #F05A25, #d94e1f)',
              color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
            }}>
            ← Back to Home
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1527 40%, #0a1020 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
      }}>
        <div style={{ color: 'rgba(239,225,207,0.5)', fontSize: '15px' }}>Loading storyboard…</div>
      </div>
    )
  }

  const lang = data.language || 'en'

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1527 40%, #0a1020 100%)',
      padding: '40px 16px 60px',
      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
    }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>

        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(239,225,207,0.15)',
            borderRadius: '12px', color: 'rgba(239,225,207,0.7)',
            padding: '8px 16px', cursor: 'pointer', fontSize: '13px',
            marginBottom: '28px',
          }}>
          ← Back
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>🎬</div>
          <h1 style={{
            fontSize: '28px', fontWeight: 800, color: '#EFE1CF',
            letterSpacing: '-0.02em', margin: '0 0 8px',
          }}>
            {data.title || 'Storyboard'}
          </h1>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {data.platform && (
              <span style={{
                background: 'rgba(240,90,37,0.15)', border: '1px solid rgba(240,90,37,0.3)',
                borderRadius: '20px', padding: '3px 12px',
                color: '#F05A25', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>{data.platform.replace(/_/g, ' ')}</span>
            )}
            {data.art_style && (
              <span style={{
                background: 'rgba(63,169,246,0.12)', border: '1px solid rgba(63,169,246,0.25)',
                borderRadius: '20px', padding: '3px 12px',
                color: '#3FA9F6', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>{data.art_style.replace(/_/g, ' ')}</span>
            )}
            <span style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '20px', padding: '3px 12px',
              color: 'rgba(239,225,207,0.5)', fontSize: '11px', letterSpacing: '0.08em',
            }}>{data.scenes?.length} scenes</span>
          </div>
          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={isAlreadySaved}
            style={{
              marginTop: '14px',
              padding: '8px 20px', borderRadius: '10px',
              border: `1px solid ${isAlreadySaved ? 'rgba(102,187,106,0.3)' : 'rgba(240,90,37,0.3)'}`,
              background: isAlreadySaved ? 'rgba(102,187,106,0.12)' : 'rgba(240,90,37,0.12)',
              color: isAlreadySaved ? '#66bb6a' : '#F05A25',
              fontSize: '12px', fontWeight: 600, cursor: isAlreadySaved ? 'default' : 'pointer',
            }}
          >
            {isAlreadySaved ? '✓ Saved' : '💾 Save to History'}
          </button>
        </div>

        {/* Scene cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {data.scenes!.map((scene, i) => {
            const typeColor = sceneTypeColor(scene.scene_type)
            const narration = lang === 'id'
              ? (scene.text_id || scene.text_en || '')
              : (scene.text_en || scene.text_id || '')

            return (
              <div key={i} style={{
                ...card,
                padding: '20px 22px',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* top accent line */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                  background: `linear-gradient(90deg, ${typeColor}88, transparent)`,
                }} />

                {/* Scene header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '10px',
                    background: `${typeColor}22`, border: `1px solid ${typeColor}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: typeColor, fontSize: '13px', fontWeight: 800, flexShrink: 0,
                  }}>
                    {scene.scene_number}
                  </div>
                  <span style={{
                    fontSize: '12px', fontWeight: 700, color: typeColor,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                  }}>
                    {sceneTypeLabel(scene.scene_type)}
                  </span>
                </div>

                {/* Image prompt */}
                <div style={{ marginBottom: '12px' }}>
                  <span style={{
                    fontSize: '10px', color: 'rgba(239,225,207,0.35)',
                    textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '5px',
                  }}>Image Prompt</span>
                  <p style={{
                    color: 'rgba(239,225,207,0.85)', fontSize: '13px', lineHeight: '1.6',
                    margin: 0,
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '10px', padding: '10px 12px',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}>
                    {scene.image_prompt}
                  </p>
                </div>

                {/* Narration */}
                {narration && (
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{
                      fontSize: '10px', color: 'rgba(239,225,207,0.35)',
                      textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '5px',
                    }}>Narration</span>
                    <p style={{
                      color: '#EFE1CF', fontSize: '14px', lineHeight: '1.6',
                      margin: 0, fontStyle: 'italic',
                    }}>
                      "{narration}"
                    </p>
                  </div>
                )}

                {/* Meta row */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                  {scene.mood && (
                    <span style={metaChip}>🎭 {scene.mood}</span>
                  )}
                  {scene.camera_angle && (
                    <span style={metaChip}>🎥 {scene.camera_angle}</span>
                  )}
                  {scene.transition && (
                    <span style={metaChip}>⟶ {scene.transition}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', color: 'rgba(239,225,207,0.2)', fontSize: '11px', marginTop: '32px' }}>
          {data.scenes?.length} scenes · Fuzzy Short
        </p>
      </div>
    </div>
  )
}

const metaChip: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '20px',
  padding: '3px 10px',
  color: 'rgba(239,225,207,0.5)',
  fontSize: '11px',
}
