import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { fetchUrgentAlertCount } from '../services/alertService'

// Cuenta de alertas críticas y altas sin revisar; se actualiza al cambiar de pantalla.
export function useUrgentAlertCount() {
  const { pathname } = useLocation()
  const [count, setCount] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchUrgentAlertCount()
      .then((n) => !cancelled && setCount(n))
      // Si falla, el menú simplemente no muestra el número; la pantalla de alertas muestra el error
      .catch(() => !cancelled && setCount(null))
    return () => {
      cancelled = true
    }
  }, [pathname])

  return count
}
