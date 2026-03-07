import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuth, useUser } from '@clerk/clerk-react'
import { useEffect, useRef } from 'react'
import { Home } from './pages/Home'
import { Storyboard } from './pages/Storyboard'
import { History } from './pages/History'
import { Settings } from './pages/Settings'
import { Dashboard } from './pages/Dashboard'
import { Auth } from './pages/Auth'
import { GenTaskBar } from './components/GenTaskBar'
import { BottomNav } from './components/BottomNav'

function clearSessionData() {
  sessionStorage.removeItem('storyboard_result')
  sessionStorage.removeItem('selected_image_model')
  sessionStorage.removeItem('selected_video_model')
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && (
      key.startsWith('video_job_') ||
      key === 'fuzzy_storyboard_sessions'
    )) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k))
}

function AppContent() {
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const prevUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    const currentUserId = user?.id || null
    // User switched accounts or signed out
    if (prevUserIdRef.current !== null && prevUserIdRef.current !== currentUserId) {
      clearSessionData()
    }
    if (!isSignedIn) {
      clearSessionData()
    }
    prevUserIdRef.current = currentUserId
  }, [isLoaded, isSignedIn, user?.id])

  if (!isLoaded) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(145deg, #f2f2f7 0%, #e5e5ea 100%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎬</div>
          <p style={{ color: 'rgba(60,60,67,0.5)', fontSize: '14px' }}>Loading...</p>
        </div>
      </div>
    )
  }

  if (!isSignedIn) {
    return <Auth />
  }

  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'rgba(15,20,35,0.92)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#EFE1CF',
            borderRadius: '14px',
            fontSize: '13px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/storyboard" element={<Storyboard />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/auth" element={<Auth />} />
      </Routes>
      <GenTaskBar />
      <BottomNav />
    </BrowserRouter>
  )
}

export function App() {
  return <AppContent />
}
