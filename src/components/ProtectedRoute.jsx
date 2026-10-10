import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { signOut } from '../services/authService'
import StateMessage from './StateMessage'

function FullScreen({ children }) {
  return <main className="flex min-h-screen items-center justify-center bg-concrete-100">{children}</main>
}

function ProtectedRoute() {
  const { session, profile, loading, error } = useAuth()
  const location = useLocation()

  if (error) {
    return (
      <FullScreen>
        <StateMessage
          variant="error"
          title="No pudimos validar tu sesión"
          description="Revisa tu conexión a internet y vuelve a intentar."
          onRetry={() => window.location.reload()}
        />
      </FullScreen>
    )
  }
  if (loading || (session && profile === undefined)) {
    return (
      <FullScreen>
        <StateMessage variant="loading" title="Validando tu sesión…" />
      </FullScreen>
    )
  }
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!profile || profile.role === 'pendiente') {
    return (
      <FullScreen>
        <StateMessage
          variant="empty"
          title="Tu cuenta está pendiente de aprobación"
          description="Un administrador de Dimasa debe asignarte un rol (compras o gerencia) antes de que puedas ver los datos."
          onRetry={() => signOut()}
          retryLabel="Cerrar sesión"
        />
      </FullScreen>
    )
  }
  return <Outlet />
}

export default ProtectedRoute
