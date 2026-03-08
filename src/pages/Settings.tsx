import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser, UserButton } from '@clerk/clerk-react'
import type { AppSettings } from '../types/schema'
import { DEFAULT_SETTINGS } from '../types/schema'
import { useUserApi } from '../lib/userApi'
import { WORKER_URL } from '../lib/api'
import { useTheme, tk } from '../lib/theme'

type TestStatus = 'idle' | 'testing' | 'success' | 'failed'

const REGIONS = [
  { value: 'us-east-1', label: 'us-east-1 (N. Virginia)' },
  { value: 'us-west-2', label: 'us-west-2 (Oregon)' },
  { value: 'ap-southeast-1', label: 'ap-southeast-1 (Singapore)' },
]

export function Settings() {
  const navigate = useNavigate()
  const { isDark, toggle: toggleDark } = useTheme()
  const thm = tk(isDark)
  const { user } = useUser()
  const { saveApiKeys, getApiKeys, updatePreferences } = useUserApi()
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [geminiStatus, setGeminiStatus] = useState<TestStatus>('idle')
  const [awsStatus, setAwsStatus] = useState<TestStatus>('idle')
  const [groqStatus, setGroqStatus] = useState<TestStatus>('idle')
  const [openrouterStatus, setOpenrouterStatus] = useState<TestStatus>('idle')
  const [glmStatus, setGlmStatus] = useState<TestStatus>('idle')
  const [cerebrasStatus, setCerebrasStatus] = useState<TestStatus>('idle')
  const [mistralStatus, setMistralStatus] = useState<TestStatus>('idle')
  const [siliconflowStatus, setSiliconflowStatus] = useState<TestStatus>('idle')
  const [geminiMsg, setGeminiMsg] = useState('')
  const [awsMsg, setAwsMsg] = useState('')
  const [groqMsg, setGroqMsg] = useState('')
  const [openrouterMsg, setOpenrouterMsg] = useState('')
  const [glmMsg, setGlmMsg] = useState('')
  const [cerebrasMsg, setCerebrasMsg] = useState('')
  const [mistralMsg, setMistralMsg] = useState('')
  const [siliconflowMsg, setSiliconflowMsg] = useState('')

  useEffect(() => {
    if (!user?.id) return

    const storageKey = `fuzzy_settings_${user.id}`

    // One-time migration: remove old shared localStorage key
    if (localStorage.getItem('fuzzy_short_settings') &&
        !localStorage.getItem(`migrated_${user.id}`)) {
      localStorage.removeItem('fuzzy_short_settings')
      localStorage.setItem(`migrated_${user.id}`, '1')
    }

    // Load from D1 first, fallback to user-specific localStorage
    getApiKeys()
      .then((keys: Record<string, string>) => {
        if (keys && Object.keys(keys).length > 0) {
          setSettings(prev => {
            const merged = {
              ...prev,
              awsAccessKeyId:     keys.aws_access_key_id     || prev.awsAccessKeyId,
              awsSecretAccessKey: keys.aws_secret_access_key || prev.awsSecretAccessKey,
              dashscopeApiKey:    keys.dashscope_api_key     || prev.dashscopeApiKey,
              elevenLabsApiKey:   keys.elevenlabs_api_key    || prev.elevenLabsApiKey,
              geminiApiKey:       keys.gemini_api_key        || prev.geminiApiKey,
              groqApiKey:         keys.groq_api_key          || prev.groqApiKey,
              openrouterApiKey:   keys.openrouter_api_key    || prev.openrouterApiKey,
              glmApiKey:          keys.glm_api_key           || prev.glmApiKey,
              cerebrasApiKey:     keys.cerebras_api_key      || prev.cerebrasApiKey,
              mistralApiKey:      keys.mistral_api_key       || prev.mistralApiKey,
              siliconflowApiKey:  keys.siliconflow_api_key   || prev.siliconflowApiKey,
            }
            localStorage.setItem(storageKey, JSON.stringify(merged))
            return merged
          })
        } else {
          const saved = localStorage.getItem(storageKey)
          if (saved) {
            try { setSettings(JSON.parse(saved)) }
            catch { localStorage.removeItem(storageKey) }
          }
        }
      })
      .catch(() => {
        const saved = localStorage.getItem(storageKey)
        if (saved) {
          try { setSettings(JSON.parse(saved)) }
          catch { localStorage.removeItem(storageKey) }
        }
      })
  }, [user?.id])

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    if (!user?.id) return
    const storageKey = `fuzzy_settings_${user.id}`
    try {
      await saveApiKeys({
        aws_access_key_id: settings.awsAccessKeyId || '',
        aws_secret_access_key: settings.awsSecretAccessKey || '',
        dashscope_api_key: settings.dashscopeApiKey || '',
        elevenlabs_api_key: settings.elevenLabsApiKey || '',
        gemini_api_key: settings.geminiApiKey || '',
        groq_api_key: settings.groqApiKey || '',
        openrouter_api_key: settings.openrouterApiKey || '',
        glm_api_key: settings.glmApiKey || '',
        cerebras_api_key: settings.cerebrasApiKey || '',
        mistral_api_key: settings.mistralApiKey || '',
        siliconflow_api_key: settings.siliconflowApiKey || '',
      })
      await updatePreferences({
        brain_region: settings.brainRegion,
        image_region: settings.imageRegion,
        audio_region: settings.audioRegion,
      })
      localStorage.setItem(storageKey, JSON.stringify(settings))
      setSavedMsg('Saved to cloud ☁️')
    } catch (e) {
      console.error('Cloud save failed, using local:', e)
      localStorage.setItem(storageKey, JSON.stringify(settings))
      setSavedMsg('Saved locally (offline mode)')
    }
    setSaved(true)
    setTimeout(() => { setSaved(false); setSavedMsg('') }, 2500)
  }

  const toggleShow = (key: string) =>
    setShowKey(prev => ({ ...prev, [key]: !prev[key] }))

  // ─── Styles ───────────────────────────────────────────────
  const s = {
    page: {
      minHeight: '100vh',
      width: '100%',
      background: thm.pageBg,
      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
      paddingBottom: '90px',
    } as React.CSSProperties,

    header: {
      position: 'sticky' as const,
      top: 0,
      zIndex: 100,
      background: thm.headerBg,
      backdropFilter: 'blur(30px)',
      WebkitBackdropFilter: 'blur(30px)',
      borderBottom: thm.navBorder,
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    } as React.CSSProperties,

    backBtn: {
      background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.85)',
      border: isDark ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(0,0,0,0.12)',
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
      background: thm.cardBg,
      backdropFilter: 'blur(30px)',
      WebkitBackdropFilter: 'blur(30px)',
      border: thm.cardBorder,
      borderRadius: '20px',
      boxShadow: thm.cardShadow,
      padding: '20px',
      marginBottom: '14px',
      position: 'relative' as const,
      overflow: 'hidden' as const,
    } as React.CSSProperties,

    label: {
      fontSize: '11px',
      color: thm.labelColor,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.06em',
      display: 'block',
      marginBottom: '6px',
      fontWeight: 600,
    } as React.CSSProperties,

    input: {
      width: '100%',
      background: thm.inputBg,
      border: '1px solid transparent',
      borderRadius: '12px',
      padding: '11px 14px',
      color: thm.textPrimary,
      fontSize: '13px',
      outline: 'none',
      fontFamily: 'inherit',
      boxSizing: 'border-box' as const,
      transition: 'border-color 0.2s',
    } as React.CSSProperties,

    select: {
      width: '100%',
      background: thm.inputBg,
      border: '1px solid transparent',
      borderRadius: '12px',
      padding: '11px 14px',
      color: thm.textPrimary,
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
  }: { label: string; fieldKey: keyof AppSettings; placeholder?: string }) => {
    const val = settings[fieldKey] as string
    return (
      <div style={{ marginBottom: '14px' }}>
        <label style={s.label}>{label}</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showKey[fieldKey] ? 'text' : 'password'}
            value={val}
            onChange={e => update(fieldKey, e.target.value as AppSettings[typeof fieldKey])}
            placeholder={placeholder || ''}
            style={{
              ...s.input,
              paddingRight: val ? '60px' : '44px',
              borderColor: val ? 'rgba(52,199,89,0.4)' : 'transparent',
            }}
          />
          {val && (
            <span style={{
              position: 'absolute', right: '38px', top: '50%',
              transform: 'translateY(-50%)', color: '#34c759', fontSize: '14px',
              pointerEvents: 'none',
            }}>✓</span>
          )}
          <button
            onClick={() => toggleShow(fieldKey)}
            style={{
              position: 'absolute', right: '12px', top: '50%',
              transform: 'translateY(-50%)', background: 'none',
              border: 'none', color: 'var(--text-tertiary)',
              cursor: 'pointer', fontSize: '15px', padding: '2px',
            }}>
            {showKey[fieldKey] ? '🙈' : '👁️'}
          </button>
        </div>
      </div>
    )
  }

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
      const res = await fetch(`${WORKER_URL}/api/brain/provider`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gemini-Api-Key': settings.geminiApiKey,
        },
        body: JSON.stringify({
          brain_model: 'gemini-2.0-flash',
          system_prompt: 'You are helpful.',
          user_prompt: 'Reply with: {"ok":true}',
          max_tokens: 20,
        }),
      })
      const data = await res.json() as { content?: string; error?: string }
      if (res.ok && data.content) {
        setGeminiStatus('success')
        setGeminiMsg('✅ Gemini connected!')
      } else {
        setGeminiStatus('failed')
        setGeminiMsg(`❌ ${data.error || `HTTP ${res.status}`}`)
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

  const testGroq = async () => {
    if (!settings.groqApiKey) {
      setGroqStatus('failed'); setGroqMsg('❌ Please enter Groq API Key'); return
    }
    setGroqStatus('testing'); setGroqMsg('Testing connection...')
    try {
      const res = await fetch(`${WORKER_URL}/api/brain/provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Groq-Api-Key': settings.groqApiKey },
        body: JSON.stringify({ brain_model: 'llama-3.1-8b-instant', system_prompt: 'You are helpful.', user_prompt: 'Reply with: {"ok":true}', max_tokens: 20 }),
      })
      const data = await res.json() as { content?: string; error?: string }
      if (res.ok && data.content) {
        setGroqStatus('success'); setGroqMsg('✅ Groq connected!')
      } else {
        setGroqStatus('failed'); setGroqMsg(`❌ ${data.error || `HTTP ${res.status}`}`)
      }
    } catch { setGroqStatus('failed'); setGroqMsg('❌ Network error') }
  }

  const testOpenRouter = async () => {
    if (!settings.openrouterApiKey) {
      setOpenrouterStatus('failed'); setOpenrouterMsg('❌ Please enter OpenRouter API Key'); return
    }
    setOpenrouterStatus('testing'); setOpenrouterMsg('Testing connection...')
    try {
      const res = await fetch(`${WORKER_URL}/api/brain/provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Openrouter-Api-Key': settings.openrouterApiKey },
        body: JSON.stringify({ brain_model: 'google/gemma-3-27b-it:free', system_prompt: 'You are helpful.', user_prompt: 'Reply with: {"ok":true}', max_tokens: 20 }),
      })
      const data = await res.json() as { content?: string; error?: string }
      if (res.ok && data.content) {
        setOpenrouterStatus('success'); setOpenrouterMsg('✅ OpenRouter connected!')
      } else {
        setOpenrouterStatus('failed'); setOpenrouterMsg(`❌ ${data.error || `HTTP ${res.status}`}`)
      }
    } catch { setOpenrouterStatus('failed'); setOpenrouterMsg('❌ Network error') }
  }

  const testGLM = async () => {
    if (!settings.glmApiKey) {
      setGlmStatus('failed'); setGlmMsg('❌ Please enter GLM API Key'); return
    }
    setGlmStatus('testing'); setGlmMsg('Testing connection...')
    try {
      const res = await fetch(`${WORKER_URL}/api/brain/provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Glm-Api-Key': settings.glmApiKey },
        body: JSON.stringify({ brain_model: 'glm-4-flash', system_prompt: 'You are helpful.', user_prompt: 'Reply with: {"ok":true}', max_tokens: 20 }),
      })
      const data = await res.json() as { content?: string; error?: string }
      if (res.ok && data.content) {
        setGlmStatus('success'); setGlmMsg('✅ GLM connected!')
      } else {
        setGlmStatus('failed'); setGlmMsg(`❌ ${data.error || `HTTP ${res.status}`}`)
      }
    } catch { setGlmStatus('failed'); setGlmMsg('❌ Network error') }
  }

  const testCerebras = async () => {
    if (!settings.cerebrasApiKey) {
      setCerebrasStatus('failed'); setCerebrasMsg('❌ Please enter Cerebras API Key'); return
    }
    setCerebrasStatus('testing'); setCerebrasMsg('Testing connection...')
    try {
      const res = await fetch(`${WORKER_URL}/api/brain/provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Cerebras-Api-Key': settings.cerebrasApiKey },
        body: JSON.stringify({ 
          brain_model: 'llama-4-scout-17b-16e-instruct', 
          system_prompt: 'You are helpful.', 
          user_prompt: 'Reply with: {"ok":true}', 
          max_tokens: 20 
        }),
      })
      const data = await res.json() as { content?: string; error?: string }
      if (res.ok && data.content) {
        setCerebrasStatus('success'); setCerebrasMsg('✅ Cerebras connected!')
      } else {
        setCerebrasStatus('failed'); setCerebrasMsg(`❌ ${data.error || `HTTP ${res.status}`}`)
      }
    } catch { setCerebrasStatus('failed'); setCerebrasMsg('❌ Network error') }
  }

  const testMistral = async () => {
    if (!settings.mistralApiKey) {
      setMistralStatus('failed'); setMistralMsg('❌ Please enter Mistral API Key'); return
    }
    setMistralStatus('testing'); setMistralMsg('Testing connection...')
    try {
      const res = await fetch(`${WORKER_URL}/api/brain/provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Mistral-Api-Key': settings.mistralApiKey },
        body: JSON.stringify({ 
          brain_model: 'open-mistral-nemo', 
          system_prompt: 'You are helpful.', 
          user_prompt: 'Reply with: {"ok":true}', 
          max_tokens: 20 
        }),
      })
      const data = await res.json() as { content?: string; error?: string }
      if (res.ok && data.content) {
        setMistralStatus('success'); setMistralMsg('✅ Mistral connected!')
      } else {
        setMistralStatus('failed'); setMistralMsg(`❌ ${data.error || `HTTP ${res.status}`}`)
      }
    } catch { setMistralStatus('failed'); setMistralMsg('❌ Network error') }
  }

  const testSiliconflow = async () => {
    if (!settings.siliconflowApiKey) {
      setSiliconflowStatus('failed'); setSiliconflowMsg('❌ Please enter SiliconFlow API Key'); return
    }
    setSiliconflowStatus('testing'); setSiliconflowMsg('Testing connection...')
    try {
      const res = await fetch(`${WORKER_URL}/api/brain/provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Siliconflow-Api-Key': settings.siliconflowApiKey },
        body: JSON.stringify({ 
          brain_model: 'Qwen/Qwen2.5-7B-Instruct', 
          system_prompt: 'You are helpful.', 
          user_prompt: 'Reply with: {"ok":true}', 
          max_tokens: 20 
        }),
      })
      const data = await res.json() as { content?: string; error?: string }
      if (res.ok && data.content) {
        setSiliconflowStatus('success'); setSiliconflowMsg('✅ SiliconFlow connected!')
      } else {
        setSiliconflowStatus('failed'); setSiliconflowMsg(`❌ ${data.error || `HTTP ${res.status}`}`)
      }
    } catch { setSiliconflowStatus('failed'); setSiliconflowMsg('❌ Network error') }
  }

  // ─── Render ────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <style>{`select option { background: var(--card-bg); color: var(--text-primary); }`}</style>

      {/* Sticky Header */}
      <div style={s.header}>
        <button onClick={() => navigate(-1)} style={s.backBtn}>
          ← Back
        </button>
        <span style={{ color: thm.textPrimary, fontSize: '17px', fontWeight: 700, flex: 1 }}>
          Settings
        </span>
        {user && (
          <span style={{ fontSize: '12px', color: thm.textSecondary, marginRight: '8px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.primaryEmailAddress?.emailAddress}
          </span>
        )}
        <UserButton afterSignOutUrl="/auth" />
      </div>

      <div style={{ padding: '20px 16px 0' }}>

        {/* ── Google Gemini ── */}
        <div style={s.card}>
          <div style={s.sectionTitle}>
            <span style={{ fontSize: '20px' }}>✨</span>
            <span style={{ color: thm.textPrimary, fontSize: '15px', fontWeight: 700 }}>Google Gemini</span>
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

          <p style={{ fontSize: '11px', color: thm.textTertiary, margin: 0 }}>
            Get key → aistudio.google.com/apikey
          </p>
        </div>

        {/* ── AWS Bedrock ── */}
        <div style={s.card}>
          <div style={s.sectionTitle}>
            <span style={{ fontSize: '20px' }}>☁️</span>
            <span style={{ color: thm.textPrimary, fontSize: '15px', fontWeight: 700 }}>AWS Bedrock</span>
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
            background: thm.sectionBg,
            border: thm.navBorder,
            borderRadius: '14px',
            padding: '14px',
            marginBottom: '14px',
          }}>
            <p style={{ fontSize: '11px', color: thm.textSecondary, marginBottom: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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

          <p style={{ fontSize: '11px', color: thm.textTertiary, margin: 0 }}>
            IAM user needs AmazonBedrockFullAccess permission
          </p>
        </div>

        {/* ── Optional APIs ── */}
        <div style={s.card}>
          <div style={s.sectionTitle}>
            <span style={{ fontSize: '20px' }}>🎬</span>
            <span style={{ color: thm.textPrimary, fontSize: '15px', fontWeight: 700 }}>Optional APIs</span>
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
          <SecretInput
            label="Dashscope API Key (Singapore)"
            fieldKey="dashscopeApiKey"
            placeholder="sk-..."
          />
          <p style={{ fontSize: '11px', color: thm.textTertiary, marginTop: 4, marginBottom: '14px' }}>
            Alibaba Cloud Model Studio • Singapore Region — Enables Qwen brain + Wanx image + Wan2.1 video models
          </p>

          <p style={{ fontSize: '11px', color: thm.textTertiary, marginTop: '4px', margin: 0 }}>
            App works without these — AWS services used as fallback
          </p>
        </div>

        {/* ─── FISH AUDIO ───────────────────────────────────────────── */}
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>🐟</span>
            <span style={{ fontWeight: 600, fontSize: 16, color: thm.textPrimary }}>Fish Audio TTS</span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
              background: 'rgba(175,82,222,0.12)', color: '#af52de', border: '1px solid rgba(175,82,222,0.25)'
            }}>#1 TTS Quality</span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
              background: 'rgba(52,199,89,0.12)', color: '#34c759', border: '1px solid rgba(52,199,89,0.25)'
            }}>8K credits/mo free</span>
          </div>
          <p style={{ fontSize: 13, color: thm.textSecondary, margin: '0 0 10px' }}>
            Kualitas TTS terbaik (#1 TTS-Arena2). Mendukung Bahasa Indonesia + emotion tags.
            Daftar free di fish.audio
          </p>
          <SecretInput
            label="Fish Audio API Key"
            fieldKey="fishAudioApiKey"
            placeholder="fish_sk_..."
          />
          <p style={{ fontSize: 12, color: thm.textTertiary, marginTop: 6 }}>
            ℹ️ Tanpa key, Gemini TTS (gratis) digunakan sebagai default.
          </p>
        </div>

        {/* ── Groq ── */}
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'rgba(249,115,22,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px',
            }}>⚡</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: thm.textPrimary }}>Groq</div>
              <div style={{ fontSize: '10px', color: thm.textSecondary }}>
                Free • Fastest inference • console.groq.com
              </div>
            </div>
            <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer"
              style={{ marginLeft: 'auto', fontSize: '11px', color: '#007aff', textDecoration: 'none' }}>
              Get Key →
            </a>
          </div>
          <SecretInput
            label="Groq API Key"
            fieldKey="groqApiKey"
            placeholder="gsk_xxxxxxxxxxxxxxxxxxxx"
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <TestButton label="Test Groq" status={groqStatus} onClick={testGroq} />
            <StatusMsg status={groqStatus} msg={groqMsg} />
          </div>
          <p style={{ fontSize: '11px', color: thm.textTertiary, margin: 0 }}>
            Free tier: 30 req/min · Fastest inference
          </p>
        </div>

        {/* ── OpenRouter ── */}
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'rgba(139,92,246,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px',
            }}>🔀</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: thm.textPrimary }}>OpenRouter</div>
              <div style={{ fontSize: '10px', color: thm.textSecondary }}>
                Free models • DeepSeek, Gemma, Llama • openrouter.ai
              </div>
            </div>
            <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer"
              style={{ marginLeft: 'auto', fontSize: '11px', color: '#007aff', textDecoration: 'none' }}>
              Get Key →
            </a>
          </div>
          <SecretInput
            label="OpenRouter API Key"
            fieldKey="openrouterApiKey"
            placeholder="sk-or-xxxxxxxxxxxxxxxxxxxx"
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <TestButton label="Test OpenRouter" status={openrouterStatus} onClick={testOpenRouter} />
            <StatusMsg status={openrouterStatus} msg={openrouterMsg} />
          </div>
          <p style={{ fontSize: '11px', color: thm.textTertiary, margin: 0 }}>
            Free models available · DeepSeek, Gemma, Llama
          </p>
        </div>

        {/* ── GLM / ZhipuAI ── */}
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'rgba(6,182,212,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px',
            }}>🌐</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: thm.textPrimary }}>GLM-4-Flash</div>
              <div style={{ fontSize: '10px', color: thm.textSecondary }}>
                Free unlimited • ZhipuAI • open.bigmodel.cn
              </div>
            </div>
            <a href="https://open.bigmodel.cn/usercenter/apikeys" target="_blank" rel="noreferrer"
              style={{ marginLeft: 'auto', fontSize: '11px', color: '#007aff', textDecoration: 'none' }}>
              Get Key →
            </a>
          </div>
          <SecretInput
            label="GLM API Key"
            fieldKey="glmApiKey"
            placeholder="xxxxxxxxxxxxxxxxxxxx.xxxxxxxxxxxx"
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <TestButton label="Test GLM" status={glmStatus} onClick={testGLM} />
            <StatusMsg status={glmStatus} msg={glmMsg} />
          </div>
          <p style={{ fontSize: '11px', color: thm.textTertiary, margin: 0 }}>
            GLM-4-Flash: unlimited free tier
          </p>
        </div>

        {/* ── CEREBRAS ── */}
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'rgba(255,140,0,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px',
            }}>⚡</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: thm.textPrimary }}>Cerebras</div>
              <div style={{ fontSize: '10px', color: thm.textSecondary }}>
                Fastest inference • Llama 4 Scout • cloud.cerebras.ai
              </div>
            </div>
            <a href="https://cloud.cerebras.ai/" target="_blank" rel="noreferrer"
              style={{ marginLeft: 'auto', fontSize: '11px', color: '#007aff', textDecoration: 'none' }}>
              Get Key →
            </a>
          </div>
          <SecretInput
            label="Cerebras API Key"
            fieldKey="cerebrasApiKey"
            placeholder="csk-..."
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <TestButton label="Test Cerebras" status={cerebrasStatus} onClick={testCerebras} />
            <StatusMsg status={cerebrasStatus} msg={cerebrasMsg} />
          </div>
          <p style={{ fontSize: '11px', color: thm.textTertiary, margin: 0 }}>
            Free tier: 1M tokens/day • Llama 4 Scout 17B up to 2,600 tok/s
          </p>
        </div>

        {/* ── MISTRAL AI ── */}
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'rgba(88,86,214,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px',
            }}>🌊</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: thm.textPrimary }}>Mistral AI</div>
              <div style={{ fontSize: '10px', color: thm.textSecondary }}>
                Best JSON output • EU-based • mistral.ai
              </div>
            </div>
            <a href="https://console.mistral.ai/" target="_blank" rel="noreferrer"
              style={{ marginLeft: 'auto', fontSize: '11px', color: '#007aff', textDecoration: 'none' }}>
              Get Key →
            </a>
          </div>
          <SecretInput
            label="Mistral API Key"
            fieldKey="mistralApiKey"
            placeholder="cmpl-..."
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <TestButton label="Test Mistral" status={mistralStatus} onClick={testMistral} />
            <StatusMsg status={mistralStatus} msg={mistralMsg} />
          </div>
          <p style={{ fontSize: '11px', color: thm.textTertiary, margin: 0 }}>
            Free tier: rate-limited • Great for structured output
          </p>
        </div>

        {/* ── SILICONFLOW ── */}
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'rgba(255,107,53,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px',
            }}>🔥</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: thm.textPrimary }}>SiliconFlow</div>
              <div style={{ fontSize: '10px', color: thm.textSecondary }}>
                Qwen + DeepSeek + GLM • Asia-optimized • siliconflow.cn
              </div>
            </div>
            <a href="https://cloud.siliconflow.cn/" target="_blank" rel="noreferrer"
              style={{ marginLeft: 'auto', fontSize: '11px', color: '#007aff', textDecoration: 'none' }}>
              Get Key →
            </a>
          </div>
          <SecretInput
            label="SiliconFlow API Key"
            fieldKey="siliconflowApiKey"
            placeholder="sk-..."
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <TestButton label="Test SiliconFlow" status={siliconflowStatus} onClick={testSiliconflow} />
            <StatusMsg status={siliconflowStatus} msg={siliconflowMsg} />
          </div>
          <p style={{ fontSize: '11px', color: thm.textTertiary, margin: 0 }}>
            Free models: Qwen2.5-7B • Alternative to Dashscope
          </p>
        </div>

        {/* ── Security Note ── */}
        <div style={{
          ...s.card,
          background: isDark ? 'rgba(0,122,255,0.1)' : 'rgba(0,122,255,0.06)',
          border: '0.5px solid rgba(0,122,255,0.2)',
        }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>🔐</span>
            <div>
              <p style={{ color: '#007aff', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                Security Note
              </p>
              <p style={{ color: thm.textSecondary, fontSize: '12px', lineHeight: '1.6', margin: 0 }}>
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
          {saved ? `✅ ${savedMsg || 'Settings Saved!'}` : '💾 Save Settings'}
        </button>

      </div>
    </div>
  )
}
