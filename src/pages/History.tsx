import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHistoryStore } from '../store/historyStore'
import { timeAgo } from '../lib/costEstimate'

export function History() {
  const navigate = useNavigate()
  const { items, removeItem, clearAll } = useHistoryStore()
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '20px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
  }

  const handleView = (id: string) => {
    const item = useHistoryStore.getState().getItem(id)
    if (item) {
      sessionStorage.setItem('storyboard_result', item.storyboard_data)
      navigate('/storyboard')
    }
  }

  const handleDelete = (id: string) => {
    if (confirmDeleteId === id) {
      removeItem(id)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(id)
      setTimeout(() => setConfirmDeleteId(null), 3000)
    }
  }

  const handleClearAll = () => {
    if (confirmClear) {
      clearAll()
      setConfirmClear(false)
    } else {
      setConfirmClear(true)
      setTimeout(() => setConfirmClear(false), 3000)
    }
  }

  const platformLabels: Record<string, string> = {
    youtube_shorts: 'Shorts',
    reels: 'Reels',
    tiktok: 'TikTok',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1527 40%, #0a1020 100%)',
      padding: '40px 16px 60px',
      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
    }}>
      <div style={{ maxWidth: '580px', margin: '0 auto' }}>

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#EFE1CF', margin: '0 0 4px' }}>
              History
            </h1>
            <p style={{ color: 'rgba(239,225,207,0.4)', fontSize: '13px', margin: 0 }}>
              {items.length} storyboard{items.length !== 1 ? 's' : ''} saved
            </p>
          </div>
          {items.length > 0 && (
            <button
              onClick={handleClearAll}
              style={{
                padding: '8px 16px', borderRadius: '10px',
                border: `1px solid ${confirmClear ? 'rgba(239,68,68,0.5)' : 'rgba(239,225,207,0.12)'}`,
                background: confirmClear ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                color: confirmClear ? '#f87171' : 'rgba(239,225,207,0.5)',
                fontSize: '12px', cursor: 'pointer', fontWeight: 600,
              }}
            >
              {confirmClear ? 'Confirm Clear All' : 'Clear All'}
            </button>
          )}
        </div>

        {/* List */}
        {items.length === 0 ? (
          <div style={{ ...card, padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <p style={{ color: 'rgba(239,225,207,0.5)', fontSize: '15px', margin: '0 0 20px' }}>
              No storyboards yet
            </p>
            <button
              onClick={() => navigate('/')}
              style={{
                padding: '10px 24px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #F05A25, #d94e1f)',
                color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Create your first storyboard
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {items.map((item) => (
              <div key={item.id} style={{ ...card, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                  background: 'linear-gradient(90deg, rgba(240,90,37,0.5), transparent)',
                }} />

                {/* Title + time */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <h3 style={{ color: '#EFE1CF', fontSize: '15px', fontWeight: 700, margin: 0, flex: 1 }}>
                    {item.title}
                  </h3>
                  <span style={{ color: 'rgba(239,225,207,0.3)', fontSize: '11px', marginLeft: '12px', whiteSpace: 'nowrap' }}>
                    {timeAgo(item.created_at)}
                  </span>
                </div>

                {/* Badges */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                  <span style={{
                    background: 'rgba(240,90,37,0.15)', border: '1px solid rgba(240,90,37,0.3)',
                    borderRadius: '20px', padding: '2px 10px',
                    color: '#F05A25', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase',
                  }}>
                    {platformLabels[item.platform] || item.platform}
                  </span>
                  <span style={{
                    background: 'rgba(63,169,246,0.12)', border: '1px solid rgba(63,169,246,0.25)',
                    borderRadius: '20px', padding: '2px 10px',
                    color: '#3FA9F6', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase',
                  }}>
                    {item.art_style.replace(/_/g, ' ')}
                  </span>
                  <span style={{
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '20px', padding: '2px 10px',
                    color: 'rgba(239,225,207,0.5)', fontSize: '10px',
                  }}>
                    {item.scenes_count} scenes
                  </span>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleView(item.id)}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '10px',
                      border: '1px solid rgba(240,90,37,0.3)',
                      background: 'rgba(240,90,37,0.12)',
                      color: '#F05A25', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    style={{
                      padding: '8px 14px', borderRadius: '10px',
                      border: `1px solid ${confirmDeleteId === item.id ? 'rgba(239,68,68,0.5)' : 'rgba(239,225,207,0.1)'}`,
                      background: confirmDeleteId === item.id ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)',
                      color: confirmDeleteId === item.id ? '#f87171' : 'rgba(239,225,207,0.4)',
                      fontSize: '12px', cursor: 'pointer',
                    }}
                  >
                    {confirmDeleteId === item.id ? 'Confirm' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <p style={{ textAlign: 'center', color: 'rgba(239,225,207,0.2)', fontSize: '11px', marginTop: '32px' }}>
          Stored locally in your browser
        </p>
      </div>
    </div>
  )
}
