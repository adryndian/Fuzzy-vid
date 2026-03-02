import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AppSettings } from '../types/schema'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../types/schema'

type TestStatus = 'idle' | 'testing' | 'success' | 'failed'

const WORKER_URL = 'https://fuzzy-vid-worker.officialdian21.workers.dev'

const REGIONS = [
  { value: 'us-east-1', label: 'us-east-1 (N. Virginia)' },
  { value: 'us-west-2', label: 'us-west-2 (Oregon)' },
  { value: 'ap-southeast-1', label: 'ap-southeast-1 (Singapore)' },
]

export function Settings() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [geminiStatus, setGeminiStatus] = useState<TestStatus>('idle')
  const [awsStatus, setAwsStatus] = useState<TestStatus>('idle')
  const [geminiMsg, setGeminiMsg] = useState('')
  const [awsMsg, setAwsMsg] = useState('')

  useEffect(() => { setSettings(loadSettings()) }, [])

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = () => {
    saveSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const toggleShow = (key: string) =>
    setShowKey(prev => ({ ...prev, [key]: !prev[key] }))

  // ─── Styles ───────────────────────────────────────────────
  const s = {
    page: {
      minHeight: '100vh',
      width: '100%',
      background: 'linear-gradient(145deg, #f2f2f7 0%, #e5e5ea 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
      paddingBottom: '40px',
    } as React.CSSProperties,

    header: {
      position: 'sticky' as const,
      top: 0,
      zIndex: 100,
      background: 'rgba(242,242,247,0.85)',
      backdropFilter: 'blur(30px)',
      WebkitBackdropFilter: 'blur(30px)',
      borderBottom: '0.5px solid rgba(0,0,0,0.1)',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    } as React.CSSProperties,

    backBtn: {
      background: 'rgba(255,255,255,0.85)',
      border: '0.5px solid rgba(0,0,0,0.12)',
      borderRadius: '12px',
      color: '#007aff',
      padding: '8px 14px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    } as React.CSSProperties,

    card: {
      background: 'rgba(255,255,255,0.75)',
      backdropFilter: 'blur(30px)',
      WebkitBackdropFilter: 'blur(30px)',
      border: '0.5px solid rgba(255,255,255,0.9)',
      borderRadius: '20px',
      boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
      padding: '20px',
      marginBottom: '14px',
      position: 'relative' as const,
      overflow: 'hidden' as const,
    } as React.CSSProperties,

    label: {
      fontSize: '11px',
      color: 'rgba(60,60,67,0.6)',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.06em',
      display: 'block',
      marginBottom: '6px',
      fontWeight: 600,
    } as React.CSSProperties,

    input: {
      width: '100%',
      background: 'rgba(118,118,128,0.1)',
      border: '1px solid transparent',
      borderRadius: '12px',
      padding: '11px 14px',
      color: '#1d1d1f',
      fontSize: '13px',
      outline: 'none',
      fontFamily: 'inherit',
      boxSizing: 'border-box' as const,
      transition: 'border-color 0.2s',
    } as React.CSSProperties,

    select: {
      width: '100%',
      background: 'rgba(118,118,128,0.1)',
      border: '1px solid transparent',
      borderRadius: '12px',
      padding: '11px 14px',
      color: '#1d1d1f',
      fontSize: '13px',
      outline: 'none',
      fontFamily: 'inherit',
      boxSizing: 'border-box' as const,
      cursor: 'pointer',
    } as React.CSSProperties,

    sectionTitle: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '18px',
    } as React.CSSProperties,
  }

  // ─── Reusable Components ───────────────────────────────────
  const SecretInput = ({
    label, fieldKey, placeholder,
  }: { label: string; fieldKey: keyof AppSettings; placeholder?: string }) => (
    <div style={{ marginBottom: '14px' }}>
      <label style={s.label}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={showKey[fieldKey] ? 'text' : 'password'}
          value={settings[fieldKey] as string}
          onChange={e => update(fieldKey, e.target.value as AppSettings[typeof fieldKey])}
          placeholder={placeholder || ''}
          style={{ ...s.input, paddingRight: '44px' }}
        />
        <button
          onClick={() => toggleShow(fieldKey)}
          style={{
            position: 'absolute', right: '12px', top: '50%',
            transform: 'translateY(-50%)', background: 'none',
            border: 'none', color: 'rgba(60,60,67,0.4)',
            cursor: 'pointer', fontSize: '15px', padding: '2px',
          }}>
          {showKey[fieldKey] ? '🙈' : '👁️'}
        </button>
      </div>
    </div>
  )

  const RegionSelect = ({
    label, fieldKey, locked = false,
  }: { label: string; fieldKey: keyof AppSettings; locked?: boolean }) => (
    <div style={{ marginBottom: '14px' }}>
      <label style={s.label}>
        {label} {locked && (
          <span style={{ color: '#ff6b35', marginLeft: '4px' }}>🔒 FIXED</span>
        )}
      </label>
      <select
        value={settings[fieldKey] as string}
        onChange={e => !locked && update(fieldKey, e.target.value as AppSettings[typeof fieldKey])}
        disabled={locked}
        style={{
          ...s.select,
          opacity: locked ? 0.5 : 1,
          cursor: locked ? 'not-allowed' : 'pointer',
        }}>
        {locked
          ? <option value="us-east-1">us-east-1 (N. Virginia) — Required for Nova Reel</option>
          : REGIONS.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))
        }
      </select>
    </div>
  )

  const StatusMsg = ({ status, msg }: { status: TestStatus; msg: string }) => {
    if (!msg) return null
    const color = status === 'success' ? '#34c759' : status === 'failed' ? '#ff3b30' : 'rgba(60,60,67,0.5)'
    return (
      <span style={{ fontSize: '12px', color, fontWeight: 500 }}>{msg}</span>
    )
  }

  const TestButton = ({
    label, status, onClick,
  }: { label: string; status: TestStatus; onClick: () => void }) => (
    <button
      onClick={onClick}
      disabled={status === 'testing'}
      style={{
        padding: '9px 16px', borderRadius: '12px',
        border: '0.5px solid rgba(0,122,255,0.25)',
        background: status === 'success'
          ? 'rgba(52,199,89,0.12)'
          : status === 'failed'
          ? 'rgba(255,59,48,0.08)'
          : 'rgba(0,122,255,0.1)',
        color: status === 'success' ? '#34c759'
          : status === 'failed' ? '#ff3b30'
          : '#007aff',
        fontSize: '12px', cursor: status === 'testing' ? 'not-allowed' : 'pointer',
        fontWeight: 600, opacity: status === 'testing' ? 0.6 : 1,
        transition: 'all 0.2s',
      }}>
      {status === 'testing' ? '⏳ Testing...' : `🔌 ${label}`}
    </button>
  )

  // ─── Test Functions ────────────────────────────────────────
  const testGemini = async () => {
    if (!settings.geminiApiKey) {
      setGeminiStatus('failed')
      setGeminiMsg('❌ Please enter Gemini API Key')
      return
    }
    setGeminiStatus('testing')
    setGeminiMsg('Testing connection...')
    try {
      const res = await fetch(`${WORKER_URL}/api/brain/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gemini-Key': settings.geminiApiKey,
          'X-Brain-Region': settings.brainRegion,
        },
        body: JSON.stringify({
          title: 'Connection Test',
          story: 'Short test story',
          platform: 'youtube_shorts',
          brain_model: 'gemini',
          language: 'id',
          art_style: 'cinematic_realistic',
          total_scenes: 1,
        }),
      })
      const data = await res.json() as Record<string, unknown>
      if (res.ok) {
        setGeminiStatus('success')
        setGeminiMsg('✅ Gemini API Key valid!')
      } else {
        setGeminiStatus('failed')
        setGeminiMsg(`❌ ${(data.error as string) || `HTTP ${res.status}`}`)
      }
    } catch {
      setGeminiStatus('failed')
      setGeminiMsg('❌ Network error — check Worker deployment')
    }
  }

  const testAWS = async () => {
    if (!settings.awsAccessKeyId || !settings.awsSecretAccessKey) {
      setAwsStatus('failed')
      setAwsMsg('❌ Please enter AWS Access Key ID and Secret')
      return
    }
    setAwsStatus('testing')
    setAwsMsg('Testing AWS Bedrock connection...')
    try {
      const res = await fetch(`${WORKER_URL}/api/brain/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AWS-Access-Key-Id': settings.awsAccessKeyId,
          'X-AWS-Secret-Access-Key': settings.awsSecretAccessKey,
          'X-Brain-Region': settings.brainRegion,
        },
        body: JSON.stringify({
          title: 'Connection Test',
          story: 'Short test story',
          platform: 'youtube_shorts',
          brain_model: 'claude_sonnet',
          language: 'id',
          art_style: 'cinematic_realistic',
          total_scenes: 1,
        }),
      })
      const data = await res.json() as Record<string, unknown>
      if (res.ok) {
        setAwsStatus('success')
        setAwsMsg('✅ AWS Bedrock credentials valid!')
      } else {
        setAwsStatus('failed')
        setAwsMsg(`❌ ${(data.error as string) || `HTTP ${res.status}`}`)
      }
    } catch {
      setAwsStatus('failed')
      setAwsMsg('❌ Network error — check Worker deployment')
    }
  }

  // ─── Render ────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <style>{`select option { background: #f2f2f7; color: #1d1d1f; }`}</style>

      {/* Sticky Header */}
      <div style={s.header}>
        <button onClick={() => navigate(-1)} style={s.backBtn}>
          ← Back
        </button>
        <span style={{ color: '#1d1d1f', fontSize: '17px', fontWeight: 700, flex: 1 }}>
          Settings
        </span>
        <span style={{ fontSize: '22px' }}>⚙️</span>
      </div>

      <div style={{ padding: '20px 16px 0' }}>

        {/* ── Google Gemini ── */}
        <div style={s.card}>
          <div style={s.sectionTitle}>
            <span style={{ fontSize: '20px' }}>✨</span>
            <span style={{ color: '#1d1d1f', fontSize: '15px', fontWeight: 700 }}>Google Gemini</span>
          </div>

          <SecretInput
            label="Gemini API Key"
            fieldKey="geminiApiKey"
            placeholder="AIzaSy..."
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <TestButton label="Test Gemini" status={geminiStatus} onClick={testGemini} />
            <StatusMsg status={geminiStatus} msg={geminiMsg} />
          </div>

          <p style={{ fontSize: '11px', color: 'rgba(60,60,67,0.4)', margin: 0 }}>
            Get key → aistudio.google.com/apikey
          </p>
        </div>

        {/* ── AWS Bedrock ── */}
        <div style={s.card}>
          <div style={s.sectionTitle}>
            <span style={{ fontSize: '20px' }}>☁️</span>
            <span style={{ color: '#1d1d1f', fontSize: '15px', fontWeight: 700 }}>AWS Bedrock</span>
          </div>

          <SecretInput
            label="Access Key ID"
            fieldKey="awsAccessKeyId"
            placeholder="AKIA..."
          />
          <SecretInput
            label="Secret Access Key"
            fieldKey="awsSecretAccessKey"
            placeholder="Your secret key..."
          />

          {/* Region per service */}
          <div style={{
            background: 'rgba(118,118,128,0.08)',
            border: '0.5px solid rgba(0,0,0,0.06)',
            borderRadius: '14px',
            padding: '14px',
            marginBottom: '14px',
          }}>
            <p style={{ fontSize: '11px', color: 'rgba(60,60,67,0.5)', marginBottom: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Region per Service
            </p>
            <RegionSelect label="🧠 Brain Region" fieldKey="brainRegion" />
            <RegionSelect label="🖼️ Image Region" fieldKey="imageRegion" />
            <RegionSelect label="🎵 Audio Region" fieldKey="audioRegion" />
            <RegionSelect label="🎬 Video Region" fieldKey="videoRegion" locked={true} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <TestButton label="Test AWS" status={awsStatus} onClick={testAWS} />
            <StatusMsg status={awsStatus} msg={awsMsg} />
          </div>

          <p style={{ fontSize: '11px', color: 'rgba(60,60,67,0.4)', margin: 0 }}>
            IAM user needs AmazonBedrockFullAccess permission
          </p>
        </div>

        {/* ── Optional APIs ── */}
        <div style={s.card}>
          <div style={s.sectionTitle}>
            <span style={{ fontSize: '20px' }}>🎬</span>
            <span style={{ color: '#1d1d1f', fontSize: '15px', fontWeight: 700 }}>Optional APIs</span>
          </div>

          <SecretInput
            label="ElevenLabs API Key (Audio)"
            fieldKey="elevenLabsApiKey"
            placeholder="Optional — uses AWS Polly if empty"
          />
          <SecretInput
            label="Runway ML API Key (Video)"
            fieldKey="runwayApiKey"
            placeholder="Optional — uses Nova Reel if empty"
          />

          <p style={{ fontSize: '11px', color: 'rgba(60,60,67,0.4)', marginTop: '4px', margin: 0 }}>
            App works without these — AWS services used as fallback
          </p>
        </div>

        {/* ── Security Note ── */}
        <div style={{
          ...s.card,
          background: 'rgba(0,122,255,0.06)',
          border: '0.5px solid rgba(0,122,255,0.2)',
        }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>🔐</span>
            <div>
              <p style={{ color: '#007aff', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                Security Note
              </p>
              <p style={{ color: 'rgba(60,60,67,0.5)', fontSize: '12px', lineHeight: '1.6', margin: 0 }}>
                Keys are stored only in your browser's localStorage. They are sent directly from your browser to the API — never stored on any server.
              </p>
            </div>
          </div>
        </div>

        {/* ── Save Button ── */}
        <button
          onClick={handleSave}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '16px',
            border: 'none',
            background: saved
              ? 'linear-gradient(135deg, #34c759, #28a745)'
              : 'linear-gradient(135deg, #ff6b35, #ff4500)',
            boxShadow: saved
              ? '0 4px 16px rgba(52,199,89,0.4)'
              : '0 4px 16px rgba(255,107,53,0.4)',
            color: 'white',
            fontSize: '15px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.3s',
            letterSpacing: '0.01em',
          }}>
          {saved ? '✅ Settings Saved!' : '💾 Save Settings'}
        </button>

      </div>
    </div>
  )
}
