const block = 'animate-pulse rounded-lg bg-concrete-200'

function DiagnosticSkeleton() {
  return (
    <div role="status" aria-label="Cargando diagnóstico" className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${block} h-36`} />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className={`${block} h-72`} />
        <div className={`${block} h-72`} />
      </div>
      <div className={`${block} h-96`} />
      <span className="sr-only">Cargando diagnóstico…</span>
    </div>
  )
}

export default DiagnosticSkeleton
