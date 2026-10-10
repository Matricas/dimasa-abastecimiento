# Plan de entregable · Motor de abastecimiento (Solución 1)

Objetivo: dejar la Solución 1 completa como entregable, con datos de prueba y plantillas CSV para los datos reales, **sin tocar el forecast** (lo construye otra persona del equipo).

Ya existe en `main`: Diagnóstico (0001), Matriz ABC-XYZ (0002 a 0004), Forecast (0005) y Propuesta de compra con pedidos en camino (0006 y 0007).

> **Ajuste del 10-10-2026:** la propuesta de compra (`/compras`) y la tabla `incoming_orders` ya están en `main`, hechas por la otra persona del equipo. Este plan deja de construirlas (antes Tareas 6 y 7) y se apoya en ellas: la carga de pedidos en camino escribe en `incoming_orders`, y las alertas la leen.

## Reglas de convivencia

- **Migraciones:** 0008 y 0009 quedan reservadas para el resto del equipo. Este plan usa desde **0010**.
- **Archivos compartidos** (`App.jsx`, `Sidebar.jsx`, servicios existentes): solo se agregan líneas. No se reescriben ni se cambian tablas o funciones de 0001 a 0007.
- **Ramas:** una por tarea, cada una creada desde la anterior, con PR hacia `main`. Nada se mergea sin aprobación.
- **Migraciones en Supabase:** se aplican a mano en el SQL Editor, en orden. La base es compartida con producción.

## Tareas

| # | Rama | Migración | Entrega | Estado |
| --- | --- | --- | --- | --- |
| 1 | `feature/base-pruebas` | — | Este plan, Vitest y una base Postgres en memoria (PGlite) que aplica las migraciones y prueba RLS | Hecha |
| 2 | `feature/riesgos-escala` | 0010 | Lecturas paginadas (sin corte en 1.000 filas) y Diagnóstico guardado en tabla | Hecha |
| 3 | `feature/usuarios` | 0011 | Pantalla de usuarios para asignar roles (solo admin) | Hecha |
| 4 | `feature/datos` | 0012 | Carga de CSV (proveedores, productos, ventas, stock) con validación e historial | |
| 5 | `feature/pedidos-en-camino` | 0013 | Carga de pedidos en camino por CSV a `incoming_orders` (0006), lista, recibir y cancelar | |
| — | — | — | ~~Motor y pantalla de propuesta de compra~~ | Ya en `main` (0006, 0007, `/compras`) |
| 6 | `feature/alertas` | 0014 | Alertas de quiebre, sobrestock, sin movimiento y ocupación | |
| 7 | `feature/entrega` | — | Test de punta a punta (carga → recálculo → propuesta de 0006 → alertas), manual de uso y revisión de `claude.md` §15 | |

## Decisiones tomadas

- **Usuarios:** se crean o invitan desde el panel de Supabase (crearlos desde el navegador exige la clave `service_role`, prohibida). La app solo asigna roles.
- **Notas de crédito:** fuera de esta entrega. Se cargan como ventas netas por día hasta tener el formato real de Random ERP.
- **Sin `React.lazy`:** dividir el bundle haría que los trozos cargados después no lleven la firma SRI que agrega `vite.config.js`. Se acepta el aviso de tamaño del build.
- **Sin librerías nuevas en el frontend:** el CSV se lee y genera con código propio. Solo se suma Vitest como dependencia de desarrollo.

## Lo que no se puede verificar en local

- El comportamiento en el Supabase real y en Vercel, hasta aplicar las migraciones.
- `pg_cron` (PGlite no lo trae).
- El límite de 8 segundos de Supabase con el volumen real.
