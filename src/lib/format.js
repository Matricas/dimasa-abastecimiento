const clp = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
const integer = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 })
const oneDecimal = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 })
const longDate = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

export const formatCLP = (value) => clp.format(value ?? 0)
export const formatMillions = (value) => `$${integer.format(Math.round((value ?? 0) / 1e6))} M`
export const formatNumber = (value) => integer.format(value ?? 0)
export const formatPercent = (ratio) => `${oneDecimal.format((ratio ?? 0) * 100)}%`
export const formatDate = (isoDate) => (isoDate ? longDate.format(new Date(isoDate)) : '—')
const twoDecimals = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const formatDecimal = (value) => (value === null || value === undefined ? '—' : twoDecimals.format(value))
export const formatShortCLP = (value) => {
  const v = value ?? 0
  if (Math.abs(v) >= 1e6) return `$${oneDecimal.format(v / 1e6)} M`
  if (Math.abs(v) >= 1e3) return `$${integer.format(v / 1e3)} mil`
  return clp.format(v)
}
