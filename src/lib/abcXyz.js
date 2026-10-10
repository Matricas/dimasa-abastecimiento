// Etiquetas y resumen de la matriz ABC-XYZ a partir de la vista product_abc_xyz.

export const ABC = ['A', 'B', 'C']
export const XYZ = ['X', 'Y', 'Z']

export const ABC_INFO = {
  A: { label: 'Alto margen', hint: 'Suman el 80% del margen' },
  B: { label: 'Margen medio', hint: 'Siguiente 15% del margen' },
  C: { label: 'Bajo margen', hint: 'Último 5% del margen' },
}

export const XYZ_INFO = {
  X: { label: 'Venta estable', hint: 'Variación semanal menor a 0,5' },
  Y: { label: 'Venta variable', hint: 'Variación entre 0,5 y 1,0' },
  Z: { label: 'Venta errática', hint: 'Variación mayor a 1,0 o poco historial' },
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const monthName = (monthNumber) => MONTHS[monthNumber - 1] ?? '—'

const REVIEW_LABELS = { 7: 'Revisión semanal', 14: 'Revisión quincenal', 30: 'Revisión mensual' }
export const reviewLabel = (days) => REVIEW_LABELS[days] ?? `Revisión cada ${days} días`
export const serviceLabel = (level) => (level === null ? 'Bajo pedido' : `${Math.round(level * 100)}% de servicio`)

const sum = (rows, key) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0)

export function summarizeMatrix(rows, policies) {
  const cells = {}
  for (const policy of policies) {
    const products = rows
      .filter((row) => row.abc_class === policy.abc_class && row.xyz_class === policy.xyz_class)
      .sort((a, b) => b.margin_12m - a.margin_12m)
    cells[`${policy.abc_class}${policy.xyz_class}`] = {
      abc: policy.abc_class,
      xyz: policy.xyz_class,
      policy,
      products,
      count: products.length,
      marginShare: sum(products, 'margin_share'),
      stockValue: sum(products, 'stock_value'),
      excessValue: sum(products, 'excess_value'),
    }
  }

  const abcTotals = ABC.map((abc) => {
    const classRows = rows.filter((row) => row.abc_class === abc)
    return {
      abc,
      count: classRows.length,
      productShare: rows.length ? classRows.length / rows.length : 0,
      marginShare: sum(classRows, 'margin_share'),
    }
  })

  return { cells, abcTotals, productCount: rows.length }
}
