// Utilidades del forecast: precisión agregada y armado de series semanales.

export const METHOD_LABELS = {
  estacional: 'Estacional',
  esporadico: 'Venta esporádica',
  sin_venta: 'Sin venta reciente',
}

export const METHOD_HINTS = {
  estacional: 'Promedio ponderado de 12 semanas ajustado por temporada',
  esporadico: 'Promedio simple de 26 semanas',
  sin_venta: 'Sin ventas en 26 semanas: se proyecta 0',
}

const DAY = 86400000
export const parseDate = (iso) => new Date(`${iso}T00:00:00Z`)
export const toIsoDate = (date) => date.toISOString().slice(0, 10)
export const addDays = (iso, days) => toIsoDate(new Date(parseDate(iso).getTime() + days * DAY))

const wape = (error, actual) => (actual > 0 ? error / actual : null)

export function summarizeAccuracy(rows) {
  const total = (list, key) => list.reduce((sum, row) => sum + Number(row[key] ?? 0), 0)
  const build = (list) => {
    const actual = total(list, 'backtest_actual_qty')
    return {
      count: list.length,
      model: wape(total(list, 'abs_error_model'), actual),
      lastYear: wape(total(list, 'abs_error_last_year'), actual),
      last4w: wape(total(list, 'abs_error_last_4w'), actual),
      bias: actual > 0 ? total(list, 'bias_model') / actual : null,
      winsVsLastYear: list.filter((r) => r.backtest_actual_qty > 0 && r.abs_error_model < r.abs_error_last_year).length,
      evaluated: list.filter((r) => r.backtest_actual_qty > 0).length,
    }
  }
  return {
    overall: build(rows),
    byClass: ['A', 'B', 'C'].map((abc) => ({ abc, ...build(rows.filter((r) => r.abc_class === abc)) })),
  }
}

// 52 semanas reales que terminan en la fecha de origen (semana k = 7 días que terminan en origen - 7k)
export function weeklyHistory(sales, originDate, weeks = 52) {
  const origin = parseDate(originDate).getTime()
  const totals = new Array(weeks).fill(0)
  for (const sale of sales) {
    const k = Math.floor((origin - parseDate(sale.sale_date).getTime()) / DAY / 7)
    if (k >= 0 && k < weeks) totals[k] += Number(sale.quantity)
  }
  return totals
    .map((qty, k) => ({ weekStart: addDays(originDate, -7 * k - 6), qty }))
    .reverse()
}

// Colores del gráfico, validados para contraste y daltonismo
export const CHART_COLORS = { real: '#1F6FB2', forecast: '#B7791F' }
