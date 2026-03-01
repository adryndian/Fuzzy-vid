import { create } from 'zustand'

interface CostEntry {
  service: string
  model: string
  cost: number
  timestamp: string
}

interface CostState {
  entries: CostEntry[]
  sessionTotal: number
  addEntry: (entry: Omit<CostEntry, 'timestamp'>) => void
  clearSession: () => void
}

export const useCostStore = create<CostState>()((set) => ({
  entries: [],
  sessionTotal: 0,
  addEntry: (entry) =>
    set((state) => {
      const newEntry = { ...entry, timestamp: new Date().toISOString() }
      return {
        entries: [...state.entries, newEntry],
        sessionTotal: state.sessionTotal + entry.cost,
      }
    }),
  clearSession: () => set({ entries: [], sessionTotal: 0 }),
}))
