import { supabase } from '../lib/supabase'
import { fetchAll } from './fetchAll'

export async function fetchAlerts() {
  return fetchAll(() => supabase.from('alerts_overview').select('*').order('alert_key'))
}

export async function fetchAlert(alertKey) {
  const { data, error } = await supabase.from('alerts_overview').select('*').eq('alert_key', alertKey).maybeSingle()
  if (error) throw error
  return data
}

// Alertas críticas y altas sin revisar (para el menú)
export async function fetchUrgentAlertCount() {
  const { count, error } = await supabase
    .from('alerts_overview')
    .select('id', { count: 'exact', head: true })
    .in('severity', ['critica', 'alta'])
    .eq('reviewed', false)
  if (error) throw error
  return count ?? 0
}

export async function reviewAlert(alertKey, note) {
  const { error } = await supabase.from('alert_reviews').insert({ alert_key: alertKey, note: note || null })
  if (error) throw error
}

export async function undoReview(reviewId) {
  const { error } = await supabase.from('alert_reviews').delete().eq('id', reviewId)
  if (error) throw error
}
