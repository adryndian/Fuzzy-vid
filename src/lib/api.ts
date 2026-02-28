declare global {
  interface ImportMeta {
    env: Record<string, string>
  }
}

const WORKERS_URL = (import.meta as ImportMeta).env?.VITE_WORKERS_URL || ''

export const api = {
  get: async (path: string) => {
    const res = await fetch(`${WORKERS_URL}${path}`)
    return res.json()
  },
  post: async (path: string, body: unknown) => {
    const res = await fetch(`${WORKERS_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    return res.json()
  }
}

export default api
