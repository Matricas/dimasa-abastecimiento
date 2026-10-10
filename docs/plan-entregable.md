# Plan de entregable · Motor de abastecimiento (Solución 1)

Objetivo: dejar la Solución 1 completa como entregable, con datos de prueba y plantillas CSV para los datos reales, **sin tocar el forecast** (lo construye otra persona del equipo).

Ya existe en `main`: Diagnóstico (0001), Matriz ABC-XYZ (0002 a 0004) y Forecast (0005).

## Reglas de convivencia

- **Migraciones:** 0006 a 0009 quedan reservadas para el forecast. Este plan usa desde **0010**.
- **Archivos compartidos** (`App.jsx`, `Sidebar.jsx`, servicios existentes): solo se agregan líneas. No se reescriben ni se cambian tablas o funciones de 0001 a 0005.
- **Ramas:** una por tarea, cada una creada desde la anterior, con PR hacia `main`. Nada se mergea sin aprobación.
- **Migraciones en Supabase:** se aplican a mano en el SQL Editor, en orden. La base es compartida con producción.

## Contrato con el forecast

La propuesta de compra lee la vista `forecast_for_purchase` (0014), que se arma sobre las tablas del forecast (`product_forecasts` y `product_forecast_metrics`):

| Columna | Qué es |
| --- | --- |
| `product_id` | Producto |
| `horizon_week` | Semana futura (1 = la que empieza al día siguiente de la foto de stock) |
| `qty_p10`, `qty_p50`, `qty_p90` | Escenario bajo, medio y alto (`low_qty`, `forecast_qty`, `high_qty`) |
| `sigma_week` | Error típico semanal del backtest |
| `source` | `'forecast'` si viene del forecast, `'historial'` si se usó el respaldo |

Si un producto no tiene forecast guardado (por ejemplo, porque no se ha corrido `refresh_forecasts()`), la vista usa el promedio y la desviación de sus últimas 13 semanas. Si el forecast cambia de columnas, basta con `create or replace view` manteniendo estas.

## Fórmula de compra (por producto)

1. L = plazo del proveedor; R = revisión de la celda ABC-XYZ (7, 14 o 30 días). Se cubren `ceil((L+R)/7)` semanas.
2. D = suma del escenario medio en esas semanas.
3. Stock de seguridad: `SS = z × σ_semanal × √((L+R)/7)`, con z según el nivel de servicio de la celda (`normal_quantile`).
4. `Q = máx(0, D + SS − stock − pedidos en camino)`, redondeado al mínimo de compra y al lote.
5. C-Z: no se compra automático (línea "bajo pedido").
6. Si el pedido no cabe en bodega o patio, se recorta primero C, después B y al final A.
7. Importados: también se muestran las cantidades con los escenarios bajo y alto.
8. Cada línea guarda su razón en texto simple.

Nota: el contexto (11.4) usa √L; con revisión periódica lo correcto es √(L+R).

## Tareas

| # | Rama | Migración | Entrega |
| --- | --- | --- | --- |
| 1 | `feature/base-pruebas` | — | Este plan, Vitest y una base Postgres en memoria (PGlite) que aplica las migraciones y prueba RLS |
| 2 | `feature/riesgos-escala` | 0010 | Lecturas paginadas (sin corte en 1.000 filas) y Diagnóstico guardado en tabla |
| 3 | `feature/usuarios` | 0011 | Pantalla de usuarios para asignar roles (solo admin) |
| 4 | `feature/datos` | 0012 | Carga de CSV (proveedores, productos, ventas, stock) con validación e historial |
| 5 | `feature/pedidos-en-camino` | 0013 | Pedidos en camino: carga, lista, recibir y cancelar |
| 6 | `feature/propuesta-motor` | 0014 | Cálculo de la propuesta semanal y aprobación |
| 7 | `feature/propuesta-pantalla` | — | Pantalla de propuesta: revisar, ajustar, aprobar y exportar CSV |
| 8 | `feature/alertas` | 0015 | Alertas de quiebre, sobrestock, sin movimiento y ocupación |
| 9 | `feature/entrega` | — | Test de punta a punta, manual de uso y revisión de `claude.md` §15 |

## Decisiones tomadas

- **Usuarios:** se crean o invitan desde el panel de Supabase (crearlos desde el navegador exige la clave `service_role`, prohibida). La app solo asigna roles.
- **Notas de crédito:** fuera de esta entrega. Se cargan como ventas netas por día hasta tener el formato real de Random ERP.
- **Sin `React.lazy`:** dividir el bundle haría que los trozos cargados después no lleven la firma SRI que agrega `vite.config.js`. Se acepta el aviso de tamaño del build.
- **Sin librerías nuevas en el frontend:** el CSV se lee y genera con código propio. Solo se suma Vitest como dependencia de desarrollo.

## Lo que no se puede verificar en local

- El comportamiento en el Supabase real y en Vercel, hasta aplicar las migraciones.
- `pg_cron` (PGlite no lo trae).
- El límite de 8 segundos de Supabase con el volumen real.
