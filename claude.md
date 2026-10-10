**Instrucciones para el agente de IA en este proyecto. Léelas completas antes de escribir código. Si una instrucción del usuario contradice este archivo, gana el usuario, pero avísale del conflicto, priorizando siempre la seguridad por defecto.**

**1. Contexto del proyecto**
Aplicación web construida sin escribir código a mano. El usuario dirige, tú construyes.
Stack: React 18+ con Vite, Tailwind CSS 3+, JavaScript (no TypeScript salvo que el usuario lo pida).
Backend: Supabase (base de datos Postgres, autenticación, almacenamiento de archivos). No se construye un servidor propio.
Despliegue: Vercel. Cada push a GitHub genera un despliegue. La rama main es producción; cualquier otra rama genera una URL de preview.
Fuente de verdad: la URL de Vercel, no localhost. El servidor local sirve solo para iterar rápido antes de hacer push. Nada se da por terminado hasta que funciona en la URL de preview o producción.
El usuario puede no ser programador. Explica cada decisión técnica en 1 o 2 frases en español simple antes de ejecutarla.

**2. Idioma y comunicación**
Responde siempre en español.
Todo el texto visible de la interfaz (botones, títulos, mensajes de error, estados vacíos) va en español, salvo que el usuario indique otro idioma.
Los nombres de archivos, componentes, variables, funciones, tablas y columnas van en inglés, siguiendo la convención estándar de React y de SQL (`snake_case` en la base de datos, `camelCase` o `PascalCase` en JavaScript).
Nunca uses jerga sin explicarla la primera vez.

**3. Configuración inicial y Seguridad de Borde**
Cuando el proyecto parte de cero, sigue este orden y no saltes pasos:
**3.1 Proyecto React**
Ejecuta la inicialización estándar de Vite y Tailwind.
Instala dependencias base y de seguridad: `npm install @supabase/supabase-js lucide-react react-router-dom dompurify`.
Incorpora vitalmente `@small-tech/vite-plugin-sri` (como dependencia de desarrollo) en `vite.config.js` para generar validaciones criptográficas de Subresource Integrity (SRI), mitigando ataques a redes de entrega (CDN).
Configura `tailwind.config.js` y agrega las 3 directivas de Tailwind a `src/index.css`.
**3.2 Supabase**
Pide al usuario la URL del proyecto y la clave `anon` public. Se prohíbe severamente solicitar, importar o hardcodear la clave administrativa `service_role` en el repositorio, ya que otorga poder absoluto para eludir las capas RLS.
Crea `.env.local` y agrégalo a `.gitignore` junto con `.env` en el mismo paso.
Crea `src/lib/supabase.js` con el cliente único. Todo acceso a datos pasa por este cliente.
**3.3 Git y GitHub**
`git init`, primer commit, y crea el repositorio en GitHub. Verifica que `.env.local` no aparezca en `git status` antes del primer push.
**3.4 Vercel y Firewall WAF**
El archivo `vercel.json` en la raíz no solo evita errores 404 en el router, sino que actúa como Firewall de Aplicaciones Web perimetral inyectando cabeceras de mitigación OWASP:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Content-Security-Policy", "value": "default-src 'self' https://*.supabase.co; img-src 'self' data: https://*.supabase.co; style-src 'self' 'unsafe-inline'; script-src 'self';" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ]
}
```

Confirma con el usuario que la URL de producción carga antes de construir nada más.

**4. Estructura de archivos**
Mantén una estructura clara: `components/`, `pages/`, `assets/`, `hooks/`, `lib/`, `services/` (funciones que leen/escriben en Supabase), `data/` (ejemplos temporales), y `supabase/migrations/`.
Un componente por archivo, nombre igual al componente. Componentes de menos de 150 líneas.
Los componentes no llaman a Supabase directamente, llaman a `src/services/`.
No instales librerías de componentes externas (shadcn, MUI, Chakra) salvo pedido explícito.

**5. Sistema de diseño: reglas duras**
**5.1 Antes de escribir código:** Define y muestra al usuario: Paleta (4-6 colores), Tipografía (Google Fonts, 2 fuentes), Concepto de layout, y Elemento firma. Espera aprobación.
**5.2 Prohibiciones:** Gradiente violeta/azul, fondo crema + serif alto contraste + terracota, fondo negro con acento neón, Inter/Roboto para títulos, emojis como íconos, texto Lorem Ipsum, tarjetas con sombra genérica repetidas 3 veces, animar todo en exceso, y badges tipo "Impulsado por IA".
**5.3 Obligaciones:** Escala tipográfica definida, espaciado con ritmo (múltiplos de 4 u 8), contraste AA mínimo, estados completos (hover, focus, disabled, loading). Toda pantalla que lee de Supabase tiene 3 estados diseñados: cargando, vacío y error. Responsive real (375px, 768px, 1280px). Botones con voz activa.
**5.4 Autocrítica obligatoria:** Revisa contra la especificidad del diseño, copy realista y prohibiciones antes de entregar la pantalla.

**6. Convenciones de código y Mitigación XSS**
Componentes funcionales con hooks, sin clases. Props desestructuradas.
Clases de Tailwind directamente en el JSX.
**Prevención de XSS:** Se declara el entorno DOM como inherentemente hostil. La inyección de HTML almacenado mediante `dangerouslySetInnerHTML` constituye una vulnerabilidad crítica. Es obligatorio utilizar `DOMPurify.sanitize(data)` antes de cualquier mutación del DOM.
Toda llamada a Supabase devuelve `{ data, error }`. Nunca ignores el error.
Estado local con `useState`. Sesión en `AuthContext`. No uses Redux/Zustand sin permiso.
Elimina datos de ejemplo (`src/data/`) cuando la tabla exista. Sin `console.log` final.

**7. Flujo de trabajo**
Entiende el pedido (ambiguo = max 2 preguntas). Propón plan en 3-5 pasos. Construye por partes: SQL/RLS -> estructura -> estilo -> interacciones.
Commit, push y URL de preview tras cada parte.

**8. Qué no hacer**
No agregues funcionalidades no pedidas, no cambies el stack, no toques configuraciones funcionales, no generes más de 1 pantalla por iteración sin aprobación.
**Regla crítica:** No crees tablas sin políticas de seguridad (RLS). Una tabla abierta es un error letal, no un atajo.

**9. Control de versiones y despliegue**
Commit descriptivo por funcionalidad operativa. Trabaja en ramas por funcionalidad (`feature/xxx`) para generar URLs de preview.
Nunca ejecutes `git push --force` o `git reset --hard` sin permiso explícito.

**10. Cuando algo falla y no sale**
Máximo 3 intentos. Si persiste, detente y pide el error completo.
Si funciona local pero falla en Vercel, revisa variables de entorno.
No reescribas un archivo completo para arreglar un bug puntual.

**11. Datos, autenticación, RLS y claves**
**11.1 Tablas:** Archivos SQL numerados en `supabase/migrations/`. Toda tabla lleva `id uuid primary key default gen_random_uuid()` y `created_at`.
**11.2 Seguridad Mandatoria (RLS):** Toda tabla exige `ALTER TABLE "tabla" ENABLE ROW LEVEL SECURITY;` de inmediato.
*   **Prevención BOLA (API1):** Para instrucciones de alteración (`INSERT`, `UPDATE`), debes aplicar simétricamente la cláusula `USING` y la inquebrantable barrera `WITH CHECK` (ej. `WITH CHECK ((select auth.uid()) = user_id)`) para impedir la inyección de registros ajenos.
*   **Aceleración de Caché:** Nunca uses `auth.uid() = user_id` desnudo (causa escaneos secuenciales masivos). Encasilla siempre en un InitPlan: `((select auth.uid()) = user_id)`.
*   **Subconsultas:** Para listados multicliente, convierte invariablemente la búsqueda correlacionada a un formato evaluable en matriz: `USING (tenant_id = ANY(ARRAY(SELECT...)))`.
*   **Funciones Leakproof:** Nunca apliques operaciones de texto transformacionales (ej. `lower()`, `LIKE`) dentro del marco `USING` a menos que estén catalogadas como `STABLE LEAKPROOF`, de lo contrario el optimizador denegará el uso de índices.
**11.3 Autenticación y Botnets:** Usa Supabase Auth (email/password por defecto). Configura Site URL y Redirect URLs. Instruye al usuario a habilitar confirmaciones por correo, protección contra ráfagas (Rate Limits) en el panel, y activar Cloudflare Turnstile/CAPTCHA pasivo en la configuración para mitigar fuerza bruta.
**11.4 Archivos (Storage):** Aplica políticas a la tabla `storage.objects` validando estructuralmente las rutas lógicas. Dictamina que el componente raíz `(storage.foldername(name))[1]` coincida con el identificador UUID de la sesión `(select auth.uid())::text` para garantizar aislamiento absoluto.
**11.5 Procedimientos Remotos (RPC) y Claves:** Prohibido usar claves en archivos frontend. Las variables viven en `.env.local`. Si usas funciones PostgreSQL con el modificador `SECURITY DEFINER` (escalación a superusuario), es imperativo agregar el sufijo `SET search_path = ''` para erradicar el secuestro del entorno de ejecución.

**12. Rutas y navegación**
Para >1 página, instala `react-router-dom`. Define `ProtectedRoute` para redirigir a `/login` si no hay sesión.

**13. Imágenes e íconos**
Usa `lucide-react`. Sin emojis. Servicios de placeholder realistas. Toda imagen lleva `alt` descriptivo.

**14. Trabajo con specs (Kiro)**
Para lógicas no triviales: `requirements.md`, `design.md`, `tasks.md`. Avanza secuencialmente.

**15. Checklist de entrega por pantalla**
Antes de entregar, verifica estrictamente:
1. Build en Vercel correcto. URL de preview carga sin errores.
2. Responsive (375, 768, 1280).
3. Estados interactivos, cargando, vacío, error existen.
4. Copy real, no genérico.
5. Pasó autocrítica de UI (5.4).
6. Imágenes con alt, íconos de Lucide.
7. **Nueva Validación de Seguridad:** Cada tabla nueva tiene RLS activo usando subconsultas de materialización `(select auth.uid())` y fue probada con 2 usuarios.
8. **Prevención XSS verificada:** `DOMPurify` activo, sin `dangerouslySetInnerHTML` desnudos.
9. Variables de entorno en Vercel, repositorio sin secretos. No se usó `service_role`.
10. `vercel.json` implementa cabeceras CSP y de seguridad.
11. Commit documentado en GitHub listo.