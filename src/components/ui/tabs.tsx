import { createContext, useContext, useState } from 'react'
import { cn } from '../../lib/utils'

const TabsContext = createContext({ active: '', setActive: (_: string) => {} })

export function Tabs({ defaultValue, children, className }: {
  defaultValue: string
  children: React.ReactNode
  className?: string
}) {
  const [active, setActive] = useState(defaultValue)
  return (
    <TabsContext.Provider value={{ active, setActive }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10', className)}>
      {children}
    </div>
  )
}

export function TabsTrigger({ value, children, className, disabled }: {
  value: string
  children: React.ReactNode
  className?: string
  disabled?: boolean
}) {
  const { active, setActive } = useContext(TabsContext)
  return (
    <button
      onClick={() => !disabled && setActive(value)}
      disabled={disabled}
      className={cn(
        'flex-1 px-3 py-1.5 text-sm rounded-lg transition-all',
        active === value
          ? 'bg-[#F05A25] text-white'
          : 'text-[rgba(239,225,207,0.6)] hover:text-[#EFE1CF]',
        disabled && 'opacity-50 cursor-not-allowed grayscale',
        className
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, children, className }: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const { active } = useContext(TabsContext)
  if (active !== value) return null
  return <div className={cn('mt-4', className)}>{children}</div>
}
