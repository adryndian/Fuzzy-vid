import { create } from 'zustand'
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import { get, set, del } from 'idb-keyval'

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

const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value)
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name)
  },
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set_store, get_store) => ({
      items: [],
      addItem: (item) =>
        set_store((state) => ({
          items: [
            { ...item, id: nanoid(), created_at: new Date().toISOString() },
            ...state.items,
          ],
        })),
      removeItem: (id) =>
        set_store((state) => ({
          items: state.items.filter((i) => i.id !== id),
        })),
      clearAll: () => set_store({ items: [] }),
      getItem: (id) => get_store().items.find((i) => i.id === id),
    }),
    { 
      name: 'fuzzy-short-history',
      storage: createJSONStorage(() => idbStorage)
    }
  )
)
