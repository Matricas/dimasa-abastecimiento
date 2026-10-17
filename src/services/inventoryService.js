import { supabase } from '../lib/supabase'
import { fetchAll } from './fetchAll'

export async function fetchStockStatus() {
  return fetchAll(() =>
    supabase
      .from('product_stock_status')
      .select('*')
      .order('product_id'),
  )
}

export async function refreshInventoryMetrics() {
  const { data, error } = await supabase.rpc('refresh_inventory_metrics')
  if (error) throw error
  return data
}

export async function fetchStorageZones() {
  const { data, error } = await supabase
    .from('storage_zones')
    .select('code, name, capacity_m2')
    .order('capacity_m2')
  if (error) throw error
  return data
}
