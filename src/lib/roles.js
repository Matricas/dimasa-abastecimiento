// Roles de la herramienta y qué puede hacer cada uno (lo hace cumplir la base de datos).
export const ROLE_OPTIONS = [
  { value: 'pendiente', label: 'Sin acceso', hint: 'No ve ningún dato hasta que se le asigne un rol' },
  { value: 'gerencia', label: 'Gerencia', hint: 'Solo lectura' },
  { value: 'compras', label: 'Compras', hint: 'Carga datos, recalcula y aprueba compras' },
  { value: 'admin', label: 'Administrador', hint: 'Todo lo de compras, más usuarios y borrado' },
]

export const roleLabel = (role) => ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role

