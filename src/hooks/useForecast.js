import { useCallback, useEffect, useState } from 'react'
import { fetchForecastOverview, refreshForecasts } from '../services/forecastService'

export function useForecast() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [recomputing, setRecomputing] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await fetchForecastOverview())
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const recompute = useCallback(async () => {
    setRecomputing(true)
    setError(null)
    try {
      await refreshForecasts()
      await load()
    } catch (err) {
      setError(err)
    } finally {
      setRecomputing(false)
    }
  }, [load])

  useEffect(() => {
    load()
  }, [load])

  return { rows, loading, recomputing, error, reload: load, recompute }
}
