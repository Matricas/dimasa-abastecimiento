import { supabase } from '../lib/supabase'
import { fetchAll } from './fetchAll'

export async function fetchAbcXyz() {
  return fetchAll(() => supabase.from('product_abc_xyz').select('*').order('product_id'))
}

export async function fetchPolicies() {
  const { data, error } = await supabase
    .from('inventory_policies')
    .select('abc_class, xyz_class, service_level, review_days, description')
    .order('abc_class')
    .order('xyz_class')
  if (error) throw error
  return data
}

export async function refreshClassifications() {
  const { data, error } = await supabase.rpc('refresh_product_classifications')
  if (error) throw error
  return data
}
