import { useState, useEffect, useRef } from 'react'

export function useElapsedTimer(running: boolean) {
  const [elapsedMs, setElapsedMs] = useState(0)
  const startRef = useRef(0)

  useEffect(() => {
    if (running) {
      startRef.current = Date.now()
      setElapsedMs(0)
      const id = setInterval(() => {
        setElapsedMs(Date.now() - startRef.current)
      }, 100)
      return () => clearInterval(id)
    }
    // keep final value when stopped
  }, [running])

  return elapsedMs
}
