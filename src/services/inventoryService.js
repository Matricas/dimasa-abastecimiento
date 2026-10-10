import { supabase } from '../lib/supabase'

export async function fetchStockStatus() {
  const { data, error } = await supabase
    .from('product_stock_status')
    .select('*')
    .order('excess_value', { ascending: false })
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
