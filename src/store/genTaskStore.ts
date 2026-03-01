import { create } from 'zustand'
import { nanoid } from 'nanoid'

export interface GenTask {
  id: string
  title: string
  status: 'running' | 'done' | 'error'
  currentStep: number
  resultJson?: string
  error?: string
  startedAt: string
}

interface GenTaskState {
  tasks: GenTask[]
  addTask: (task: Omit<GenTask, 'id' | 'startedAt'>) => string
  updateTask: (id: string, partial: Partial<Omit<GenTask, 'id' | 'startedAt'>>) => void
  removeTask: (id: string) => void
}

export const useGenTaskStore = create<GenTaskState>()((set) => ({
  tasks: [],
  addTask: (task) => {
    const id = nanoid()
    set((state) => ({
      tasks: [...state.tasks, { ...task, id, startedAt: new Date().toISOString() }],
    }))
    return id
  },
  updateTask: (id, partial) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...partial } : t)),
    })),
  removeTask: (id) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    })),
}))
