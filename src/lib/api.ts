/// <reference types="vite/client" />
const WORKERS_URL = import.meta.env.VITE_WORKERS_URL ?? ''
export const api = {
  get: (path: string) => fetch(`${WORKERS_URL}${path}`).then(r => r.json()),
  post: (path: string, body: unknown) => fetch(`${WORKERS_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(r => r.json())
}
