import { useCallback, useEffect, useState } from 'react'
import { fetchStockStatus, fetchStorageZones, refreshInventoryMetrics } from '../services/inventoryService'
import { summarizeDiagnostic } from '../lib/diagnostics'

export function useInventoryDiagnostic() {
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recomputing, setRecomputing] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [stockRows, zones] = await Promise.all([fetchStockStatus(), fetchStorageZones()])
      setRows(stockRows)
      setSummary(summarizeDiagnostic(stockRows, zones))
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Recalcula diagnóstico, matriz, forecast y alertas con los datos más recientes (0010)
  const recompute = useCallback(async () => {
    setRecomputing(true)
    setError(null)
    try {
      await refreshInventoryMetrics()
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

  return { rows, summary, loading, recomputing, error, reload: load, recompute }
}
