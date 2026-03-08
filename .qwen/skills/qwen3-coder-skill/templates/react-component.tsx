// Template: React Component (TypeScript + Tailwind)
// Usage: Copy → rename file and component → replace TODO sections
// Stack: React 18+, TypeScript, Tailwind CSS

import { useState, useEffect } from 'react'

// TODO: Define props interface
interface ComponentNameProps {
  id: string
  className?: string
  onAction?: (id: string) => void
}

// TODO: Define data interface
interface DataType {
  id: string
  name: string
  // add fields
}

// TODO: Rename component
export function ComponentName({ id, className = '', onAction }: ComponentNameProps) {
  const [data, setData] = useState<DataType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        // TODO: Replace with actual fetch
        const result = await fetch(`/api/resource/${id}`).then(r => r.json())
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error('Unknown error'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [id])

  // Loading state
  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={`text-red-500 text-sm ${className}`}>
        Failed to load: {error.message}
      </div>
    )
  }

  // Empty state
  if (!data) {
    return (
      <div className={`text-gray-400 text-sm ${className}`}>
        No data found.
      </div>
    )
  }

  // Main render
  return (
    <div className={`rounded-lg border border-gray-200 p-4 ${className}`}>
      {/* TODO: Replace with actual UI */}
      <h3 className="font-semibold text-gray-900">{data.name}</h3>

      {onAction && (
        <button
          onClick={() => onAction(data.id)}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800"
        >
          Action
        </button>
      )}
    </div>
  )
}

export default ComponentName

// ------------------------------------
// VARIANT: With React Query
// ------------------------------------
// import { useQuery } from '@tanstack/react-query'
//
// export function ComponentNameWithQuery({ id }: ComponentNameProps) {
//   const { data, isLoading, error } = useQuery({
//     queryKey: ['resource', id],
//     queryFn: () => fetch(`/api/resource/${id}`).then(r => r.json()),
//     enabled: !!id,
//   })
//   // same render logic above...
// }
