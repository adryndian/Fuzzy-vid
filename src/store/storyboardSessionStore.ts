import { create } from 'zustand'
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import { get, set, del } from 'idb-keyval'
import type { SceneAssets, SceneAssetsMap } from '../types/schema'
import { defaultSceneAssets } from '../types/schema'

export interface StoryboardSession {
  id: string
  rawJson: string
  title: string
  imageModel: string
  audioEngine: 'polly' | 'elevenlabs'
  audioVoice: string
  language: string
  assets: SceneAssetsMap
  isMinimized: boolean
  createdAt: string
}

interface StoryboardSessionState {
  sessions: Record<string, StoryboardSession>
  createSession: (params: {
    rawJson: string
    title: string
    imageModel: string
    audioEngine: 'polly' | 'elevenlabs'
    audioVoice: string
    language: string
  }) => string
  updateAsset: (id: string, sceneNum: number, update: Partial<SceneAssets>) => void
  updateSession: (id: string, partial: Partial<Omit<StoryboardSession, 'id' | 'createdAt'>>) => void
  removeSession: (id: string) => void
}

const MAX_SESSIONS = 5

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

export const useStoryboardSessionStore = create<StoryboardSessionState>()(
  persist(
    (set_store, get_store) => ({
      sessions: {},

      createSession: (params) => {
        const id = nanoid(8)
        set_store((state) => {
          const sessions = { ...state.sessions }
          // Prune oldest if over limit
          const ids = Object.keys(sessions).sort(
            (a, b) => new Date(sessions[a].createdAt).getTime() - new Date(sessions[b].createdAt).getTime()
          )
          while (ids.length >= MAX_SESSIONS) {
            const oldest = ids.shift()!
            delete sessions[oldest]
          }
          sessions[id] = {
            ...params,
            id,
            assets: {},
            isMinimized: false,
            createdAt: new Date().toISOString(),
          }
          return { sessions }
        })
        return id
      },

      updateAsset: (id, sceneNum, update) =>
        set_store((state) => {
          const session = state.sessions[id]
          if (!session) return state
          const current = session.assets[sceneNum] || defaultSceneAssets()
          return {
            sessions: {
              ...state.sessions,
              [id]: {
                ...session,
                assets: {
                  ...session.assets,
                  [sceneNum]: { ...current, ...update },
                },
              },
            },
          }
        }),

      updateSession: (id, partial) =>
        set_store((state) => {
          const session = state.sessions[id]
          if (!session) return state
          return {
            sessions: {
              ...state.sessions,
              [id]: { ...session, ...partial },
            },
          }
        }),

      removeSession: (id) =>
        set_store((state) => {
          const next = { ...state.sessions }
          delete next[id]
          return { sessions: next }
        }),
    }),
    { 
      name: 'fuzzy_storyboard_sessions',
      storage: createJSONStorage(() => idbStorage)
    }
  )
)
