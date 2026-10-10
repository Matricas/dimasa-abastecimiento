// Supabase entrega como máximo 1.000 filas por consulta (max-rows) y corta el resto sin avisar.
// fetchAll pide de a una página hasta traer todo. `buildQuery` arma la consulta desde cero en
// cada página y debe tener un orden estable (con una columna única al final) para no repetir filas.
export const PAGE_SIZE = 1000

export async function fetchAll(buildQuery, pageSize = PAGE_SIZE) {
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < pageSize) return rows
  }
}
