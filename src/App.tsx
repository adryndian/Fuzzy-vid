import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuth } from '@clerk/clerk-react'
import { Home } from './pages/Home'
import { Storyboard } from './pages/Storyboard'
import { History } from './pages/History'
import { Settings } from './pages/Settings'
import { Dashboard } from './pages/Dashboard'
import { Auth } from './pages/Auth'
import { GenTaskBar } from './components/GenTaskBar'

function AppContent() {
  const { isLoaded, isSignedIn } = useAuth()

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
    </BrowserRouter>
  )
}

export function App() {
  return <AppContent />
}
