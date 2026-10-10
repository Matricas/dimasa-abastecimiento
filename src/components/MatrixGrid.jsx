import { ABC, ABC_INFO, XYZ, XYZ_INFO } from '../lib/abcXyz'
import MatrixCell from './MatrixCell'

function MatrixGrid({ cells, selectedKey, onSelect }) {
  return (
    <section className="rounded-lg border border-concrete-300 bg-white p-4 sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight">Matriz de productos</h2>
      <p className="mt-1 text-sm text-graphite-500">Elige una celda para ver sus productos y su regla de compra.</p>

      <div className="mt-5 grid grid-cols-[2.25rem_repeat(3,minmax(0,1fr))] gap-1.5 sm:grid-cols-[8.5rem_repeat(3,minmax(0,1fr))] sm:gap-3">
        <span aria-hidden="true" />
        {XYZ.map((xyz) => (
          <div key={xyz} className="pb-1 text-center sm:text-left">
            <p className="font-mono text-sm font-semibold">{xyz}</p>
            <p className="hidden text-xs font-medium text-graphite-700 sm:block">{XYZ_INFO[xyz].label}</p>
            <p className="hidden text-xs text-graphite-500 lg:block">{XYZ_INFO[xyz].hint}</p>
          </div>
        ))}

        {ABC.map((abc) => [
          <div key={`h-${abc}`} className="flex flex-col justify-center pr-1">
            <p className="font-mono text-sm font-semibold">{abc}</p>
            <p className="hidden text-xs font-medium text-graphite-700 sm:block">{ABC_INFO[abc].label}</p>
            <p className="hidden text-xs text-graphite-500 sm:block">{ABC_INFO[abc].hint}</p>
          </div>,
          ...XYZ.map((xyz) => (
            <MatrixCell
              key={`${abc}${xyz}`}
              cell={cells[`${abc}${xyz}`]}
              selected={selectedKey === `${abc}${xyz}`}
              onSelect={onSelect}
            />
          )),
        ])}
      </div>

      <p className="mt-4 text-xs text-graphite-500 sm:hidden">
        A, B, C = margen alto, medio y bajo. X, Y, Z = venta estable, variable y errática.
      </p>
    </section>
  )
}

export default MatrixGrid
