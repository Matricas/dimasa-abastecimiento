import { supabase } from '../lib/supabase'

const AUTH_ERRORS = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'Tu correo aún no está confirmado. Revisa tu bandeja de entrada.',
  over_request_rate_limit: 'Demasiados intentos. Espera un minuto y vuelve a intentar.',
}

export function authErrorMessage(error) {
  return AUTH_ERRORS[error?.code] ?? 'No pudimos iniciar sesión. Revisa tu conexión e intenta de nuevo.'
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.session
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}
