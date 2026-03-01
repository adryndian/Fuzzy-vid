import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'

export interface HistoryItem {
  id: string
  title: string
  platform: string
  art_style: string
  language: string
  brain_model: string
  scenes_count: number
  created_at: string
  storyboard_data: string // raw JSON string
}

interface HistoryState {
  items: HistoryItem[]
  addItem: (item: Omit<HistoryItem, 'id' | 'created_at'>) => void
  removeItem: (id: string) => void
  clearAll: () => void
  getItem: (id: string) => HistoryItem | undefined
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) =>
        set((state) => ({
          items: [
            { ...item, id: nanoid(), created_at: new Date().toISOString() },
            ...state.items,
          ],
        })),
      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        })),
      clearAll: () => set({ items: [] }),
      getItem: (id) => get().items.find((i) => i.id === id),
    }),
    { name: 'fuzzy-short-history' }
  )
)
