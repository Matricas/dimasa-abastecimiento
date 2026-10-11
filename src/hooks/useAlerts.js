import { useCallback, useEffect, useState } from 'react'
import { fetchAlerts, refreshAlerts, reviewAlert, undoReview } from '../services/alertService'

export function useAlerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [recomputing, setRecomputing] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setAlerts(await fetchAlerts())
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
      await refreshAlerts()
      await load()
    } catch (err) {
      setError(err)
    } finally {
      setRecomputing(false)
    }
  }, [load])

  // Revisar y deshacer devuelven su error para mostrarlo junto a la alerta
  const review = useCallback(async (alertKey, note) => {
    await reviewAlert(alertKey, note)
    setAlerts(await fetchAlerts())
  }, [])

  const undo = useCallback(async (reviewId) => {
    await undoReview(reviewId)
    setAlerts(await fetchAlerts())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { alerts, loading, recomputing, error, reload: load, recompute, review, undo }
}
