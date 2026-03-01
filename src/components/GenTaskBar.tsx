import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGenTaskStore } from '../store/genTaskStore'

export function GenTaskBar() {
  const tasks = useGenTaskStore((s) => s.tasks)
  const removeTask = useGenTaskStore((s) => s.removeTask)
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  if (tasks.length === 0) return null

  const runningCount = tasks.filter((t) => t.status === 'running').length

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
        {runningCount > 0 && (
          <span style={{
            background: '#F05A25',
            color: 'white',
            fontSize: '10px',
            fontWeight: 800,
            padding: '1px 6px',
            borderRadius: '10px',
          }}>
            {runningCount}
          </span>
        )}
        <span>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
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
      <span style={{ color: 'rgba(239,225,207,0.4)', fontSize: '11px', flexShrink: 0 }}>Tasks:</span>

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
          {task.status === 'done' && task.resultJson && (
            <button
              onClick={() => {
                sessionStorage.setItem('storyboard_result', task.resultJson!)
                navigate('/storyboard')
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
