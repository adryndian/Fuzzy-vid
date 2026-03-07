import { useNavigate, useLocation } from 'react-router-dom'
import { useGenTaskStore } from '../store/genTaskStore'
import { useStoryboardSessionStore } from '../store/storyboardSessionStore'
import { useTheme, tk } from '../lib/theme'

const TABS = [
  { path: '/',          icon: '🎬', label: 'Create'   },
  { path: '/dashboard', icon: '📋', label: 'Projects'  },
  { path: '/settings',  icon: '⚙️', label: 'Settings' },
]

export function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { isDark, toggle } = useTheme()
  const t = tk(isDark)

  const runningTasks = useGenTaskStore(s => s.tasks.filter(t => t.status === 'running').length)
  const minimizedSessions = useStoryboardSessionStore(s =>
    Object.values(s.sessions).filter(s => s.isMinimized).length
  )
  const totalIndicator = runningTasks + minimizedSessions

  if (pathname === '/auth') return null

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 200,
      background: t.navBg,
      backdropFilter: 'blur(28px) saturate(180%)',
      WebkitBackdropFilter: 'blur(28px) saturate(180%)',
      borderTop: t.navBorder,
      borderRadius: '20px 20px 0 0',
      display: 'flex',
      alignItems: 'stretch',
      paddingBottom: 'env(safe-area-inset-bottom, 4px)',
      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
      boxShadow: isDark
        ? '0 -4px 24px rgba(0,0,0,0.4)'
        : '0 -2px 16px rgba(0,0,0,0.06)',
    }}>
      {TABS.map(tab => {
        const active = pathname === tab.path
        const showBadge = tab.path === '/' && totalIndicator > 0
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              flex: 1,
              padding: '10px 0 7px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '3px',
              position: 'relative',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ fontSize: '21px', lineHeight: 1 }}>{tab.icon}</span>
            <span style={{
              fontSize: '10px',
              fontWeight: active ? 700 : 400,
              color: active ? '#ff6b35' : t.textSecondary,
              letterSpacing: '-0.01em',
            }}>
              {tab.label}
            </span>
            {active && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '32px',
                height: '2px',
                borderRadius: '0 0 2px 2px',
                background: '#ff6b35',
              }} />
            )}
            {showBadge && (
              <span style={{
                position: 'absolute',
                top: '6px', right: '20%',
                background: '#ff3b30',
                color: 'white',
                fontSize: '9px',
                fontWeight: 800,
                minWidth: '16px', height: '16px',
                borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 3px',
                boxShadow: '0 1px 4px rgba(255,59,48,0.5)',
              }}>
                {totalIndicator > 9 ? '9+' : totalIndicator}
              </span>
            )}
          </button>
        )
      })}

      {/* Dark mode toggle */}
      <button
        onClick={toggle}
        style={{
          padding: '10px 14px 7px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '3px',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span style={{ fontSize: '19px', lineHeight: 1 }}>{isDark ? '☀️' : '🌙'}</span>
        <span style={{ fontSize: '10px', color: t.textSecondary, letterSpacing: '-0.01em' }}>
          {isDark ? 'Light' : 'Dark'}
        </span>
      </button>
    </nav>
  )
}
