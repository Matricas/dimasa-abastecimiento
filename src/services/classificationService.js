import { supabase } from '../lib/supabase'

export async function fetchAbcXyz() {
  const { data, error } = await supabase.from('product_abc_xyz').select('*')
  if (error) throw error
  return data
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
