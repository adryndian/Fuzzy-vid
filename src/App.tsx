import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { Home } from './pages/Home'
import { Storyboard } from './pages/Storyboard'
import { History } from './pages/History'
import { Settings } from './pages/Settings'

export function App() {
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
      </Routes>
    </BrowserRouter>
  )
}
