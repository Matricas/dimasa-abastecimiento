import { supabase } from '../lib/supabase'

export async function listUsers() {
  const { data, error } = await supabase.rpc('list_users')
  if (error) throw error
  return data
}

export async function setUserRole(userId, role) {
  const { data, error } = await supabase.rpc('set_user_role', { p_user_id: userId, p_role: role })
  if (error) throw error
  return data
}
