import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGenTaskStore } from '../store/genTaskStore'
import { useStoryboardSessionStore } from '../store/storyboardSessionStore'

export function GenTaskBar() {
  const tasks = useGenTaskStore((s) => s.tasks)
  const removeTask = useGenTaskStore((s) => s.removeTask)
  const sessions = useStoryboardSessionStore((s) => s.sessions)
  const updateSession = useStoryboardSessionStore((s) => s.updateSession)
  const removeSession = useStoryboardSessionStore((s) => s.removeSession)
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const minimizedSessions = Object.values(sessions).filter((s) => s.isMinimized)
  const hasTasks = tasks.length > 0
  const hasMinimized = minimizedSessions.length > 0

  if (!hasTasks && !hasMinimized) return null

  const runningCount = tasks.filter((t) => t.status === 'running').length
  const totalCount = tasks.length + minimizedSessions.length

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 200,
          background: 'rgba(15,20,35,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(240,90,37,0.4)',
          borderRadius: '50px',
          padding: '10px 16px',
          color: '#EFE1CF',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}
      >
        🎬
        {(runningCount > 0 || hasMinimized) && (
          <span style={{
            background: hasMinimized ? '#3FA9F6' : '#F05A25',
            color: 'white',
            fontSize: '10px',
            fontWeight: 800,
            padding: '1px 6px',
            borderRadius: '10px',
          }}>
            {runningCount + minimizedSessions.length}
          </span>
        )}
        <span>{totalCount} item{totalCount !== 1 ? 's' : ''}</span>
      </button>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 200,
      background: 'rgba(10,15,30,0.95)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      padding: '8px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      overflowX: 'auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
    }}>
      <span style={{ color: 'rgba(239,225,207,0.4)', fontSize: '11px', flexShrink: 0 }}>Queue:</span>

      {/* Minimized storyboard sessions */}
      {minimizedSessions.map((session) => (
        <div key={session.id} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(63,169,246,0.1)',
          border: '1px solid rgba(63,169,246,0.3)',
          borderRadius: '20px',
          padding: '4px 10px',
          flexShrink: 0,
          fontSize: '12px',
        }}>
          <span style={{ fontSize: '11px' }}>📋</span>
          <span style={{
            color: '#3FA9F6',
            maxWidth: '110px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {session.title}
          </span>
          <button
            onClick={() => {
              updateSession(session.id, { isMinimized: false })
              navigate(`/storyboard?id=${session.id}`)
            }}
            style={{
              background: 'rgba(63,169,246,0.15)',
              border: '1px solid rgba(63,169,246,0.4)',
              borderRadius: '10px',
              color: '#3FA9F6',
              fontSize: '10px',
              fontWeight: 600,
              padding: '2px 7px',
              cursor: 'pointer',
            }}
          >
            Resume
          </button>
          <button
            onClick={() => removeSession(session.id)}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(239,225,207,0.35)',
              cursor: 'pointer',
              fontSize: '13px',
              padding: '0 2px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      ))}

      {/* Brain generation tasks */}
      {tasks.map((task) => (
        <div key={task.id} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: task.status === 'running'
            ? 'rgba(240,90,37,0.12)'
            : task.status === 'done'
              ? 'rgba(74,222,128,0.1)'
              : 'rgba(248,113,113,0.1)',
          border: `1px solid ${task.status === 'running' ? 'rgba(240,90,37,0.3)' : task.status === 'done' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
          borderRadius: '20px',
          padding: '4px 10px',
          flexShrink: 0,
          fontSize: '12px',
        }}>
          {task.status === 'running' && (
            <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block', fontSize: '11px' }}>⟳</span>
          )}
          {task.status === 'done' && <span style={{ color: '#4ade80', fontSize: '11px' }}>✓</span>}
          {task.status === 'error' && <span style={{ color: '#f87171', fontSize: '11px' }}>✗</span>}
          <span style={{
            color: task.status === 'running' ? '#F05A25' : task.status === 'done' ? '#4ade80' : '#f87171',
            maxWidth: '120px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {task.title}
          </span>
          {task.status === 'done' && (task.sessionId || task.resultJson) && (
            <button
              onClick={() => {
                if (task.sessionId) {
                  navigate(`/storyboard?id=${task.sessionId}`)
                } else if (task.resultJson) {
                  sessionStorage.setItem('storyboard_result', task.resultJson)
                  navigate('/storyboard')
                }
              }}
              style={{
                background: 'rgba(74,222,128,0.15)',
                border: '1px solid rgba(74,222,128,0.4)',
                borderRadius: '10px',
                color: '#4ade80',
                fontSize: '10px',
                fontWeight: 600,
                padding: '2px 7px',
                cursor: 'pointer',
              }}
            >
              View
            </button>
          )}
          <button
            onClick={() => removeTask(task.id)}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(239,225,207,0.35)',
              cursor: 'pointer',
              fontSize: '13px',
              padding: '0 2px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      ))}

      <button
        onClick={() => setCollapsed(true)}
        style={{
          marginLeft: 'auto',
          background: 'none',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          color: 'rgba(239,225,207,0.35)',
          fontSize: '11px',
          padding: '3px 8px',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        ⬇
      </button>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
