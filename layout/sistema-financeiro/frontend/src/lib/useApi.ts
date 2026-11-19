import { useEffect, useRef, useState } from 'react'

export interface ApiState<T> {
  data: T | null
  error: string | null
  loading: boolean
}

interface Result<T> {
  key: string | null
  data: T | null
  error: string | null
}

/**
 * Executa `load` sempre que `key` mudar, cancelando a chamada anterior.
 * `key` resume as dependências (ex.: "PETR4.SA|1d|3"). Enquanto a nova
 * resposta não chega, os dados anteriores continuam visíveis.
 */
export function useApi<T>(load: (signal: AbortSignal) => Promise<T>, key: string): ApiState<T> {
  const [result, setResult] = useState<Result<T>>({ key: null, data: null, error: null })
  const loadRef = useRef(load)

  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    const ctrl = new AbortController()
    loadRef
      .current(ctrl.signal)
      .then((data) => setResult({ key, data, error: null }))
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return
        const message = err instanceof Error ? err.message : String(err)
        setResult((r) => ({ key, data: r.data, error: message }))
      })
    return () => ctrl.abort()
  }, [key])

  const settled = result.key === key
  return { data: result.data, error: settled ? result.error : null, loading: !settled }
}
