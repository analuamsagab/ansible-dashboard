import { useState, useEffect, useCallback, useRef } from 'react'

interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useFetch<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
) {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
  })
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const execute = useCallback(() => {
    setState(s => ({ ...s, loading: true, error: null }))

    fetcher()
      .then((data) => {
        if (mountedRef.current) setState({ data, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (mountedRef.current) setState({ data: null, loading: false, error: (err as Error).message })
      })
  }, deps) // eslint-disable-line

  useEffect(() => {
    execute()
  }, [execute])

  return { ...state, refetch: execute } as const
}
