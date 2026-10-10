// Cálculos del diagnóstico a partir de la vista product_stock_status.

export const STATUS = {
  sobrestock: { label: 'Sobrestock', className: 'bg-signal-100 text-signal-700 ring-signal-400/60' },
  sin_movimiento: { label: 'Sin movimiento', className: 'bg-alert-50 text-alert-700 ring-alert-600/40' },
  quiebre: { label: 'Quiebre', className: 'bg-alert-600 text-white ring-alert-700' },
  riesgo_quiebre: { label: 'Riesgo de quiebre', className: 'bg-steel-50 text-steel-700 ring-steel-600/40' },
  sano: { label: 'Sano', className: 'bg-ok-50 text-ok-700 ring-ok-600/40' },
  inactivo: { label: 'Inactivo', className: 'bg-concrete-200 text-graphite-600 ring-concrete-400' },
}

export const CELL_M2 = 50

const sum = (rows, key) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0)

// m² que ocupa la parte en exceso de un producto (proporcional al valor en exceso)
const excessM2 = (row) => (row.stock_value > 0 ? (row.occupied_m2 * row.excess_value) / row.stock_value : 0)

export function summarizeDiagnostic(rows, zones) {
  const byStatus = (status) => rows.filter((row) => row.status === status)
  const idle = byStatus('sin_movimiento')
  const overstock = byStatus('sobrestock')
  const stockValue = sum(rows, 'stock_value')
  const excessValue = sum(rows, 'excess_value')

  const categories = Object.values(
    rows.reduce((acc, row) => {
      acc[row.category] ??= { category: row.category, excessValue: 0, stockValue: 0 }
      acc[row.category].excessValue += Number(row.excess_value)
      acc[row.category].stockValue += Number(row.stock_value)
      return acc
    }, {}),
  ).sort((a, b) => b.excessValue - a.excessValue)

  const zoneSummaries = zones.map((zone) => {
    const zoneRows = rows.filter((row) => row.storage_zone === zone.code)
    const occupied = sum(zoneRows, 'occupied_m2')
    const idleM2 = sum(zoneRows.filter((row) => row.status === 'sin_movimiento'), 'occupied_m2')
    const overstockM2 = zoneRows.filter((row) => row.status === 'sobrestock').reduce((t, row) => t + excessM2(row), 0)
    return {
      ...zone,
      capacity: Number(zone.capacity_m2),
      occupied,
      idleM2,
      excessM2: overstockM2,
      neededM2: Math.max(0, occupied - idleM2 - overstockM2),
    }
  })

  return {
    refDate: rows[0]?.ref_date ?? null,
    productCount: rows.length,
    stockValue,
    excessValue,
    excessShare: stockValue > 0 ? excessValue / stockValue : 0,
    overstockCount: overstock.length,
    idleValue: sum(idle, 'stock_value'),
    idleCount: idle.length,
    stockoutCount: byStatus('quiebre').length,
    atRiskCount: byStatus('riesgo_quiebre').length,
    categories,
    zones: zoneSummaries,
  }
}
