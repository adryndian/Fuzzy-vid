import { useNavigate, useLocation } from 'react-router-dom'

const TABS = [
  { path: '/',          icon: '🎬', label: 'Create'   },
  { path: '/dashboard', icon: '📋', label: 'Projects'  },
  { path: '/history',   icon: '🕐', label: 'History'  },
  { path: '/settings',  icon: '⚙️', label: 'Settings' },
]

export function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  if (pathname === '/auth') return null

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 200,
      background: 'rgba(242,242,247,0.94)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      borderTop: '0.5px solid rgba(0,0,0,0.1)',
      display: 'flex',
      justifyContent: 'space-around',
      paddingBottom: 'env(safe-area-inset-bottom, 4px)',
      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
    }}>
      {TABS.map(tab => {
        const active = pathname === tab.path
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
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ fontSize: '21px', lineHeight: 1, filter: active ? 'none' : 'grayscale(30%)' }}>
              {tab.icon}
            </span>
            <span style={{
              fontSize: '10px',
              fontWeight: active ? 700 : 400,
              color: active ? '#ff6b35' : 'rgba(60,60,67,0.5)',
              letterSpacing: '-0.01em',
            }}>
              {tab.label}
            </span>
            {active && (
              <div style={{
                position: 'absolute',
                bottom: 0,
                width: '24px',
                height: '2px',
                borderRadius: '1px',
                background: '#ff6b35',
              }} />
            )}
          </button>
        )
      })}
    </nav>
  )
}
