import { supabase } from '../lib/supabase'
import { fetchAll } from './fetchAll'

export async function fetchLatestProposal() {
  const { data, error } = await supabase
    .from('purchase_proposals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function fetchProposalLines(proposalId) {
  return fetchAll(() => supabase.from('purchase_proposal_detail').select('*').eq('proposal_id', proposalId).order('product_id'))
}

export async function generateProposal() {
  const { data, error } = await supabase.rpc('generate_purchase_proposal')
  if (error) throw error
  return data
}

export async function approveProposal(proposalId) {
  const { data, error } = await supabase.rpc('approve_purchase_proposal', { p_proposal_id: proposalId })
  if (error) throw error
  return data
}

export async function updateLineDecision(lineId, { decision, finalQty, reason }) {
  const changes = { decision, decision_reason: reason ?? null }
  if (finalQty !== undefined) changes.final_qty = finalQty
  const { data, error } = await supabase
    .from('purchase_proposal_lines')
    .update(changes)
    .eq('id', lineId)
    .select('id, final_qty, decision, decision_reason, decided_at')
    .single()
  if (error) throw error
  return data
}
