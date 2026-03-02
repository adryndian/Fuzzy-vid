import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { SceneAssets, SceneAssetsMap } from '../types/schema'
import { defaultSceneAssets } from '../types/schema'

export interface StoryboardSession {
  id: string
  rawJson: string
  title: string
  imageModel: 'nova_canvas' | 'titan_v2'
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
    imageModel: 'nova_canvas' | 'titan_v2'
    audioEngine: 'polly' | 'elevenlabs'
    audioVoice: string
    language: string
  }) => string
  updateAsset: (id: string, sceneNum: number, update: Partial<SceneAssets>) => void
  updateSession: (id: string, partial: Partial<Omit<StoryboardSession, 'id' | 'createdAt'>>) => void
  removeSession: (id: string) => void
}

const MAX_SESSIONS = 5

export const useStoryboardSessionStore = create<StoryboardSessionState>()(
  persist(
    (set, get) => ({
      sessions: {},

      createSession: (params) => {
        const id = nanoid(8)
        set((state) => {
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
        set((state) => {
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
        set((state) => {
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
        set((state) => {
          const next = { ...state.sessions }
          delete next[id]
          return { sessions: next }
        }),
    }),
    { name: 'fuzzy_storyboard_sessions' }
  )
)
