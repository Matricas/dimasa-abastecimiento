import { useCallback, useEffect, useState } from 'react'
import { approveProposal, fetchLatestProposal, fetchProposalLines, generateProposal, updateLineDecision } from '../services/purchaseService'

export function usePurchaseProposal() {
  const [proposal, setProposal] = useState(null)
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null) // 'generar' | 'aprobar'
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const latest = await fetchLatestProposal()
      setProposal(latest)
      setLines(latest ? await fetchProposalLines(latest.id) : [])
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const run = useCallback(
    async (kind, action) => {
      setBusy(kind)
      setError(null)
      try {
        await action()
        await load()
      } catch (err) {
        setError(err)
      } finally {
        setBusy(null)
      }
    },
    [load],
  )

  // Las decisiones por línea devuelven su propio error para mostrarlo junto a la línea
  const decide = useCallback(async (lineId, change) => {
    const updated = await updateLineDecision(lineId, change)
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, ...updated } : l)))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return {
    proposal,
    lines,
    loading,
    busy,
    error,
    reload: load,
    generate: () => run('generar', generateProposal),
    approve: () => run('aprobar', () => approveProposal(proposal.id)),
    decide,
  }
}
