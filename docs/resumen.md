# Dimasa · Motor de abastecimiento

Herramienta web interna para que Dimasa decida **qué, cuánto y cuándo comprar**, dejando de lado el "guatómetro". Parte por mostrar cuánta plata está parada en bodega y patio.

- **Producción:** https://dimasa-abastecimiento-j4vx.vercel.app
- **Código:** https://github.com/Matricas/dimasa-abastecimiento
- **Estado:** Fase 1 (Diagnóstico) y Fase 2 (Matriz ABC-XYZ) listas. Funciona con datos de prueba mientras llegan las exportaciones reales de Random ERP.

---

## El problema que resuelve

Dimasa compra por intuición y lo habitual es que **sobre stock**: capital inmovilizado y bodega llena. Al mismo tiempo, no puede faltar lo que se vende todos los días, porque eso sostiene su ventaja del despacho en 24 a 48 horas. La herramienta mide el problema en pesos y en m², y después propondrá las compras.

## Lo que hace hoy

### Ingreso seguro
- Login con correo y contraseña. No hay registro público: el administrador crea las cuentas.
- Tres roles:
  - **Admin:** ve todo y administra usuarios.
  - **Compras:** ve y carga datos.
  - **Gerencia:** solo lectura.
- Una cuenta nueva no ve nada hasta que el administrador le asigna un rol.

### Pantalla de Diagnóstico de inventario
Una foto del inventario con cuatro cifras clave:

| Indicador | Qué responde | Valor con datos de prueba |
| --- | --- | --- |
| Capital en stock | ¿Cuánta plata hay en bodega y patio, a costo? | $879 M |
| **Capital en exceso** | ¿Cuánto supera la cobertura necesaria? Es la plata que se puede liberar | **$318 M (36%)** |
| Sin movimiento 90+ días | ¿Qué no se vende hace 3 meses o más? | $53 M · 17 productos |
| Disponibilidad en riesgo | ¿Qué está sin stock o por quebrar antes de que llegue la reposición? | 14 productos |

Además incluye:
- **Plano de ocupación:** la bodega techada (4.000 m²) y el patio (10.000 m²) dibujados a escala. Cada cuadro equivale a 50 m² y se colorea según lo que lo ocupa: stock necesario, exceso o stock sin movimiento.
- **Dónde está el exceso:** ranking de categorías (fierro, tabiquería, maderas…) según el capital que sobra en cada una.
- **Tabla de productos:** cada SKU con stock, cobertura en días frente a su objetivo, capital, exceso y estado. Se puede filtrar por estado y zona, buscar por SKU o nombre y ordenar.
- Funciona en computador, tablet y celular.

### Cómo calcula
- **Cobertura:** días que alcanza el stock al ritmo de venta de los últimos 90 días.
- **Cobertura objetivo:** 60 días para proveedores nacionales y 120 para importados.
- **Exceso:** valor a costo del stock que supera la cobertura objetivo.
- **Estados de cada producto:**
  - *Sobrestock:* supera el objetivo.
  - *Sin movimiento:* no se vende hace 90 días o más.
  - *Riesgo de quiebre:* le quedan menos días de stock que su plazo de reposición.
  - *Quiebre:* sin stock, pero con ventas recientes.
  - *Sano:* ninguno de los anteriores.

Cada número se puede explicar en una frase. Es a propósito: compras tiene que poder confiar en la herramienta.

### Pantalla de Matriz ABC-XYZ
Clasifica cada producto según dos criterios:
- **Cuánto deja (ABC):** A son los productos que suman el 80% del margen de los últimos 12 meses, B el siguiente 15% y C el resto.
- **Cuán predecible es su venta (XYZ):** X es venta estable, Y variable y Z errática, según cuánto varía la venta semanal en 52 semanas.

Cada una de las 9 combinaciones tiene su **regla de compra**: un nivel de servicio (por ejemplo, 98% para A-X, que nunca puede faltar) y una frecuencia de revisión (semanal, quincenal o mensual). C-Z se compra bajo pedido o se liquida.

Al elegir una celda se ven sus productos con margen, venta semanal, variación, **estacionalidad** (de 0 a 1, con el mes peak), stock y estado.

Con los datos de prueba, 61 productos A (el 24% del catálogo) generan el 80% del margen.

La matriz queda guardada y la pantalla muestra cuándo se calculó. Compras o el administrador la recalculan con un botón cuando llegan datos nuevos.

## Datos de prueba

Mientras no llegue la exportación de Random ERP, la base trae datos simulados realistas:
- 252 productos de materiales de construcción, en 12 categorías.
- 13 proveedores: 10 nacionales (3 a 5 días de reposición) y 3 importados (45 a 60 días).
- 2 años de ventas (más de 118 mil registros diarios), separadas en minorista (boletas) y empresas (facturas), con estacionalidad: más ventas en verano y menos en invierno.
- Comportamiento tipo 80/20: el 20% de los productos explica el 76% de la venta.

Cuando lleguen los datos reales, reemplazan a los de prueba sin cambiar las pantallas.

## Seguridad
- Cada tabla tiene reglas de acceso por rol en la base de datos (RLS). Un visitante sin sesión no puede leer nada.
- Las claves viven en variables de entorno, nunca en el código.
- El sitio envía cabeceras de seguridad (CSP, HSTS, anti-iframe) y verifica la integridad de sus archivos (SRI).

## Lo que viene

| Fase | Módulo | Qué entrega |
| --- | --- | --- |
| 3 | Forecast de demanda | Proyección de venta por producto y canal, con escenario bajo, medio y alto; se compara contra el método actual y, si no le gana, no se usa |
| 4 | Propuesta de compra | Cada lunes: qué comprar, cuánto, a qué proveedor y dónde guardarlo, con la razón de cada línea. Compras aprueba, ajusta o rechaza, y exporta a Excel |
| 5 | Alertas | Avisa antes de un quiebre en productos clave, cuando algo lleva demasiado tiempo parado o cuando la bodega se llena |
| — | Carga de datos | Subir las exportaciones de Random ERP y el Excel de inventario desde la misma herramienta |

## Tecnología
- **Pantallas:** React, Vite y Tailwind CSS.
- **Base de datos y login:** Supabase (Postgres).
- **Hosting:** Vercel. Cada cambio en GitHub se publica solo.
