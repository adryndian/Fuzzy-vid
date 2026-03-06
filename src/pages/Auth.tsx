import { useState } from 'react'
import { SignIn, SignUp } from '@clerk/clerk-react'

export function Auth() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: 'linear-gradient(145deg, #f2f2f7 0%, #e5e5ea 50%, #f2f2f7 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎬</div>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 800,
          color: '#1d1d1f',
          margin: '0 0 6px',
          letterSpacing: '-0.02em',
        }}>
          Fuzzy Short
        </h1>
        <p style={{
          fontSize: '14px',
          color: 'rgba(60,60,67,0.6)',
          margin: 0,
        }}>
          AI-powered video storyboard generator
        </p>
      </div>

      {/* Clerk component */}
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {mode === 'sign-in' ? (
          <SignIn
            appearance={{
              variables: { colorPrimary: '#ff6b35' },
              elements: {
                rootBox: { width: '100%' },
                card: {
                  background: 'rgba(255,255,255,0.85)',
                  backdropFilter: 'blur(40px)',
                  border: '0.5px solid rgba(255,255,255,0.9)',
                  borderRadius: '22px',
                  boxShadow: '0 2px 24px rgba(0,0,0,0.07)',
                },
              },
            }}
            routing="hash"
          />
        ) : (
          <SignUp
            appearance={{
              variables: { colorPrimary: '#ff6b35' },
              elements: {
                rootBox: { width: '100%' },
                card: {
                  background: 'rgba(255,255,255,0.85)',
                  backdropFilter: 'blur(40px)',
                  border: '0.5px solid rgba(255,255,255,0.9)',
                  borderRadius: '22px',
                  boxShadow: '0 2px 24px rgba(0,0,0,0.07)',
                },
              },
            }}
            routing="hash"
          />
        )}
      </div>

      {/* Toggle */}
      <p style={{
        marginTop: '20px',
        fontSize: '14px',
        color: 'rgba(60,60,67,0.6)',
        textAlign: 'center',
      }}>
        {mode === 'sign-in' ? "Don't have an account? " : 'Already have an account? '}
        <button
          onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
          style={{
            background: 'none',
            border: 'none',
            color: '#ff6b35',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '14px',
            padding: 0,
          }}>
          {mode === 'sign-in' ? 'Sign up' : 'Sign in'}
        </button>
      </p>
    </div>
  )
}
