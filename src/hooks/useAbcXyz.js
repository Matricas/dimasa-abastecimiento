import { useCallback, useEffect, useState } from 'react'
import { fetchAbcXyz, fetchPolicies } from '../services/classificationService'
import { summarizeMatrix } from '../lib/abcXyz'

export function useAbcXyz() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rows, policies] = await Promise.all([fetchAbcXyz(), fetchPolicies()])
      setSummary(summarizeMatrix(rows, policies))
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { summary, loading, error, reload: load }
}
