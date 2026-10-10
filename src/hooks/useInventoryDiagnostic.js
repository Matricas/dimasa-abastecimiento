import { useCallback, useEffect, useState } from 'react'
import { fetchStockStatus, fetchStorageZones } from '../services/inventoryService'
import { summarizeDiagnostic } from '../lib/diagnostics'

export function useInventoryDiagnostic() {
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
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

  useEffect(() => {
    load()
  }, [load])

  return { rows, summary, loading, error, reload: load }
}
