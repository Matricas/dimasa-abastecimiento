import { describe, expect, it } from 'vitest'
import { fetchAll } from '../../src/services/fetchAll'

// Cliente simulado: devuelve las filas de `data` según el rango pedido, como PostgREST.
function fakeQuery(data, { failOnPage } = {}) {
  const calls = []
  const build = () => ({
    range(from, to) {
      calls.push([from, to])
      if (failOnPage !== undefined && calls.length - 1 === failOnPage) {
        return Promise.resolve({ data: null, error: { message: 'timeout' } })
      }
      return Promise.resolve({ data: data.slice(from, to + 1), error: null })
    },
  })
  return { build, calls }
}

describe('fetchAll', () => {
  it('junta varias páginas hasta traer todo', async () => {
    const data = Array.from({ length: 2350 }, (_, i) => ({ i }))
    const { build, calls } = fakeQuery(data)
    const rows = await fetchAll(build)
    expect(rows).toHaveLength(2350)
    expect(rows.at(-1)).toEqual({ i: 2349 })
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })

  it('pide una página extra cuando el total es múltiplo exacto del tamaño', async () => {
    const { build, calls } = fakeQuery(Array.from({ length: 4 }, (_, i) => i))
    expect(await fetchAll(build, 2)).toEqual([0, 1, 2, 3])
    expect(calls).toHaveLength(3)
  })

  it('propaga el error de Supabase', async () => {
    const { build } = fakeQuery(Array.from({ length: 1500 }), { failOnPage: 1 })
    await expect(fetchAll(build)).rejects.toEqual({ message: 'timeout' })
  })
})
