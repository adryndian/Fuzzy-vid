import { useAuth } from '@clerk/clerk-react'

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://fuzzy-vid-worker.officialdian21.workers.dev'

async function authFetch(token: string, path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${WORKER_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string> || {}),
    },
  })
}

export function useUserApi() {
  const { getToken } = useAuth()

  const withToken = async (fn: (token: string) => Promise<Response>) => {
    const token = await getToken()
    if (!token) throw new Error('Not authenticated')
    return fn(token)
  }

  return {
    getProfile: () =>
      withToken(t => authFetch(t, '/api/user/profile')).then(r => r.json()),

    updatePreferences: (prefs: Record<string, unknown>) =>
      withToken(t => authFetch(t, '/api/user/profile', { method: 'PUT', body: JSON.stringify(prefs) })).then(r => r.json()),

    saveApiKeys: (keys: Record<string, unknown>) =>
      withToken(t => authFetch(t, '/api/user/keys', { method: 'POST', body: JSON.stringify(keys) })).then(r => r.json()),

    getApiKeys: () =>
      withToken(t => authFetch(t, '/api/user/keys')).then(r => r.json()),

    getUsage: () =>
      withToken(t => authFetch(t, '/api/user/usage')).then(r => r.json()),

    listStoryboards: () =>
      withToken(t => authFetch(t, '/api/storyboards')).then(r => r.json()),

    saveStoryboard: (data: Record<string, unknown>) =>
      withToken(t => authFetch(t, '/api/storyboards', { method: 'POST', body: JSON.stringify(data) })).then(r => r.json()),

    getStoryboard: (id: string) =>
      withToken(t => authFetch(t, `/api/storyboards/${id}`)).then(r => r.json()),

    deleteStoryboard: (id: string) =>
      withToken(t => authFetch(t, `/api/storyboards/${id}`, { method: 'DELETE' })).then(r => r.json()),

    saveSceneAsset: (data: Record<string, unknown>) =>
      withToken(t => authFetch(t, `/api/storyboards/${data.storyboard_id}/scenes`, {
        method: 'POST',
        body: JSON.stringify(data),
      })).then(r => r.json()),
  }
}
