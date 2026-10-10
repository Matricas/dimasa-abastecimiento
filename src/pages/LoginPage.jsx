import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { authErrorMessage, signIn } from '../services/authService'
import BrandMark from '../components/BrandMark'

const inputClass =
  'mt-2 block w-full rounded-md border border-concrete-300 bg-white px-3 py-2.5 text-base text-graphite-900 placeholder:text-graphite-400 transition-colors hover:border-graphite-400 focus:border-graphite-900 focus:outline-none focus:ring-2 focus:ring-signal-400 disabled:bg-concrete-100'

function LoginPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (session) return <Navigate to={location.state?.from ?? '/diagnostico'} replace />

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await signIn(email.trim(), password)
      navigate(location.state?.from ?? '/diagnostico', { replace: true })
    } catch (err) {
      setError(authErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-graphite-900 p-12 text-concrete-100 lg:flex">
        <BrandMark inverted />
        <div className="max-w-md">
          <p className="text-4xl font-semibold leading-tight [font-stretch:112%]">
            Compra lo que se vende.
            <br />
            <span className="text-signal-400">Libera lo que está parado.</span>
          </p>
          <p className="mt-6 text-base leading-relaxed text-concrete-300">
            Diagnóstico de inventario, matriz ABC-XYZ y propuesta de compra semanal con los datos de ventas de Dimasa.
          </p>
        </div>
        <p className="font-mono text-xs uppercase tracking-widest text-graphite-400">
          Bodega 4.000 m² · Patio 10.000 m²
        </p>
        <div className="absolute inset-x-0 bottom-0 h-2 bg-safety-stripe" aria-hidden="true" />
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <BrandMark />
          </div>
          <h1 className="mt-8 text-2xl font-semibold tracking-tight lg:mt-0">Ingresa a tu cuenta</h1>
          <p className="mt-2 text-sm text-graphite-500">Usa el correo que te asignó el administrador.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <label className="block text-sm font-medium text-graphite-700">
              Correo
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                placeholder="nombre@dimasa.cl"
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-graphite-700">
              Contraseña
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                className={inputClass}
              />
            </label>

            {error && (
              <p role="alert" className="rounded-md border border-alert-600/30 bg-alert-50 px-3 py-2 text-sm text-alert-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !email || !password}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-signal-400 px-4 py-3 text-base font-semibold text-graphite-900 transition-colors hover:bg-signal-300 active:bg-signal-500 disabled:cursor-not-allowed disabled:bg-concrete-300 disabled:text-graphite-500"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {submitting ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>

          <p className="mt-8 text-sm text-graphite-500">
            ¿No tienes acceso? Pídeselo al administrador del sistema en Dimasa.
          </p>
        </div>
      </section>
    </main>
  )
}

export default LoginPage
