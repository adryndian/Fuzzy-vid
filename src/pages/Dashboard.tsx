import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserButton } from '@clerk/clerk-react'
import { useUserApi } from '../lib/userApi'
import { useHistoryStore } from '../store/historyStore'
import { useTheme, tk } from '../lib/theme'
import { timeAgo } from '../lib/costEstimate'

interface StoryboardRow {
  id: string
  title: string
  platform: string
  language: string
  art_style: string
  total_scenes: number
  tone?: string
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

const TONE_BADGES: Record<string, { emoji: string; color: string }> = {
  documentary_viral:      { emoji: '📰', color: '#ff3b30' },
  natural_genz:           { emoji: '✌️', color: '#007aff' },
  informative:            { emoji: '💡', color: '#5856d6' },
  narrative_storytelling: { emoji: '📖', color: '#ff6b35' },
  product_ads:            { emoji: '🛍️', color: '#34c759' },
  educational:            { emoji: '🎓', color: '#af52de' },
  entertainment:          { emoji: '🎉', color: '#ffcc00' },
  motivational:           { emoji: '💪', color: '#ff9500' },
}

export function Dashboard() {
  const navigate = useNavigate()
  const { isDark, toggle } = useTheme()
  const t = tk(isDark)
  const { listStoryboards, deleteStoryboard, getUsage } = useUserApi()
  const localHistory = useHistoryStore(s => s.items)
  const removeLocalItem = useHistoryStore(s => s.removeItem)

  const [storyboards, setStoryboards] = useState<StoryboardRow[]>([])
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [cloudLoading, setCloudLoading] = useState(true)
  const [cloudError, setCloudError] = useState('')

  useEffect(() => {
    listStoryboards()
      .then(boards => { if (Array.isArray(boards)) setStoryboards(boards) })
      .catch(e => setCloudError(e.message))
      .finally(() => setCloudLoading(false))
    getUsage()
      .then(data => setUsage(data as UsageData))
      .catch(() => { /* ignore usage errors */ })
  }, [])

  const handleDelete = async (id: string) => {
    setStoryboards(prev => prev.filter(s => s.id !== id))
    deleteStoryboard(id).catch(() => {
      listStoryboards().then(boards => Array.isArray(boards) && setStoryboards(boards))
    })
  }

  const handleViewLocal = (id: string) => {
    const item = useHistoryStore.getState().getItem(id)
    if (item) {
      sessionStorage.setItem('storyboard_result', item.storyboard_data)
      navigate('/storyboard')
    }
  }

  const s = {
    page: {
      minHeight: '100vh',
      width: '100%',
      background: t.pageBg,
      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
      paddingBottom: '90px',
    } as React.CSSProperties,
    header: {
      position: 'sticky' as const,
      top: 0,
      zIndex: 100,
      background: t.headerBg,
      backdropFilter: 'blur(30px)',
      WebkitBackdropFilter: 'blur(30px)',
      borderBottom: t.navBorder,
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    } as React.CSSProperties,
    card: {
      background: t.cardBg,
      backdropFilter: 'blur(40px) saturate(200%)',
      WebkitBackdropFilter: 'blur(40px) saturate(200%)',
      border: t.cardBorder,
      borderRadius: '22px',
      boxShadow: t.cardShadow,
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
        <span style={{ color: t.textPrimary, fontSize: '17px', fontWeight: 700, flex: 1 }}>
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
            <p style={{ fontSize: '11px', color: 'var(--label-color)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, margin: '0 0 10px' }}>
              Credit Usage
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {usage.summary.map(item => (
                <span key={item.service} style={{
                  background: 'var(--input-bg)',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                }}>
                  {item.service}: <strong>{item.total}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Cloud Projects ── */}
        {cloudLoading ? (
          <p style={{ color: t.textSecondary, fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
            Loading cloud projects...
          </p>
        ) : cloudError ? (
          <div style={{ ...s.card, background: 'rgba(255,59,48,0.07)', border: '0.5px solid rgba(255,59,48,0.2)', marginBottom: '6px' }}>
            <p style={{ color: '#ff3b30', fontSize: '12px', margin: 0 }}>
              ☁️ Cloud sync unavailable — showing local history only.
            </p>
          </div>
        ) : storyboards.length === 0 ? null : (
          <>
            <p style={{ fontSize: '11px', color: t.textSecondary, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
              ☁️ Cloud Projects
            </p>
            {storyboards.map(board => (
              <div key={board.id} style={{ ...s.card, cursor: 'pointer' }}
                onClick={() => navigate(`/storyboard?id=${board.id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: t.textPrimary, wordBreak: 'break-word' }}>
                        {board.title}
                      </span>
                      <span style={{ fontSize: '11px' }}>{LANG_FLAGS[board.language] || ''}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      {board.tone && TONE_BADGES[board.tone] && (
                        <span style={{ padding: '2px 7px', borderRadius: '8px', fontSize: '10px', background: `${TONE_BADGES[board.tone].color}15`, color: TONE_BADGES[board.tone].color, border: `0.5px solid ${TONE_BADGES[board.tone].color}30`, fontWeight: 600 }}>
                          {TONE_BADGES[board.tone].emoji} {board.tone.replace(/_/g, ' ')}
                        </span>
                      )}
                      <span style={{ background: 'rgba(0,122,255,0.1)', color: '#007aff', borderRadius: '6px', padding: '2px 7px', fontSize: '11px', fontWeight: 600 }}>
                        {PLATFORM_LABELS[board.platform] || board.platform}
                      </span>
                      <span style={{ background: t.sectionBg, color: t.textSecondary, borderRadius: '6px', padding: '2px 7px', fontSize: '11px' }}>
                        {board.total_scenes} scenes
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: t.textTertiary, margin: 0 }}>
                      {new Date(board.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); handleDelete(board.id) }}
                    style={{ background: 'rgba(255,59,48,0.1)', border: 'none', borderRadius: '8px', color: '#ff3b30', padding: '6px 10px', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── Local History ── */}
        {localHistory.length > 0 && (
          <>
            <p style={{ fontSize: '11px', color: t.textSecondary, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: storyboards.length > 0 ? '16px' : '0', marginBottom: '8px' }}>
              💾 Local History
            </p>
            {localHistory.map(item => (
              <div key={item.id} style={{ ...s.card }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: t.textPrimary, marginBottom: '6px' }}>{item.title}</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <span style={{ background: 'rgba(255,107,53,0.12)', color: '#ff6b35', borderRadius: '6px', padding: '2px 7px', fontSize: '11px', fontWeight: 600 }}>
                        {PLATFORM_LABELS[item.platform] || item.platform}
                      </span>
                      <span style={{ background: t.sectionBg, color: t.textSecondary, borderRadius: '6px', padding: '2px 7px', fontSize: '11px' }}>
                        {item.scenes_count} scenes
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: t.textTertiary, margin: 0 }}>{timeAgo(item.created_at)}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => handleViewLocal(item.id)}
                      style={{ background: 'rgba(0,122,255,0.1)', border: 'none', borderRadius: '8px', color: '#007aff', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}>
                      View
                    </button>
                    <button onClick={() => removeLocalItem(item.id)}
                      style={{ background: 'rgba(255,59,48,0.1)', border: 'none', borderRadius: '8px', color: '#ff3b30', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}>
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Empty state */}
        {!cloudLoading && storyboards.length === 0 && localHistory.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: t.textSecondary, fontSize: '15px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎬</div>
            No projects yet. Create your first storyboard!
          </div>
        )}
      </div>
    </div>
  )
}
