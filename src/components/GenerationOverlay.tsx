import { motion, AnimatePresence } from 'framer-motion'

export interface GenStep {
  label: string
  status: 'pending' | 'active' | 'done'
}

interface Props {
  isOpen: boolean
  steps: GenStep[]
  currentStep: number
  elapsedMs: number
}

function formatElapsed(ms: number): string {
  const sec = Math.floor(ms / 1000)
  const min = Math.floor(sec / 60)
  const s = sec % 60
  return min > 0 ? `${min}:${s.toString().padStart(2, '0')}` : `${s}s`
}

export function GenerationOverlay({ isOpen, steps, currentStep, elapsedMs }: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(6,8,18,0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            style={{
              background: 'rgba(255,255,255,0.07)',
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '24px',
              boxShadow: '0 12px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.12)',
              padding: '36px 32px 28px',
              width: '340px',
              maxWidth: '90vw',
              fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
            }}
          >
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                style={{ fontSize: '32px', marginBottom: '10px', display: 'inline-block' }}
              >
                ✨
              </motion.div>
              <div style={{ color: '#EFE1CF', fontSize: '17px', fontWeight: 700 }}>
                Generating Storyboard
              </div>
            </div>

            {/* Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {steps.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    opacity: step.status === 'pending' ? 0.35 : 1,
                  }}
                >
                  {/* Status dot */}
                  <div style={{ position: 'relative', width: '10px', height: '10px', flexShrink: 0 }}>
                    {step.status === 'active' ? (
                      <>
                        <motion.div
                          animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: '50%',
                            background: '#F05A25',
                          }}
                        />
                        <div style={{
                          width: '10px', height: '10px', borderRadius: '50%',
                          background: '#F05A25',
                          boxShadow: '0 0 8px rgba(240,90,37,0.6)',
                        }} />
                      </>
                    ) : (
                      <div style={{
                        width: '10px', height: '10px', borderRadius: '50%',
                        background: step.status === 'done' ? '#66bb6a' : 'rgba(239,225,207,0.2)',
                        boxShadow: step.status === 'done' ? '0 0 6px rgba(102,187,106,0.4)' : 'none',
                      }} />
                    )}
                  </div>
                  {/* Label */}
                  <span style={{
                    color: step.status === 'active' ? '#EFE1CF' :
                      step.status === 'done' ? 'rgba(239,225,207,0.6)' :
                        'rgba(239,225,207,0.3)',
                    fontSize: '13px',
                    fontWeight: step.status === 'active' ? 600 : 400,
                  }}>
                    {step.label}
                    {step.status === 'done' && ' ✓'}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Elapsed timer */}
            <div style={{
              textAlign: 'center',
              color: 'rgba(239,225,207,0.35)',
              fontSize: '12px',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {currentStep < steps.length - 1
                ? `Elapsed: ${formatElapsed(elapsedMs)}`
                : `Completed in ${formatElapsed(elapsedMs)}`
              }
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
