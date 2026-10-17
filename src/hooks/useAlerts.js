import { useCallback, useEffect, useState } from 'react'
import { fetchAlert, fetchAlerts, reviewAlert, undoReview } from '../services/alertService'
import { refreshInventoryMetrics } from '../services/inventoryService'

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
      // Recalcula todo (no solo alertas): las alertas leen el diagnóstico guardado, que también hay que poner al día
      await refreshInventoryMetrics()
      await load()
    } catch (err) {
      setError(err)
    } finally {
      setRecomputing(false)
    }
  }, [load])

  // Revisar y deshacer devuelven su error para mostrarlo junto a la alerta
  const refreshOne = useCallback(async (alertKey) => {
    const updated = await fetchAlert(alertKey)
    setAlerts((prev) => (updated ? prev.map((a) => (a.alert_key === alertKey ? updated : a)) : prev))
  }, [])

  const review = useCallback(async (alertKey, note) => {
    await reviewAlert(alertKey, note)
    await refreshOne(alertKey)
  }, [refreshOne])

  const undo = useCallback(async (reviewId, alertKey) => {
    await undoReview(reviewId)
    await refreshOne(alertKey)
  }, [refreshOne])

  useEffect(() => {
    load()
  }, [load])

  return { alerts, loading, recomputing, error, reload: load, recompute, review, undo }
}
