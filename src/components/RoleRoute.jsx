import { Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import StateMessage from './StateMessage'

// Protege una ruta por rol. La base de datos igual rechaza al que no corresponde (RLS y funciones);
// esto solo evita mostrar una pantalla que no va a funcionar.
function RoleRoute({ roles }) {
  const { profile } = useAuth()
  if (!roles.includes(profile?.role)) {
    return (
      <section className="mx-auto max-w-3xl rounded-lg border border-concrete-300 bg-white">
        <StateMessage
          variant="empty"
          title="Esta sección no está disponible para tu rol"
          description="Si necesitas acceso, pídeselo al administrador de la herramienta."
        />
      </section>
    )
  }
  return <Outlet />
}

export default RoleRoute
