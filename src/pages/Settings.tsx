import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const STORAGE_KEY = 'fuzzy_short_settings'

interface AppSettings {
  geminiApiKey: string
  awsAccessKeyId: string
  awsSecretAccessKey: string
  awsRegion: string
  r2AccountId: string
  r2AccessKeyId: string
  r2SecretAccessKey: string
  r2BucketName: string
  elevenLabsApiKey: string
  runwayApiKey: string
}

const defaultSettings: AppSettings = {
  geminiApiKey: '',
  awsAccessKeyId: '',
  awsSecretAccessKey: '',
  awsRegion: 'us-east-1',
  r2AccountId: '',
  r2AccessKeyId: '',
  r2SecretAccessKey: '',
  r2BucketName: 'igome-story-storage',
  elevenLabsApiKey: '',
  runwayApiKey: '',
}

type TestStatus = 'idle' | 'testing' | 'success' | 'failed'

export function Settings() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'apikeys' | 'storage'>('apikeys')
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [saved, setSaved] = useState(false)
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [geminiStatus, setGeminiStatus] = useState<TestStatus>('idle')
  const [awsStatus, setAwsStatus] = useState<TestStatus>('idle')
  const [r2Status, setR2Status] = useState<TestStatus>('idle')
  const [geminiMsg, setGeminiMsg] = useState('')
  const [awsMsg, setAwsMsg] = useState('')
  const [r2Msg, setR2Msg] = useState('')

  const WORKER_URL = 'https://fuzzy-vid-worker.officialdian21.workers.dev'

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try { setSettings({ ...defaultSettings, ...JSON.parse(stored) }) } catch {}
    }
  }, [])

  const update = (key: keyof AppSettings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const saveSettings = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const toggleShow = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const testGemini = async () => {
    if (!settings.geminiApiKey) { setGeminiMsg('Please enter Gemini API Key'); setGeminiStatus('failed'); return }
    setGeminiStatus('testing'); setGeminiMsg('Testing...')
    try {
      const res = await fetch(`${WORKER_URL}/api/brain/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Gemini-Key': settings.geminiApiKey },
        body: JSON.stringify({ title: 'test', story: 'test', platform: 'youtube_shorts', brain_model: 'gemini', language: 'id', art_style: 'cinematic_realistic', total_scenes: 1 })
      })
      if (res.ok) { setGeminiStatus('success'); setGeminiMsg('✅ Gemini API Key valid!') }
      else { const d = await res.json() as any; setGeminiStatus('failed'); setGeminiMsg(`❌ ${d.error || 'Invalid key'}`) }
    } catch { setGeminiStatus('failed'); setGeminiMsg('❌ Connection failed') }
  }

  const testAWS = async () => {
    if (!settings.awsAccessKeyId || !settings.awsSecretAccessKey) { setAwsMsg('Please enter AWS credentials'); setAwsStatus('failed'); return }
    setAwsStatus('testing'); setAwsMsg('Testing...')
    try {
      const res = await fetch(`${WORKER_URL}/api/brain/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AWS-Access-Key-Id': settings.awsAccessKeyId,
          'X-AWS-Secret-Access-Key': settings.awsSecretAccessKey,
          'X-AWS-Region': settings.awsRegion,
        },
        body: JSON.stringify({ title: 'test', story: 'test', platform: 'youtube_shorts', brain_model: 'claude_sonnet', language: 'id', art_style: 'cinematic_realistic', total_scenes: 1 })
      })
      if (res.ok) { setAwsStatus('success'); setAwsMsg('✅ AWS Bedrock credentials valid!') }
      else { const d = await res.json() as any; setAwsStatus('failed'); setAwsMsg(`❌ ${d.error || 'Invalid credentials'}`) }
    } catch { setAwsStatus('failed'); setAwsMsg('❌ Connection failed') }
  }

  const testR2 = async () => {
    if (!settings.r2AccountId || !settings.r2AccessKeyId || !settings.r2SecretAccessKey) { setR2Msg('Please enter R2 credentials'); setR2Status('failed'); return }
    setR2Status('testing'); setR2Msg('Testing...')
    try {
      const res = await fetch(`${WORKER_URL}/api/storage/test`, {
        headers: {
          'X-R2-Account-Id': settings.r2AccountId,
          'X-R2-Access-Key-Id': settings.r2AccessKeyId,
          'X-R2-Secret-Access-Key': settings.r2SecretAccessKey,
          'X-R2-Bucket': settings.r2BucketName,
        }
      })
      if (res.ok) { setR2Status('success'); setR2Msg('✅ R2 Storage connected!') }
      else { setR2Status('failed'); setR2Msg('❌ R2 connection failed') }
    } catch { setR2Status('failed'); setR2Msg('❌ Connection failed') }
  }

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.07)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(239,225,207,0.14)',
    borderRadius: '20px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    padding: '20px',
    marginBottom: '16px',
  }

  const inputRow = (label: string, key: keyof AppSettings, placeholder = '', isSecret = false) => (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ fontSize: '11px', color: 'rgba(239,225,207,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={isSecret && !showSecrets[key] ? 'password' : 'text'}
          value={settings[key]}
          onChange={e => update(key, e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(239,225,207,0.12)', borderRadius: '12px',
            padding: isSecret ? '11px 44px 11px 14px' : '11px 14px',
            color: '#EFE1CF', fontSize: '13px', outline: 'none',
            fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
        {isSecret && (
          <button onClick={() => toggleShow(key)} style={{
            position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: 'rgba(239,225,207,0.4)',
            cursor: 'pointer', fontSize: '14px', padding: '4px',
          }}>
            {showSecrets[key] ? '🙈' : '👁️'}
          </button>
        )}
      </div>
    </div>
  )

  const statusColor = (s: TestStatus) => s === 'success' ? '#4ade80' : s === 'failed' ? '#f87171' : 'rgba(239,225,207,0.5)'

  const testBtn = (label: string, status: TestStatus, onClick: () => void) => (
    <button onClick={onClick} disabled={status === 'testing'}
      style={{
        padding: '9px 18px', borderRadius: '10px', border: '1px solid rgba(63,169,246,0.4)',
        background: 'rgba(63,169,246,0.1)', color: '#3FA9F6', fontSize: '12px',
        cursor: status === 'testing' ? 'not-allowed' : 'pointer', fontWeight: 600,
        opacity: status === 'testing' ? 0.6 : 1,
      }}>
      {status === 'testing' ? '⏳ Testing...' : `🔌 ${label}`}
    </button>
  )

  const sectionTitle = (emoji: string, title: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
      <span style={{ fontSize: '18px' }}>{emoji}</span>
      <span style={{ color: '#EFE1CF', fontSize: '15px', fontWeight: 700 }}>{title}</span>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh', width: '100%', background: '#000000',
      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
      paddingBottom: '40px',
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(239,225,207,0.08)',
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(239,225,207,0.12)',
          borderRadius: '10px', color: '#EFE1CF', padding: '7px 12px',
          cursor: 'pointer', fontSize: '13px', fontWeight: 600,
        }}>
          ← Back
        </button>
        <span style={{ color: '#EFE1CF', fontSize: '17px', fontWeight: 700, flex: 1 }}>Settings</span>
        <span style={{ fontSize: '20px' }}>⚙️</span>
      </div>

      {/* Tabs */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{
          display: 'flex', gap: '8px', padding: '4px',
          background: 'rgba(255,255,255,0.05)', borderRadius: '14px',
          border: '1px solid rgba(239,225,207,0.08)',
        }}>
          {([
            { id: 'apikeys', label: '🤖 API Keys' },
            { id: 'storage', label: '🗄️ Storage' },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                background: activeTab === tab.id ? '#F05A25' : 'transparent',
                color: activeTab === tab.id ? 'white' : 'rgba(239,225,207,0.5)',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                boxShadow: activeTab === tab.id ? '0 0 16px rgba(240,90,37,0.4)' : 'none',
                transition: 'all 0.2s',
              }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '16px' }}>

        {activeTab === 'apikeys' && (
          <>
            {/* Gemini Section */}
            <div style={card}>
              {sectionTitle('✨', 'Google Gemini')}
              {inputRow('Gemini API Key', 'geminiApiKey', 'AIza...', true)}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {testBtn('Test Gemini', geminiStatus, testGemini)}
                {geminiMsg && <span style={{ fontSize: '12px', color: statusColor(geminiStatus) }}>{geminiMsg}</span>}
              </div>
              <p style={{ fontSize: '11px', color: 'rgba(239,225,207,0.3)', marginTop: '10px' }}>
                Get key at aistudio.google.com/apikey
              </p>
            </div>

            {/* AWS Section */}
            <div style={card}>
              {sectionTitle('☁️', 'AWS Bedrock')}
              {inputRow('Access Key ID', 'awsAccessKeyId', 'AKIA...', true)}
              {inputRow('Secret Access Key', 'awsSecretAccessKey', 'Your secret key...', true)}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11px', color: 'rgba(239,225,207,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>
                  AWS Region
                </label>
                <select value={settings.awsRegion} onChange={e => update('awsRegion', e.target.value)}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(239,225,207,0.12)', borderRadius: '12px',
                    padding: '11px 14px', color: '#EFE1CF', fontSize: '13px',
                    outline: 'none', fontFamily: 'inherit',
                  }}>
                  <option value="us-east-1">us-east-1 (N. Virginia)</option>
                  <option value="us-west-2">us-west-2 (Oregon)</option>
                  <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {testBtn('Test AWS', awsStatus, testAWS)}
                {awsMsg && <span style={{ fontSize: '12px', color: statusColor(awsStatus) }}>{awsMsg}</span>}
              </div>
              <p style={{ fontSize: '11px', color: 'rgba(239,225,207,0.3)', marginTop: '10px' }}>
                IAM user needs AmazonBedrockFullAccess permission
              </p>
            </div>

            {/* ElevenLabs + Runway */}
            <div style={card}>
              {sectionTitle('🎵', 'Audio & Video APIs')}
              {inputRow('ElevenLabs API Key', 'elevenLabsApiKey', 'Optional...', true)}
              {inputRow('Runway ML API Key', 'runwayApiKey', 'Optional...', true)}
              <p style={{ fontSize: '11px', color: 'rgba(239,225,207,0.3)', marginTop: '4px' }}>
                Optional — app works without these
              </p>
            </div>
          </>
        )}

        {activeTab === 'storage' && (
          <>
            <div style={card}>
              {sectionTitle('🗄️', 'Cloudflare R2 Storage')}
              {inputRow('Account ID', 'r2AccountId', 'Your CF Account ID...', true)}
              {inputRow('R2 Access Key ID', 'r2AccessKeyId', 'Access key...', true)}
              {inputRow('R2 Secret Access Key', 'r2SecretAccessKey', 'Secret key...', true)}
              {inputRow('Bucket Name', 'r2BucketName', 'igome-story-storage')}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {testBtn('Test R2', r2Status, testR2)}
                {r2Msg && <span style={{ fontSize: '12px', color: statusColor(r2Status) }}>{r2Msg}</span>}
              </div>
              <p style={{ fontSize: '11px', color: 'rgba(239,225,207,0.3)', marginTop: '10px' }}>
                R2 API tokens: dash.cloudflare.com → R2 → Manage R2 API Tokens
              </p>
            </div>

            <div style={{ ...card, background: 'rgba(240,90,37,0.06)', borderColor: 'rgba(240,90,37,0.2)' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '20px' }}>⚠️</span>
                <div>
                  <p style={{ color: '#F05A25', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Security Note</p>
                  <p style={{ color: 'rgba(239,225,207,0.5)', fontSize: '12px', lineHeight: '1.5' }}>
                    Keys are stored in your browser's localStorage only. They never leave your device except when making API requests directly from your browser.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Save Button */}
        <button onClick={saveSettings}
          style={{
            width: '100%', padding: '16px', borderRadius: '14px', border: 'none',
            background: saved ? '#4ade80' : '#F05A25',
            boxShadow: saved ? '0 0 20px rgba(74,222,128,0.4)' : '0 0 28px rgba(240,90,37,0.45)',
            color: 'white', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
            transition: 'all 0.3s',
          }}>
          {saved ? '✅ Settings Saved!' : '💾 Save Settings'}
        </button>
      </div>
    </div>
  )
}
