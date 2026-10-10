function BrandMark({ inverted = false }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-md bg-signal-400 font-mono text-sm font-semibold text-graphite-900" aria-hidden="true">
        D
      </span>
      <span className="leading-none">
        <span className={`block text-lg font-bold tracking-wide [font-stretch:120%] ${inverted ? 'text-white' : 'text-graphite-900'}`}>
          DIMASA
        </span>
        <span className={`mt-1 block text-xs uppercase tracking-widest ${inverted ? 'text-concrete-400' : 'text-graphite-500'}`}>
          Abastecimiento
        </span>
      </span>
    </div>
  )
}

export default BrandMark
