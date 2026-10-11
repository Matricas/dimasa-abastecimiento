import { supabase } from '../lib/supabase'

export async function fetchAlerts() {
  const { data, error } = await supabase.from('alerts_overview').select('*')
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

export async function refreshAlerts() {
  const { data, error } = await supabase.rpc('refresh_alerts')
  if (error) throw error
  return data
}

export async function reviewAlert(alertKey, note) {
  const { error } = await supabase.from('alert_reviews').insert({ alert_key: alertKey, note: note || null })
  if (error) throw error
}

export async function undoReview(reviewId) {
  const { error } = await supabase.from('alert_reviews').delete().eq('id', reviewId)
  if (error) throw error
}
