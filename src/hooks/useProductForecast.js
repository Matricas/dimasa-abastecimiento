import { useEffect, useState } from 'react'
import { fetchProductForecast, fetchSalesSince } from '../services/forecastService'
import { addDays, weeklyHistory } from '../lib/forecast'

export function useProductForecast(productId, originDate) {
  const [state, setState] = useState({ history: [], forecast: [], loading: true, error: null })

  useEffect(() => {
    if (!productId || !originDate) return
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true, error: null }))
    Promise.all([fetchProductForecast(productId), fetchSalesSince(productId, addDays(originDate, -364))])
      .then(([forecast, sales]) => {
        if (!cancelled) setState({ history: weeklyHistory(sales, originDate), forecast, loading: false, error: null })
      })
      .catch((error) => {
        if (!cancelled) setState((prev) => ({ ...prev, loading: false, error }))
      })
    return () => {
      cancelled = true
    }
  }, [productId, originDate])

  return state
}
