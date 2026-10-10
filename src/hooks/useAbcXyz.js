import { useCallback, useEffect, useState } from 'react'
import { fetchAbcXyz, fetchPolicies, refreshClassifications } from '../services/classificationService'
import { fetchStockStatus } from '../services/inventoryService'
import { summarizeMatrix } from '../lib/abcXyz'

const STOCK_FIELDS = ['stock_value', 'excess_value', 'coverage_days', 'status']

export function useAbcXyz() {
  const [summary, setSummary] = useState(null)
  const [computedAt, setComputedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recomputing, setRecomputing] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rows, policies, stock] = await Promise.all([fetchAbcXyz(), fetchPolicies(), fetchStockStatus()])
      const stockById = new Map(stock.map((row) => [row.product_id, row]))
      const merged = rows.map((row) => {
        const stockRow = stockById.get(row.product_id) ?? {}
        return { ...row, ...Object.fromEntries(STOCK_FIELDS.map((key) => [key, stockRow[key] ?? null])) }
      })
      setSummary(summarizeMatrix(merged, policies))
      setComputedAt(rows[0]?.computed_at ?? null)
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
      await refreshClassifications()
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

  return { summary, computedAt, loading, recomputing, error, reload: load, recompute }
}
