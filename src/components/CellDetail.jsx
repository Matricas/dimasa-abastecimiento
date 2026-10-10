import { useState } from 'react'
import { ABC_INFO, XYZ_INFO, reviewLabel, serviceLabel } from '../lib/abcXyz'
import { formatMillions, formatNumber, formatPercent } from '../lib/format'
import CellProducts from './CellProducts'
import StateMessage from './StateMessage'

const PAGE_SIZE = 20

function Stat({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-graphite-500">{label}</dt>
      <dd className="mt-1 font-mono text-lg font-semibold">{value}</dd>
    </div>
  )
}

function CellDetail({ cell }) {
  const [visible, setVisible] = useState(PAGE_SIZE)
  const { abc, xyz, policy, products } = cell

  return (
    <section className="rounded-lg border border-concrete-300 bg-white" aria-live="polite">
      <header className="p-5 sm:p-6">
        <p className="font-mono text-xs uppercase tracking-widest text-graphite-500">Celda {abc}-{xyz}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">
          {ABC_INFO[abc].label}, {XYZ_INFO[xyz].label.toLowerCase()}
        </h2>
        <div className="mt-4 rounded-md border-l-4 border-signal-400 bg-concrete-50 px-4 py-3">
          <p className="text-sm font-semibold">
            {serviceLabel(policy.service_level)} · {reviewLabel(policy.review_days)}
          </p>
          <p className="mt-1 text-sm text-graphite-600">{policy.description}</p>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Productos" value={formatNumber(cell.count)} />
          <Stat label="Del margen" value={formatPercent(cell.marginShare)} />
          <Stat label="Capital en stock" value={formatMillions(cell.stockValue)} />
          <Stat label="Exceso" value={formatMillions(cell.excessValue)} />
        </dl>
      </header>

      {products.length === 0 ? (
        <StateMessage
          variant="empty"
          title="No hay productos en esta celda"
          description="Con las ventas actuales ningún producto cae en esta combinación de margen y variación."
        />
      ) : (
        <>
          <CellProducts products={products.slice(0, visible)} />
          <footer className="flex flex-col items-center gap-3 border-t border-concrete-300 px-5 py-4 sm:flex-row sm:justify-between">
            <p className="text-sm text-graphite-500">
              Mostrando {Math.min(visible, products.length)} de {products.length} productos, ordenados por margen
            </p>
            {visible < products.length && (
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="rounded-md border border-graphite-900 px-4 py-2 text-sm font-medium transition-colors hover:bg-graphite-900 hover:text-white"
              >
                Mostrar {Math.min(PAGE_SIZE, products.length - visible)} más
              </button>
            )}
          </footer>
        </>
      )}
    </section>
  )
}

export default CellDetail
