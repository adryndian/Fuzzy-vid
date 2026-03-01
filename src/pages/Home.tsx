import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

type Platform = 'youtube_shorts' | 'reels' | 'tiktok'
type BrainModel = 'gemini' | 'llama4_maverick' | 'claude_sonnet'
type Language = 'id' | 'en'
type ArtStyle = 'cinematic_realistic' | 'anime_stylized' | 'comic_book' | '3d_render' | 'oil_painting' | 'pixel_art'

export function Home() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [story, setStory] = useState('')
  const [platform, setPlatform] = useState<Platform>('youtube_shorts')
  const [brainModel, setBrainModel] = useState<BrainModel>('gemini')
  const [language, setLanguage] = useState<Language>('id')
  const [artStyle, setArtStyle] = useState<ArtStyle>('cinematic_realistic')
  const [scenes, setScenes] = useState(5)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim() || !story.trim()) {
      setError('Please fill in title and story')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/brain/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          story,
          platform,
          brain_model: brainModel,
          language,
          art_style: artStyle,
          total_scenes: scenes,
        })
      })
      const data = await res.json()
      if (data?.project_id) {
        navigate(`/storyboard/${data.project_id}`)
      } else {
        setError(data?.error || 'Generation failed. Check your API keys in Settings.')
      }
    } catch (e) {
      setError('Network error. Make sure the Worker is deployed.')
    } finally {
      setLoading(false)
    }
  }

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.07)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(239,225,207,0.14)',
    borderRadius: '20px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(239,225,207,0.12)',
    borderRadius: '12px',
    padding: '12px 16px',
    color: '#EFE1CF',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
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

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: '#000000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '48px 16px 40px',
      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
    }}>

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
      <div style={{ ...card, width: '100%', maxWidth: '440px', padding: '28px 24px' }}>

        {/* Story Title */}
        <div style={{ marginBottom: '20px' }}>
          <span style={label}>Story Title</span>
          <input
            style={inputStyle}
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
            background: loading ? 'rgba(240,90,37,0.5)' : '#F05A25',
            boxShadow: loading ? 'none' : '0 0 28px rgba(240,90,37,0.45)',
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
    </div>
  )
}
