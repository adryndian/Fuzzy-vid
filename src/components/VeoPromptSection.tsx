// src/components/VeoPromptSection.tsx
import { useState, useCallback } from 'react'
import { VEO_SUBTONES, TONE_TO_SUBTONES, type VeoSubTone } from '../lib/veoSubtones'
import { WORKER_URL } from '../lib/api'

interface VeoPrompt {
  sub_tone?: string
  camera_locked?: boolean
  camera_instruction?: string
  starting_frame?: string
  temporal_action?: string
  physics_detail?: string
  human_element?: string
  full_veo_prompt: string
}

interface Props {
  sceneNumber: number
  veoPrompt: VeoPrompt | null
  voScript: string
  imagePrompt: string
  tone: string
  platform: string
  brainModel: string
  apiHeaders?: Record<string, string>
  onUpdate: (veoPrompt: VeoPrompt) => void
}

export default function VeoPromptSection({
  sceneNumber, veoPrompt, voScript, imagePrompt,
  tone, platform, brainModel, apiHeaders, onUpdate,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [selectedSubTone, setSelectedSubTone] = useState<string>(
    veoPrompt?.sub_tone || TONE_TO_SUBTONES[tone]?.[0] || 'human_story'
  )
  const [copied, setCopied] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  const availableSubTones = TONE_TO_SUBTONES[tone] || []
  const subToneDef = VEO_SUBTONES[selectedSubTone as VeoSubTone]

  const handleCopy = useCallback(async () => {
    if (!veoPrompt?.full_veo_prompt) return
    await navigator.clipboard.writeText(veoPrompt.full_veo_prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [veoPrompt])

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const res = await fetch(`${WORKER_URL}/api/brain/regenerate-veo-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(apiHeaders || {}) },
        body: JSON.stringify({
          scene_number: sceneNumber,
          vo_script: voScript,
          image_prompt: imagePrompt,
          tone,
          sub_tone: selectedSubTone,
          platform,
          brain_model: brainModel,
        }),
      })
      const data = await res.json() as { veo_prompt: VeoPrompt }
      if (data.veo_prompt) onUpdate(data.veo_prompt)
    } catch (e) {
      console.error('Veo regen failed:', e)
    } finally {
      setRegenerating(false)
    }
  }

  const openInAIStudio = () => {
    window.open('https://aistudio.google.com/generate-video', '_blank')
  }

  return (
    <div style={{ marginBottom: '8px' }}>
      {/* Header — collapsed trigger */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', padding: '8px 12px',
          background: expanded
            ? 'rgba(255,107,53,0.08)'
            : 'rgba(118,118,128,0.06)',
          border: `0.5px solid ${expanded ? 'rgba(255,107,53,0.25)' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: expanded ? '12px 12px 0 0' : '12px',
          display: 'flex', alignItems: 'center', gap: '8px',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: '14px' }}>🎬</span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#ff6b35', flex: 1, textAlign: 'left' }}>
          Veo 3.1 Prompt
          {subToneDef && (
            <span style={{ fontSize: '9px', marginLeft: '6px', opacity: 0.7 }}>
              {subToneDef.emoji} {subToneDef.label}
            </span>
          )}
        </span>
        {veoPrompt && (
          <span style={{
            fontSize: '9px', padding: '2px 6px', borderRadius: '6px',
            background: 'rgba(52,199,89,0.1)', color: '#34c759',
            border: '0.5px solid rgba(52,199,89,0.3)',
          }}>Ready ✓</span>
        )}
        <span style={{ fontSize: '10px', color: 'rgba(60,60,67,0.4)' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{
          background: 'rgba(255,255,255,0.9)',
          border: '0.5px solid rgba(255,107,53,0.2)',
          borderTop: 'none', borderRadius: '0 0 12px 12px',
          padding: '12px',
        }}>
          {/* Sub-tone selector — only shown when multiple options exist */}
          {availableSubTones.length > 1 && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(60,60,67,0.5)', marginBottom: '6px' }}>
                SUB-TONE
              </div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {availableSubTones.map(st => {
                  const def = VEO_SUBTONES[st as VeoSubTone]
                  const isSelected = selectedSubTone === st
                  return (
                    <button
                      key={st}
                      onClick={() => setSelectedSubTone(st)}
                      style={{
                        padding: '4px 8px', borderRadius: '8px',
                        background: isSelected ? `${def?.color || '#ff6b35'}18` : 'rgba(118,118,128,0.08)',
                        color: isSelected ? (def?.color || '#ff6b35') : 'rgba(60,60,67,0.6)',
                        fontSize: '10px', fontWeight: isSelected ? 700 : 500,
                        cursor: 'pointer',
                        border: isSelected
                          ? `0.5px solid ${def?.color || '#ff6b35'}40`
                          : '0.5px solid transparent',
                      }}
                    >
                      {def?.emoji} {def?.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Prompt display */}
          {veoPrompt ? (
            <>
              {/* Full prompt */}
              <div style={{
                background: 'rgba(0,0,0,0.03)', borderRadius: '10px',
                padding: '10px', marginBottom: '8px',
                fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '11px',
                color: '#1d1d1f', lineHeight: 1.5,
              }}>
                {veoPrompt.full_veo_prompt}
              </div>

              {/* Breakdown pills */}
              {!showRaw && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                  {veoPrompt.camera_instruction && (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                      <span style={{
                        fontSize: '9px', fontWeight: 700, color: '#007aff',
                        background: 'rgba(0,122,255,0.08)', padding: '2px 6px',
                        borderRadius: '5px', flexShrink: 0,
                      }}>📷 CAMERA</span>
                      <span style={{ fontSize: '10px', color: 'rgba(60,60,67,0.7)' }}>
                        {veoPrompt.camera_instruction}
                      </span>
                    </div>
                  )}
                  {veoPrompt.temporal_action && (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                      <span style={{
                        fontSize: '9px', fontWeight: 700, color: '#ff6b35',
                        background: 'rgba(255,107,53,0.08)', padding: '2px 6px',
                        borderRadius: '5px', flexShrink: 0,
                      }}>⏱️ ACTION</span>
                      <span style={{ fontSize: '10px', color: 'rgba(60,60,67,0.7)' }}>
                        {veoPrompt.temporal_action}
                      </span>
                    </div>
                  )}
                  {veoPrompt.physics_detail && (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                      <span style={{
                        fontSize: '9px', fontWeight: 700, color: '#34c759',
                        background: 'rgba(52,199,89,0.08)', padding: '2px 6px',
                        borderRadius: '5px', flexShrink: 0,
                      }}>🌊 PHYSICS</span>
                      <span style={{ fontSize: '10px', color: 'rgba(60,60,67,0.7)' }}>
                        {veoPrompt.physics_detail}
                      </span>
                    </div>
                  )}
                  {veoPrompt.human_element && (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                      <span style={{
                        fontSize: '9px', fontWeight: 700, color: '#af52de',
                        background: 'rgba(175,82,222,0.08)', padding: '2px 6px',
                        borderRadius: '5px', flexShrink: 0,
                      }}>👤 HUMAN</span>
                      <span style={{ fontSize: '10px', color: 'rgba(60,60,67,0.7)' }}>
                        {veoPrompt.human_element}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Raw JSON view */}
              {showRaw && (
                <pre style={{
                  background: 'rgba(0,0,0,0.04)',
                  border: '0.5px solid rgba(0,0,0,0.08)',
                  borderRadius: '10px', padding: '9px',
                  fontSize: '10px', color: '#1d1d1f', lineHeight: '1.6',
                  overflow: 'auto', margin: '0 0 8px',
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                }}>
                  {JSON.stringify(veoPrompt, null, 2)}
                </pre>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button onClick={handleCopy} style={{
                  flex: 1, padding: '8px', borderRadius: '10px',
                  background: copied ? 'rgba(52,199,89,0.1)' : 'rgba(0,122,255,0.08)',
                  border: `0.5px solid ${copied ? 'rgba(52,199,89,0.3)' : 'rgba(0,122,255,0.2)'}`,
                  color: copied ? '#34c759' : '#007aff',
                  fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                }}>
                  {copied ? '✅ Copied!' : '📋 Copy Prompt'}
                </button>

                <button onClick={openInAIStudio} style={{
                  flex: 1, padding: '8px', borderRadius: '10px',
                  background: 'rgba(66,133,244,0.08)',
                  border: '0.5px solid rgba(66,133,244,0.25)',
                  color: '#4285f4', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                }}>
                  ✨ AI Studio
                </button>

                <button onClick={handleRegenerate} disabled={regenerating} style={{
                  flex: 1, padding: '8px', borderRadius: '10px',
                  background: 'rgba(255,107,53,0.08)',
                  border: '0.5px solid rgba(255,107,53,0.25)',
                  color: '#ff6b35', fontSize: '11px', fontWeight: 700,
                  cursor: regenerating ? 'not-allowed' : 'pointer',
                  opacity: regenerating ? 0.6 : 1,
                }}>
                  {regenerating ? '⏳' : '🔄'} Regen
                </button>

                <button onClick={() => setShowRaw(r => !r)} style={{
                  padding: '8px 10px', borderRadius: '10px',
                  background: showRaw ? 'rgba(118,118,128,0.12)' : 'rgba(118,118,128,0.06)',
                  border: '0.5px solid rgba(118,118,128,0.15)',
                  color: 'rgba(60,60,67,0.5)', fontSize: '10px', cursor: 'pointer',
                }}>
                  {showRaw ? '{ }' : '📊'}
                </button>
              </div>
            </>
          ) : (
            /* No veo_prompt yet */
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <p style={{ fontSize: '11px', color: 'rgba(60,60,67,0.5)', margin: '0 0 10px' }}>
                No Veo prompt yet. Regenerate to create one.
              </p>
              <button onClick={handleRegenerate} disabled={regenerating} style={{
                padding: '8px 20px', borderRadius: '12px', border: 'none',
                background: regenerating ? 'rgba(118,118,128,0.1)' : 'linear-gradient(135deg, #ff6b35, #ff4500)',
                color: regenerating ? 'rgba(60,60,67,0.4)' : 'white',
                fontSize: '12px', fontWeight: 700, cursor: regenerating ? 'not-allowed' : 'pointer',
              }}>
                {regenerating ? '⏳ Generating...' : '🎬 Generate Veo Prompt'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
