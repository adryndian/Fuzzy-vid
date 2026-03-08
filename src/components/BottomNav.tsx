import { useState } from 'react'
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
  const [queueOpen, setQueueOpen] = useState(false)

  const tasks = useGenTaskStore(s => s.tasks)
  const removeTask = useGenTaskStore(s => s.removeTask)
  const sessions = useStoryboardSessionStore(s => s.sessions)
  const updateSession = useStoryboardSessionStore(s => s.updateSession)
  const removeSession = useStoryboardSessionStore(s => s.removeSession)

  const runningTasks = tasks.filter(t => t.status === 'running').length
  const minimizedSessions = Object.values(sessions).filter(s => s.isMinimized)
  const totalIndicator = runningTasks + minimizedSessions.length
  const hasTasks = tasks.length > 0 || minimizedSessions.length > 0

  if (pathname === '/auth') return null

  return (
    <>
      {/* Queue popup */}
      {queueOpen && hasTasks && (
        <div
          onClick={() => setQueueOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 198,
          }}
        />
      )}
      {queueOpen && hasTasks && (
        <div style={{
          position: 'fixed',
          bottom: '70px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 199,
          background: isDark ? 'rgba(18,18,22,0.97)' : 'rgba(250,250,252,0.97)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: isDark ? '0.5px solid rgba(255,255,255,0.12)' : '0.5px solid rgba(0,0,0,0.1)',
          borderRadius: '18px',
          padding: '10px 12px',
          minWidth: '280px',
          maxWidth: '340px',
          width: 'calc(100vw - 32px)',
          boxShadow: isDark ? '0 -4px 32px rgba(0,0,0,0.6)' : '0 -4px 24px rgba(0,0,0,0.12)',
          fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '8px',
          }}>
            <span style={{ color: t.textSecondary, fontSize: '11px', fontWeight: 600, letterSpacing: '0.03em' }}>
              QUEUE
            </span>
            <button
              onClick={() => setQueueOpen(false)}
              style={{
                background: 'none', border: 'none',
                color: t.textTertiary, cursor: 'pointer',
                fontSize: '14px', padding: '0 2px', lineHeight: 1,
              }}
            >✕</button>
          </div>

          {/* Minimized storyboard sessions */}
          {minimizedSessions.map((session) => (
            <div key={session.id} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'rgba(63,169,246,0.1)',
              border: '0.5px solid rgba(63,169,246,0.3)',
              borderRadius: '12px', padding: '7px 10px',
              marginBottom: '6px',
            }}>
              <span style={{ fontSize: '12px' }}>📋</span>
              <span style={{
                color: '#3FA9F6', flex: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontSize: '13px',
              }}>{session.title}</span>
              <button
                onClick={() => {
                  updateSession(session.id, { isMinimized: false })
                  navigate(`/storyboard?id=${session.id}`)
                  setQueueOpen(false)
                }}
                style={{
                  background: 'rgba(63,169,246,0.15)',
                  border: '0.5px solid rgba(63,169,246,0.4)',
                  borderRadius: '8px', color: '#3FA9F6',
                  fontSize: '11px', fontWeight: 600,
                  padding: '3px 8px', cursor: 'pointer',
                }}
              >Resume</button>
              <button
                onClick={() => removeSession(session.id)}
                style={{
                  background: 'none', border: 'none',
                  color: t.textTertiary, cursor: 'pointer',
                  fontSize: '14px', padding: '0', lineHeight: 1,
                }}
              >✕</button>
            </div>
          ))}

          {/* Brain generation tasks */}
          {tasks.map((task) => (
            <div key={task.id} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: task.status === 'running'
                ? 'rgba(240,90,37,0.1)'
                : task.status === 'done'
                  ? 'rgba(52,199,89,0.1)'
                  : 'rgba(255,59,48,0.1)',
              border: `0.5px solid ${task.status === 'running' ? 'rgba(240,90,37,0.3)' : task.status === 'done' ? 'rgba(52,199,89,0.3)' : 'rgba(255,59,48,0.3)'}`,
              borderRadius: '12px', padding: '7px 10px',
              marginBottom: '6px',
            }}>
              {task.status === 'running' && (
                <span style={{ fontSize: '13px', display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
              )}
              {task.status === 'done' && <span style={{ color: '#34c759', fontSize: '13px' }}>✓</span>}
              {task.status === 'error' && <span style={{ color: '#ff3b30', fontSize: '13px' }}>✗</span>}
              <span style={{
                color: task.status === 'running' ? '#ff6b35' : task.status === 'done' ? '#34c759' : '#ff3b30',
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontSize: '13px',
              }}>{task.title}</span>
              {task.status === 'done' && (task.sessionId || task.resultJson) && (
                <button
                  onClick={() => {
                    if (task.sessionId) {
                      navigate(`/storyboard?id=${task.sessionId}`)
                    } else if (task.resultJson) {
                      sessionStorage.setItem('storyboard_result', task.resultJson)
                      navigate('/storyboard')
                    }
                    setQueueOpen(false)
                  }}
                  style={{
                    background: 'rgba(52,199,89,0.15)',
                    border: '0.5px solid rgba(52,199,89,0.4)',
                    borderRadius: '8px', color: '#34c759',
                    fontSize: '11px', fontWeight: 600,
                    padding: '3px 8px', cursor: 'pointer',
                  }}
                >View</button>
              )}
              <button
                onClick={() => removeTask(task.id)}
                style={{
                  background: 'none', border: 'none',
                  color: t.textTertiary, cursor: 'pointer',
                  fontSize: '14px', padding: '0', lineHeight: 1,
                }}
              >✕</button>
            </div>
          ))}
        </div>
      )}

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
            </button>
          )
        })}

        {/* Queue button */}
        <button
          onClick={() => hasTasks && setQueueOpen(o => !o)}
          style={{
            flex: 1,
            padding: '10px 0 7px',
            background: 'none',
            border: 'none',
            cursor: hasTasks ? 'pointer' : 'default',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            position: 'relative',
            WebkitTapHighlightColor: 'transparent',
            opacity: hasTasks ? 1 : 0.4,
          }}
        >
          <span style={{ fontSize: '21px', lineHeight: 1 }}>
            {runningTasks > 0 ? '⏳' : '📥'}
          </span>
          <span style={{
            fontSize: '10px',
            fontWeight: queueOpen ? 700 : 400,
            color: queueOpen ? '#ff6b35' : t.textSecondary,
            letterSpacing: '-0.01em',
          }}>
            Queue
          </span>
          {totalIndicator > 0 && (
            <span style={{
              position: 'absolute',
              top: '6px', right: '8px',
              background: runningTasks > 0 ? '#ff6b35' : '#34c759',
              color: 'white',
              fontSize: '9px',
              fontWeight: 800,
              minWidth: '16px', height: '16px',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 3px',
              boxShadow: `0 1px 4px ${runningTasks > 0 ? 'rgba(255,107,53,0.5)' : 'rgba(52,199,89,0.5)'}`,
            }}>
              {totalIndicator > 9 ? '9+' : totalIndicator}
            </span>
          )}
          {queueOpen && (
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
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={toggle}
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
          <span style={{ fontSize: '19px', lineHeight: 1 }}>{isDark ? '☀️' : '🌙'}</span>
          <span style={{ fontSize: '10px', color: t.textSecondary, letterSpacing: '-0.01em' }}>
            {isDark ? 'Light' : 'Dark'}
          </span>
        </button>
      </nav>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
