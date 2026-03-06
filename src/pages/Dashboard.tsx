import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserButton } from '@clerk/clerk-react'
import { useUserApi } from '../lib/userApi'

interface StoryboardRow {
  id: string
  title: string
  platform: string
  language: string
  art_style: string
  total_scenes: number
  status: string
  updated_at: string
}

interface UsageData {
  credits: number
  summary: { service: string; total: number }[]
  recent: { service: string; model: string; credits_used: number; created_at: string }[]
}

const PLATFORM_LABELS: Record<string, string> = {
  youtube_shorts: 'YouTube Shorts',
  reels: 'Reels',
  tiktok: 'TikTok',
}

const LANG_FLAGS: Record<string, string> = {
  id: '🇮🇩',
  en: '🇺🇸',
}

export function Dashboard() {
  const navigate = useNavigate()
  const { listStoryboards, deleteStoryboard, getUsage } = useUserApi()
  const [storyboards, setStoryboards] = useState<StoryboardRow[]>([])
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([listStoryboards(), getUsage()])
      .then(([boards, usageData]) => {
        if (Array.isArray(boards)) setStoryboards(boards)
        setUsage(usageData as UsageData)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: string) => {
    setStoryboards(prev => prev.filter(s => s.id !== id))
    deleteStoryboard(id).catch(() => {
      // restore on error
      listStoryboards().then(boards => Array.isArray(boards) && setStoryboards(boards))
    })
  }

  const s = {
    page: {
      minHeight: '100vh',
      width: '100%',
      background: 'linear-gradient(145deg, #f2f2f7 0%, #e5e5ea 50%, #f2f2f7 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
      paddingBottom: '40px',
    } as React.CSSProperties,
    header: {
      position: 'sticky' as const,
      top: 0,
      zIndex: 100,
      background: 'rgba(242,242,247,0.85)',
      backdropFilter: 'blur(30px)',
      WebkitBackdropFilter: 'blur(30px)',
      borderBottom: '0.5px solid rgba(0,0,0,0.1)',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    } as React.CSSProperties,
    card: {
      background: 'rgba(255,255,255,0.75)',
      backdropFilter: 'blur(40px) saturate(200%)',
      WebkitBackdropFilter: 'blur(40px) saturate(200%)',
      border: '0.5px solid rgba(255,255,255,0.9)',
      borderRadius: '22px',
      boxShadow: '0 2px 24px rgba(0,0,0,0.07), 0 0 0 0.5px rgba(255,255,255,0.6) inset',
      padding: '16px',
      marginBottom: '10px',
    } as React.CSSProperties,
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'rgba(255,255,255,0.85)',
            border: '0.5px solid rgba(0,0,0,0.12)',
            borderRadius: '12px',
            color: '#007aff',
            padding: '8px 14px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}>
          ← Home
        </button>
        <span style={{ color: '#1d1d1f', fontSize: '17px', fontWeight: 700, flex: 1 }}>
          My Projects
        </span>
        {usage && (
          <span style={{
            background: 'rgba(52,199,89,0.15)',
            color: '#34c759',
            borderRadius: '10px',
            padding: '4px 10px',
            fontSize: '13px',
            fontWeight: 700,
            marginRight: '6px',
          }}>
            {usage.credits} credits
          </span>
        )}
        <UserButton afterSignOutUrl="/auth" />
      </div>

      <div style={{ padding: '20px 16px 0', maxWidth: '700px', margin: '0 auto' }}>
        {/* New Storyboard button */}
        <button
          onClick={() => navigate('/')}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '16px',
            border: 'none',
            background: 'linear-gradient(135deg, #ff6b35, #ff4500)',
            boxShadow: '0 4px 20px rgba(255,107,53,0.4)',
            color: 'white',
            fontSize: '15px',
            fontWeight: 700,
            cursor: 'pointer',
            marginBottom: '20px',
            letterSpacing: '0.01em',
          }}>
          + New Storyboard
        </button>

        {/* Usage summary */}
        {usage && (
          <div style={{ ...s.card, marginBottom: '16px' }}>
            <p style={{ fontSize: '11px', color: 'rgba(60,60,67,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, margin: '0 0 10px' }}>
              Credit Usage
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {usage.summary.map(item => (
                <span key={item.service} style={{
                  background: 'rgba(118,118,128,0.1)',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  color: '#1d1d1f',
                }}>
                  {item.service}: <strong>{item.total}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(60,60,67,0.5)', fontSize: '14px' }}>
            Loading projects...
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ ...s.card, background: 'rgba(255,59,48,0.08)', border: '0.5px solid rgba(255,59,48,0.2)' }}>
            <p style={{ color: '#ff3b30', fontSize: '14px', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && storyboards.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(60,60,67,0.4)', fontSize: '15px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎬</div>
            No projects yet. Create your first storyboard!
          </div>
        )}

        {/* Storyboard cards */}
        {storyboards.map(board => (
          <div
            key={board.id}
            style={{
              ...s.card,
              cursor: 'pointer',
              transition: 'transform 0.1s, box-shadow 0.1s',
            }}
            onClick={() => navigate(`/storyboard?id=${board.id}`)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#1d1d1f', wordBreak: 'break-word' }}>
                    {board.title}
                  </span>
                  <span style={{ fontSize: '11px' }}>{LANG_FLAGS[board.language] || ''}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                  <span style={{
                    background: 'rgba(0,122,255,0.1)',
                    color: '#007aff',
                    borderRadius: '6px',
                    padding: '2px 7px',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}>
                    {PLATFORM_LABELS[board.platform] || board.platform}
                  </span>
                  <span style={{
                    background: 'rgba(118,118,128,0.1)',
                    color: 'rgba(60,60,67,0.6)',
                    borderRadius: '6px',
                    padding: '2px 7px',
                    fontSize: '11px',
                  }}>
                    {board.total_scenes} scenes
                  </span>
                  {board.status !== 'draft' && (
                    <span style={{
                      background: 'rgba(52,199,89,0.1)',
                      color: '#34c759',
                      borderRadius: '6px',
                      padding: '2px 7px',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}>
                      {board.status}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '11px', color: 'rgba(60,60,67,0.4)', margin: 0 }}>
                  {new Date(board.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); handleDelete(board.id) }}
                style={{
                  background: 'rgba(255,59,48,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ff3b30',
                  padding: '6px 10px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
