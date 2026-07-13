# PROJECT_CONTEXT.md — Growth Link

> Documento de contexto completo generado el 2026-07-08 para permitir continuar el desarrollo desde otra cuenta de Claude, otra computadora, o con otro desarrollador, sin acceso al historial de conversación previo. Generado por análisis del código real del repositorio — no es una copia del historial de chat.
>
> **No contiene secretos ni claves privadas.** Los valores reales de variables de entorno viven en `.env.local` (gitignored) y no se incluyen aquí.

---

## 1. Nombre del proyecto

**Growth Link**

Repositorio local: `d:\growthlink\codigo` (Windows). Nombre interno del paquete npm: `codigo` (`package.json`).

---

## 2. Objetivo del proyecto

Growth Link **no es solo un CRM** — es una **plataforma SaaS multi-tenant tipo "WhatsApp Web para equipos"**: un núcleo compartido (workspaces, contactos, inbox conversacional de WhatsApp, motor de agentes de IA con *handoff* a humano, pipeline genérico, calendario, integraciones) sobre el que se activan **módulos verticales por workspace**:

- **CRM / Sales-Support** (`module_key = 'crm'`): oportunidades de venta sobre el pipeline genérico.
- **ATS / Reclutamiento** (`module_key = 'ats'`): vacantes, candidatos (extensión de contactos), pipeline de reclutamiento.
- Futuros módulos verticales podrán agregarse sin duplicar el núcleo.

Cada empresa cliente es un **workspace** aislado (multi-tenancy por columna `workspace_id` + Row Level Security de Postgres, no schema-per-tenant). Cada módulo se activa/desactiva por workspace vía la tabla `workspace_modules`.

**Fuente de verdad del producto**: [docs/blueprint/](docs/blueprint/) — empezar por [docs/blueprint/MASTER_BLUEPRINT.md](docs/blueprint/MASTER_BLUEPRINT.md) (índice + resumen ejecutivo que enlaza los 15 documentos detallados `00`–`14`). **Cualquier cambio de arquitectura, entidades o límites de módulo debe alinearse con esos documentos** — son el contrato de diseño del proyecto, mantenido independientemente del código.

---

## 3. Descripción general de la aplicación

- App web Next.js (App Router) con autenticación completa, arquitectura multi-tenant desde el día uno, y tres módulos de producto funcionales hoy: **Dashboard**, **CRM** (Kanban de ventas) e **Inbox** (bandeja conversacional) y **ATS** (Kanban de reclutamiento).
- Backend 100% Supabase: Postgres (con RLS como mecanismo primario de aislamiento multi-tenant), Auth, Realtime (usado en el Inbox), sin servidor propio fuera de Vercel + Supabase.
- Diseño visual propio ("Growth Link Design System"): tokens de color/radio/elevación/movimiento implementados como CSS custom properties reales en `src/app/globals.css` (Tailwind v4 `@theme`), no solo documentados. Estética minimalista inspirada en Linear/Vercel/Intercom/Notion/Stripe, con soporte dark/light completo.
- Todavía **no hay integración real de WhatsApp** (YCloud) ni de IA (OpenRouter) ni de HighLevel — el Inbox y el ATS funcionan hoy en modo lectura/gestión sobre datos reales de Supabase (sembrados vía script), a la espera de que se conecten esas credenciales.

---

## 4. Stack tecnológico utilizado

| Capa | Tecnología | Versión (ver `package.json`) |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.10 |
| Lenguaje | TypeScript (`strict: true`) | ^5 |
| UI | React | 19.2.4 |
| Estilos | Tailwind CSS v4 (`@tailwindcss/postcss`) | ^4 |
| Backend / DB | Supabase (Postgres + Auth + Realtime) | `@supabase/ssr` ^0.12.0, `@supabase/supabase-js` ^2.110.0 |
| Drag-and-drop | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | ^6 / ^10 / ^3 |
| Gráficos | `recharts` | ^3.9.2 |
| Notificaciones toast | `sonner` | ^2.0.7 |
| Iconos | `lucide-react` | ^1.23.0 |
| Lint | ESLint 9 (flat config, `eslint-config-next`) | ^9 |
| Despliegue objetivo | Vercel (zero-config, sin `vercel.json` propio) | — |

**Integraciones de producto planeadas pero NO conectadas todavía**: YCloud (WhatsApp Business Solution Provider), OpenRouter (gateway LLM para el motor de IA), HighLevel (CRM/calendario externo). No hay ninguna variable de entorno de estas en `.env.local` — ver sección 15.

---

## 5. Arquitectura del proyecto

### 5.1 Patrón general

- **Next.js App Router** con Server Components por defecto; Client Components (`"use client"`) solo donde hace falta interactividad (formularios, drag-and-drop, tabs, realtime).
- **Server Actions** (`"use server"`) como capa de escritura — no hay API routes REST propias para CRUD de negocio (sí existe un único Route Handler: `src/app/auth/callback/route.ts`, para el intercambio de código OAuth/PKCE de Supabase Auth).
- **Multi-tenancy**: cada tabla de negocio tiene columna `workspace_id`. El workspace activo se resuelve vía cookie httpOnly (`gl_active_workspace`), pero **nunca se confía en la cookie a ciegas** — cada carga de página protegida re-valida que el usuario pertenece a ese workspace contra `workspace_members` (ver `src/lib/auth/session.ts`).
- **RLS como defensa primaria**: cada tabla tiene Row Level Security habilitado con policies separadas por comando (`select`/`insert`/`update`/`delete`), usando funciones `SECURITY DEFINER` auxiliares en el schema `core` (`core.is_workspace_member(workspace_id)`, `core.has_workspace_role(workspace_id, roles[])`) con `search_path = ''` fijo (mitigación de *search_path hijacking*).
- **Defensa en profundidad en Server Actions**: además de RLS, varias Server Actions re-validan explícitamente que el recurso pertenece al workspace activo antes de escribir (ver `moveOpportunityCard` en `src/lib/crm/actions.ts` y su equivalente `moveCandidateCard` en ATS) — RLS ya lo impediría, pero fallar rápido con un mensaje claro es más seguro que depender solo de RLS silenciosamente.
- **Pipeline genérico reutilizado por CRM y ATS**: las tablas `pipelines`/`pipeline_stages`/`pipeline_items` no pertenecen a ningún módulo — CRM las usa con un único pipeline global por workspace (`opportunities`); ATS las usa con **un pipeline propio por vacante** (`vacancies.pipeline_id`). El componente de tablero Kanban (`src/components/kanban/KanbanBoard.tsx`) también es genérico y compartido entre ambos módulos.
- **Activación de módulos**: `workspace_modules(workspace_id, module_key, enabled)` decide si el Sidebar muestra CRM/ATS como habilitado o como "Pronto" (`comingSoon`). El Inbox y el Dashboard son núcleo — siempre visibles, no dependen de `workspace_modules`.

### 5.2 Los tres clientes de Supabase (patrón obligatorio, no romper)

`@supabase/ssr` requiere tres constructores de cliente separados, cada uno scoped a su contexto de ejecución:

- [src/lib/supabase/client.ts](src/lib/supabase/client.ts) — cliente de navegador (`createBrowserClient`), para Client Components. Usado también para las suscripciones Realtime del Inbox.
- [src/lib/supabase/server.ts](src/lib/supabase/server.ts) — cliente de servidor (`createServerClient` + cookies de `next/headers`), para Server Components/Actions/Route Handlers.
- [src/lib/supabase/middleware.ts](src/lib/supabase/middleware.ts) — `updateSession()`, usado por [src/middleware.ts](src/middleware.ts) para refrescar el token de auth en cada request y mantener las cookies de sesión sincronizadas entre Server Components, Client Components y middleware.
- [src/lib/supabase/service-role.ts](src/lib/supabase/service-role.ts) — cliente con `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS), pensado para operaciones admin/backend (ej. futuros webhook handlers de YCloud). **Nunca exponer al navegador.**

**No leer/escribir cookies de auth de Supabase manualmente fuera de estos helpers.**

### 5.3 Middleware — nota importante

[src/middleware.ts](src/middleware.ts) redirige a `/login` solo para las rutas listadas en `PROTECTED_PREFIXES` (`/dashboard`, `/select-workspace`, `/reset-password`) — **no incluye `/crm`, `/inbox` ni `/ats`**. Esas rutas igual están protegidas porque cada una llama `requireActiveWorkspace()` server-side (que a su vez llama `requireUser()` y redirige a `/login` si no hay sesión), pero el guard de middleware no las cubre explícitamente. No es un agujero de seguridad (la protección real está en el Server Component), pero es una inconsistencia a tener en cuenta si se toca el middleware.

---

## 6. Estructura de carpetas explicada

```
d:\growthlink\codigo\
├── docs/blueprint/          Fuente de verdad del producto — 15 documentos (00–14) + índice
│                             MASTER_BLUEPRINT.md. LEER ANTES de planificar cualquier feature.
├── supabase/
│   ├── migrations/          4 migraciones SQL aplicadas al proyecto real (ver sección 13)
│   └── seed.sql             Script de datos de demostración (contactos, conversaciones,
│                             pipeline CRM, tags, vacantes ATS) — ver sección 13.4
├── src/
│   ├── app/
│   │   ├── (auth)/          Rutas públicas de autenticación (grupo de rutas, no afecta URL)
│   │   ├── (protected)/     Rutas que requieren sesión + workspace activo
│   │   ├── auth/callback/   Route Handler: intercambio de código OAuth/PKCE de Supabase
│   │   ├── layout.tsx       Layout raíz (fuentes Geist, ThemeProvider)
│   │   ├── globals.css      Design system completo como tokens CSS reales (Tailwind v4 @theme)
│   │   └── page.tsx / not-found.tsx
│   ├── components/
│   │   ├── auth/            AuthCard, OAuthButton (stub), SessionLoadingScreen
│   │   ├── brand/            Logo
│   │   ├── kanban/           KanbanBoard genérico (compartido entre CRM y ATS)
│   │   ├── layout/            Sidebar, Navbar, MobileNav, UserMenu
│   │   ├── toast/             Wrapper sobre sonner
│   │   └── ui/                 Kit de primitivos: Button, Input, PasswordInput, Badge, Skeleton,
│   │                            EmptyState, LinkButton, Spinner, Card, Tabs, Avatar, Sheet, Select
│   ├── lib/
│   │   ├── auth/               session.ts (requireUser/requireActiveWorkspace/getUserWorkspaces),
│   │   │                       workspace-cookie.ts, provision-workspace.ts, validation.ts,
│   │   │                       error-messages.ts, oauth-providers.ts (stub, sin proveedores activos)
│   │   ├── supabase/           Los 4 clientes (ver 5.2)
│   │   ├── theme/              ThemeProvider (useSyncExternalStore), ThemeToggle, script.ts
│   │   ├── dashboard/           queries.ts
│   │   ├── crm/                  queries.ts, actions.ts
│   │   ├── inbox/                queries.ts, actions.ts
│   │   ├── ats/                   queries.ts, actions.ts
│   │   └── utils/                  cn.ts (helper de clases, NO es clsx/twMerge — ver 12)
│   └── middleware.ts
├── package.json / tsconfig.json / next.config.ts / postcss.config.mjs / eslint.config.mjs
├── .mcp.json                 Config de MCP servers (supabase, context7) — usa `${VAR}` de entorno
├── .env.local.example        Plantilla de variables de entorno (sin valores)
└── CLAUDE.md                 Instrucciones para Claude Code — leer junto con este documento
```

### Grupos de rutas de `src/app/`

- `(auth)`: no requiere sesión (o requiere *no* tener sesión activa para algunas). No agrega segmento a la URL.
- `(protected)`: requiere sesión + workspace activo válido. Su `layout.tsx` obtiene el usuario, valida workspaces, redirige a `/select-workspace` si hace falta, y renderiza `Sidebar`/`Navbar` con los módulos habilitados.

---

## 7. Funcionalidades actuales (terminadas y verificadas)

Todo lo listado abajo fue **verificado en navegador real** (Playwright + Chromium contra el dev server o `next start`, no solo build/lint) durante el desarrollo, incluyendo revisión de errores de consola.

### 7.1 Autenticación y multi-tenancy (núcleo)
- Registro, login, logout, recuperación de contraseña (forgot/reset), confirmación de email, selección de workspace.
- Auto-aprovisionamiento de un workspace por defecto al registrarse (`provisionDefaultWorkspaceIfNeeded`, con reintento desde `/select-workspace` si el primer intento falla — ver sección 14).
- Resolución de workspace activo vía cookie httpOnly, siempre re-validada server-side contra `workspace_members`.
- Roles por workspace: `owner`, `admin`, `agent`, `viewer` (columna `role` en `workspace_members`), usados en las policies de RLS.

### 7.2 Dashboard (`/dashboard`)
- KPIs reales: leads hoy/ayer, conversaciones activas/no leídas/esperando, reuniones hoy + próxima reunión, ventas del mes, tasa de conversión.
- Gráfico de actividad (recharts, área con gradiente) con toggle Hoy/7 días/30 días/90 días.
- Panel de últimas conversaciones y panel de tareas pendientes (marcar completada = Server Action con actualización optimista vía `useOptimistic`).

### 7.3 CRM (`/crm`)
- Tablero Kanban de un único pipeline de ventas por workspace, 8 etapas (Nuevo, Contactado, Interesado, Reunión, Propuesta, Negociación, Ganado, Perdido).
- Drag-and-drop persistente (confirmado con recarga de página).
- Panel de detalle de oportunidad (`Sheet` lateral) con tabs: Resumen, Notas (funcional), Historial (funcional), Conversaciones/Archivos/Emails/WhatsApp/IA (deshabilitados, "Pronto").
- **Gap conocido, no bloqueante**: `OpportunityCard.ownerName` siempre es `null` — el dato nunca se resolvió porque no hay ningún elemento de UI que lo muestre todavía. La función `public.workspace_member_names` (ver 7.4) podría resolverlo si se agrega esa UI.

### 7.4 Inbox (`/inbox`) — modo lectura/gestión, sin envío real
- Lista de conversaciones con búsqueda (contacto/teléfono/empresa) y filtro por estado (Abiertas/Esperando/Cerradas).
- Hilo de mensajes completo, con burbujas por dirección/remitente.
- **Supabase Realtime** (primer uso en el proyecto): la lista y el hilo abierto se actualizan solos ante cambios en `conversations`/`messages`, sin recargar la página. Verificado insertando un mensaje directo en la base mientras la página estaba abierta.
- Panel de detalle del contacto: cambio de estado de conversación, asignación de responsable (resuelto vía `public.workspace_member_names`, ver 12), etiquetas (tabla `tags`/`contact_tags`, toggle en vivo), notas internas.
- **Deliberadamente sin composer de envío**: no hay credenciales de YCloud configuradas, así que no se construyó un botón de "enviar" que solo escribiera en la base (violaría la regla del Blueprint de que todo envío pasa por el adapter YCloud). Aviso visible en la UI: "WhatsApp todavía no está conectado".

### 7.5 ATS (`/ats`, `/ats/[vacancyId]`)
- Listado de vacantes con alta rápida (formulario en `Sheet`: título, departamento, ubicación).
- Al crear una vacante se crea atómicamente su propio `pipelines` (`module_key='ats'`) + 6 `pipeline_stages` por defecto (Aplicó, Preclasificado, Entrevista, Oferta, Contratado, Rechazado).
- Tablero Kanban por vacante (`/ats/[vacancyId]`, **primera ruta dinámica del proyecto**), reutilizando el mismo componente genérico que el CRM.
- Alta de candidato desde el tablero: crea/reutiliza el contacto por teléfono, crea/reutiliza su fila 1:1 en `candidates`, crea la `candidate_applications` y su `pipeline_item` en la primera etapa.
- Panel de detalle del candidato con notas, mismo patrón que CRM/Inbox.
- **Deliberadamente fuera de alcance**: entrevistas, evaluaciones, CV/adjuntos (necesita Supabase Storage, no configurado), IA de preclasificación (necesita el Agent Engine, no construido). Tabs "Pronto" en el panel de detalle.

### 7.6 Diseño / theming
- Dark/light mode con toggle, persistido, sin *hydration mismatch* (resuelto con `useSyncExternalStore`, ver 14).
- Sidebar colapsable (persistido igual que el tema).
- Responsive verificado explícitamente en mobile (390px) para las cuatro secciones de producto.

---

## 8. Componentes importantes

### 8.1 Kit de UI (`src/components/ui/`) — reusar antes de crear nuevos
`Button`, `Input`, `PasswordInput`, `Badge` (variantes: `neutral|accent|success|warning|error`), `Skeleton`, `EmptyState`, `LinkButton`, `Spinner`, `Card` (variantes `default|contrast`), `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` (compound component controlado, subrayado accent, sin estilo pill), `Avatar`/`AvatarStack` (iniciales + color determinístico por nombre), `Sheet` (panel lateral deslizante, Escape para cerrar), `Select` (wrapper nativo sobre `<select>` con estilos del design system).

### 8.2 Kanban genérico (`src/components/kanban/KanbanBoard.tsx`)
Extraído del tablero del CRM durante la construcción de ATS para no duplicar la orquestación de `@dnd-kit` (sensors, `onDragOver`/`onDragEnd`, `DragOverlay`). Genérico sobre un tipo `T extends KanbanCardBase` (`{ pipelineItemId, stageId, position }`), parametrizado por `renderCard`, `onOpenCard`, `onMove`, `columnFooter` opcional. **Tanto `src/app/(protected)/crm/KanbanBoard.tsx` como `src/app/(protected)/ats/[vacancyId]/VacancyBoardView.tsx` son wrappers delgados sobre este componente.** Cualquier futuro módulo con pipeline (ej. un pipeline de postventa) debería reusar este componente en vez de reimplementar drag-and-drop.

### 8.3 Layout
`Sidebar` (`getNavItems(enabledModules)` decide qué módulos mostrar habilitados vs. "Pronto"), `Navbar`, `MobileNav`, `UserMenu`.

### 8.4 Sheets de detalle (patrón repetido 3 veces)
`CardDetailSheet` (CRM), `ContactInfoPanel`+`InboxShell` (Inbox), `CandidateDetailSheet` (ATS) — todos siguen el mismo patrón: `Tabs` con Resumen/Notas/Historial funcionales + tabs adicionales deshabilitados "Pronto", remount vía `key={id ?? "closed"}` en vez de reset manual de estado en `useEffect` (evita el error de lint `react-hooks/set-state-in-effect`, ver sección 14).

---

## 9. Páginas existentes

| Página | Ruta | Grupo | Requiere sesión |
|---|---|---|---|
| Home | `/` | — | No (redirige según sesión) |
| Login | `/login` | `(auth)` | No (solo invitados) |
| Registro | `/register` | `(auth)` | No (solo invitados) |
| Olvidé mi contraseña | `/forgot-password` | `(auth)` | No (solo invitados) |
| Resetear contraseña | `/reset-password` | `(auth)` | Sí (token de recovery) |
| Confirmar email | `/confirm-email` | `(auth)` | No |
| Acceso denegado | `/access-denied` | `(auth)` | — |
| Seleccionar workspace | `/select-workspace` | `(auth)` | Sí |
| Dashboard | `/dashboard` | `(protected)` | Sí |
| CRM | `/crm` | `(protected)` | Sí + módulo `crm` habilitado |
| Inbox | `/inbox` | `(protected)` | Sí (núcleo, sin gating por módulo) |
| ATS — vacantes | `/ats` | `(protected)` | Sí + módulo `ats` habilitado |
| ATS — tablero de vacante | `/ats/[vacancyId]` | `(protected)` | Sí + módulo `ats` habilitado |
| Callback de Auth | `/auth/callback` | — (Route Handler) | — |
| 404 | (cualquier ruta no encontrada) | — | — |

---

## 10. Rutas creadas (resumen técnico)

Todas las páginas de `(protected)` usan Server Components async que llaman `requireActiveWorkspace()` primero. `/ats/[vacancyId]/page.tsx` es la única ruta con segmento dinámico (`params: Promise<{ vacancyId: string }>`, patrón de Next.js 15+/16 donde `params` debe *awaitearse*). El único Route Handler real es `src/app/auth/callback/route.ts` (intercambio de código PKCE).

---

## 11. Lógica principal del sistema

### 11.1 Flujo de autenticación y workspace
1. Usuario se registra/loguea vía Server Action (`src/app/(auth)/login|register/actions.ts`).
2. `provisionDefaultWorkspaceIfNeeded()` (`src/lib/auth/provision-workspace.ts`) crea un workspace + membership `owner` si el usuario no tiene ninguno.
3. `(protected)/layout.tsx` obtiene `workspaces` del usuario, resuelve la cookie `gl_active_workspace`, redirige a `/select-workspace` si no hay coincidencia válida.
4. Cada página protegida vuelve a llamar `requireActiveWorkspace()` (no confía en que el layout ya lo validó) para obtener `{ workspaceId, role }` y hacer sus queries.

### 11.2 Patrón de datos por módulo (repetido en dashboard/crm/inbox/ats)
- `src/lib/<módulo>/queries.ts`: funciones `async` `server-only`, reciben `workspaceId` explícito, filtran **siempre** por `.eq("workspace_id", workspaceId)` además de confiar en RLS (defensa en profundidad — un usuario podría pertenecer a más de un workspace en el futuro).
- `src/lib/<módulo>/actions.ts`: Server Actions `"use server"` que llaman `requireActiveWorkspace()`, ejecutan la escritura, y llaman `revalidatePath("/<módulo>")`.
- Los componentes cliente llaman estas Server Actions directamente (no hay una capa de API REST intermedia) y en varios casos also hacen su propio refetch explícito tras la mutación (patrón usado en CardDetailSheet/ContactInfoPanel/CandidateDetailSheet) en vez de depender solo de `revalidatePath`.

### 11.3 Buffer/pipeline genérico
`pipelines` → `pipeline_stages` → `pipeline_items` (`item_type` + `item_id` apuntan polimórficamente a `opportunities` o `candidate_applications`). Mover una tarjeta = actualizar `stage_id`/`position` en `pipeline_items`.

### 11.4 Realtime (Inbox)
`src/lib/supabase/client.ts` se usa para abrir canales `supabase.channel(...).on("postgres_changes", ...)` dentro de un `useEffect` normal (el `setState` ocurre en el callback asíncrono del canal, no en el cuerpo del efecto — así se evita el error de lint `react-hooks/set-state-in-effect`). RLS aplica también a las suscripciones Realtime, así que no hace falta lógica de autorización adicional del lado cliente.

---

## 12. Integraciones utilizadas

| Integración | Estado | Notas |
|---|---|---|
| **Supabase** (Auth + Postgres + Realtime) | ✅ Conectado y en uso activo | Proyecto real `hfcagkwqefilifprthau`. Ver sección 13. |
| **Supabase MCP** (`@supabase/mcp-server-supabase`) | ✅ Configurado en `.mcp.json`, con historial de inestabilidad ocasional en esta máquina — cuando falla, usar la Management API directamente vía `curl` a `https://api.supabase.com/v1/projects/{ref}/database/query` con `Authorization: Bearer $SUPABASE_ACCESS_TOKEN` como fallback. | — |
| **Context7 MCP** (`@upstash/context7-mcp`) | ✅ Configurado para lookup de documentación de librerías actualizada | Instalado como devDependency para que el binario esté disponible localmente. |
| **YCloud** (WhatsApp BSP) | ❌ No conectado | Sin variables de entorno, sin webhook, sin adapter. Documentado como bloqueante explícito para el composer de envío del Inbox. |
| **OpenRouter** (gateway LLM) | ❌ No conectado | El "Agent Engine" ([13-agent-engine.md](docs/blueprint/13-agent-engine.md)) está especificado pero no implementado. |
| **HighLevel** (CRM/calendario externo) | ❌ No conectado | Especificado en [08-integrations.md](docs/blueprint/08-integrations.md), sin implementar. |

**Nota importante sobre `core` vs `public` schema (gotcha real, ya cazado una vez)**: las funciones `SECURITY DEFINER` de solo-RLS (`core.is_workspace_member`, `core.has_workspace_role`) viven en el schema `core` y **no son invocables vía `supabase.rpc()`** porque PostgREST solo expone `public` por defecto. Cualquier función pensada para llamarse desde el cliente (como `public.workspace_member_names`, usada por el Inbox para resolver nombres de miembros) debe vivir en `public`, no en `core`.

---

## 13. Configuración de Supabase

- **Proyecto**: ref `hfcagkwqefilifprthau`, organización `growthlinkteam-lgtm's Project`, región us-west-2.
- **URL del proyecto**: `https://hfcagkwqefilifprthau.supabase.co` (no es secreto, es pública — se usa como `NEXT_PUBLIC_SUPABASE_URL`).
- **Auth**: email/password habilitado y en uso. Hay un stub de botones OAuth en la UI (`src/components/auth/OAuthButton.tsx`, `src/lib/auth/oauth-providers.ts`) pero **ningún proveedor OAuth está configurado todavía** — son visualmente presentes pero no funcionales.
- **Advisories de seguridad activos ahora mismo** (`get_advisors`, revisar antes de la próxima sesión):
  1. `public.workspace_member_names` es `SECURITY DEFINER` y ejecutable por el rol `anon` (sin sesión) — la función ya valida internamente `core.is_workspace_member(ws_id)` así que un `anon` no autenticado no puede obtener datos reales de ningún workspace, pero el linter lo marca igual porque el `EXECUTE` está abierto. Revisar si conviene restringir el grant solo a `authenticated`.
  2. **Leaked Password Protection está deshabilitado** en Supabase Auth (chequeo contra HaveIBeenPwned) — se puede habilitar desde el dashboard, Authentication → Policies. Recomendado activarlo.
- **Hallazgo pendiente de que el usuario lo corrija en el dashboard**: la URL de redirect configurada en Authentication → URL Configuration para `/auth/callback` parece tener un typo (falta la última letra, `callbac` en vez de `callback`) — descubierto reproduciblemente generando magic links de administrador. Es la causa más probable de un bug de registro real ya ocurrido ("no encontraron mi workspace"). Ver `.claude` memory `supabase-redirect-url-truncated.md` si está disponible, o simplemente revisar esa pantalla del dashboard.

### 13.1 Migraciones aplicadas (`supabase/migrations/`, en orden)
1. **`0001_workspaces_and_members.sql`** — `workspaces`, `workspace_members` (roles `owner|admin|agent|viewer`), schema `core` + funciones `is_workspace_member`/`has_workspace_role`, RLS base.
2. **`0002_crm_and_dashboard.sql`** — `workspace_modules`, `contacts` (incluye `company`, `whatsapp_opt_status`), `conversations`, `messages`, `pipelines`/`pipeline_stages`/`pipeline_items` (genérico), `opportunities`, `bookings`, `notes` (polimórfica), `tasks` (agregada más allá del Blueprint original, justificada inline en el archivo y en `02-database.md`), índices, RLS completa.
3. **`0003_inbox.sql`** — `tags`, `contact_tags`, función `public.workspace_member_names(ws_id)`, agrega `conversations`+`messages` a la publicación `supabase_realtime`.
4. **`0004_ats.sql`** — `vacancies`, `candidates` (1:1 con `contacts`), `candidate_applications`. **No incluye** `interviews`/`evaluations` (deliberadamente diferido, nada las usa todavía).

Aplicar migraciones nuevas vía Supabase MCP (`apply_migration`) o, si el MCP está inestable, vía `curl` directo a la Management API (ver sección 12).

### 13.2 Cómo migrar/replicar el proyecto de Supabase si hiciera falta
1. Crear un nuevo proyecto Supabase (o reusar uno existente).
2. Aplicar las 4 migraciones de `supabase/migrations/` **en orden**.
3. Completar `.env.local` con las credenciales del nuevo proyecto (ver sección 15).
4. Opcionalmente correr `supabase/seed.sql` contra el workspace del primer usuario que se registre (ver 13.4 — **no es 100% idempotente**, leer los comentarios del propio archivo antes de re-ejecutarlo).
5. Actualizar `--project-ref` en `.mcp.json` si se usa el Supabase MCP.

### 13.3 Row Level Security — patrón usado en las 4 migraciones
- Policies **separadas por comando** (`select`/`insert`/`update`/`delete`), nunca una única policy `for all` salvo cuando el scoping es idéntico para todos los comandos (ej. `pipeline_stages_write`, `contact_tags_write`).
- Patrón estándar de escritura: `owner|admin|agent` pueden insertar/actualizar, `owner|admin` pueden borrar, cualquier miembro puede leer.
- Tablas cuyo `workspace_id` no es una columna propia (ej. `pipeline_stages`, `pipeline_items`, `contact_tags`) se scopean vía `exists (select 1 from <tabla_padre> where ... and core.is_workspace_member(...))`.

### 13.4 `supabase/seed.sql` — datos de demostración
Script `do $$ ... $$` que siembra: 15 contactos/conversaciones/mensajes (CRM), pipeline de ventas completo con 8 etapas + oportunidades distribuidas, 5 tags + asignaciones (Inbox), 2 vacantes ATS con 6 etapas cada una + 8 candidatos distribuidos. **Apunta específicamente al workspace de `alancitofeck@gmail.com`** (con fallback a "workspace más antiguo" si ese email no existe en el entorno) — no es un seed genérico reusable sin editar ese email. Partes idempotentes (contactos por teléfono, pipeline/etapas si ya existen, tags, candidatos por `contact_id`) conviven con partes **no idempotentes** (conversaciones, mensajes, bookings, tareas sueltas — re-ejecutar el script completo las duplica). Para aplicar solo una porción sin duplicar el resto, seguir el patrón usado durante esta sesión: extraer un bloque `do $$ ... $$` standalone con el mismo lookup de workspace y solo la parte nueva.

---

## 14. Tablas creadas y relación entre datos

### 14.1 Núcleo
```
workspaces
  └─< workspace_members (role: owner|admin|agent|viewer)
  └─< workspace_modules (module_key: 'crm'|'ats', enabled)
  └─< contacts (whatsapp_opt_status, company, source, custom_fields jsonb)
        └─< conversations (status: open|pending_human|closed; mode: human|ai|hybrid; assigned_user_id → workspace_members)
              └─< messages (direction: inbound|outbound; sender_type: contact|agent|ai|system; content jsonb)
        └─< contact_tags >─┤
                            ├─ tags (name, color)
        └─(1:1)─ candidates (source) [módulo ATS]
  └─< notes (polimórfica: notable_type + notable_id → conversation|opportunity|candidate_application)
  └─< tasks (polimórfica opcional: related_type + related_id; usada por Dashboard y CRM "próxima actividad")
  └─< bookings (provider: internal|highlevel)
  └─< pipelines (module_key: 'crm'|'ats')
        └─< pipeline_stages (position, is_won, is_lost)
        └─< pipeline_items (item_type: 'opportunity'|'candidate_application', item_id → fila del módulo, stage_id, position)
```

### 14.2 Módulo CRM
```
opportunities (workspace_id, contact_id, pipeline_item_id, value, currency, owner_id → workspace_members, status)
```

### 14.3 Módulo ATS
```
vacancies (workspace_id, title, department, location, status: open|paused|closed, pipeline_id → pipelines)
candidates (workspace_id, contact_id UNIQUE — 1:1, resume_attachment_id [FK lógica, tabla attachments no existe], source)
candidate_applications (workspace_id, vacancy_id, candidate_id, pipeline_item_id, status, applied_at) UNIQUE(vacancy_id, candidate_id)
```

### 14.4 Tablas especificadas en el Blueprint pero **NO migradas todavía**
Estas existen en [docs/blueprint/02-database.md](docs/blueprint/02-database.md) como diseño completo, pero no tienen migración aplicada — construirlas cuando el trabajo correspondiente lo requiera, no antes:
- `conversation_buffers` (Buffer Inteligente del Inbox — necesita `pg_cron` + credenciales YCloud reales para tener sentido).
- `attachments` (CV, archivos adjuntos — necesita un bucket de Supabase Storage).
- `integration_connections`, `webhook_events` (necesarias recién cuando se conecte YCloud/HighLevel).
- `interviews`, `evaluations` (módulo ATS — la decisión de si usan `bookings.provider='internal'` o `'highlevel'` por defecto está marcada en el propio Blueprint como "⚠️ a confirmar con el usuario", sin resolver).
- `ai_prompts`, `tools`/`agent_tools`, `usage_events`, `workspace_quotas`, `audit_log` (Agent Engine y gobernanza — fase futura).

### 14.5 Funciones SQL auxiliares
- `core.is_workspace_member(workspace_id uuid) returns boolean` — usada en casi todas las policies de `select`.
- `core.has_workspace_role(workspace_id uuid, roles text[]) returns boolean` — usada en policies de escritura.
- `public.workspace_member_names(ws_id uuid) returns table(member_id, user_id, full_name, email)` — resuelve nombres de miembros leyendo `auth.users` (que el cliente no puede leer directo); vive en `public` (no en `core`) para ser invocable vía `supabase.rpc()`.

---

## 15. Variables de entorno necesarias (sin valores)

Definidas en `.env.local` (gitignored, nunca commitear). Plantilla real en [.env.local.example](.env.local.example):

| Variable | Dónde se usa | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente y servidor | Pública, va al navegador |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente y servidor | Pública (clave `anon`/`publishable`), respeta RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor (`src/lib/supabase/service-role.ts`) | **Nunca exponer al navegador ni prefijar con `NEXT_PUBLIC_`** — bypassa RLS |

Variables de entorno **de shell** (no van en `.env.local`, las usa el propio Claude Code / tooling):
- `SUPABASE_ACCESS_TOKEN` — token personal de Supabase, usado por el MCP server y por los fallbacks de `curl` a la Management API.
- `CONTEXT7_API_KEY` — opcional, para límites más altos en el MCP de Context7.

Variables **todavía no necesarias** (features no conectadas): cualquier `YCLOUD_*`, `OPENROUTER_*`, `HIGHLEVEL_*` — no existen en este momento porque esas integraciones no están conectadas.

---

## 16. Paquetes instalados y para qué sirven

### Dependencias de producción
| Paquete | Para qué se usa |
|---|---|
| `next` | Framework (App Router, Server Actions, Route Handlers) |
| `react` / `react-dom` | UI |
| `@supabase/ssr` | Los 3 clientes de Supabase con cookies sincronizadas (browser/server/middleware) |
| `@supabase/supabase-js` | Cliente base de Supabase (usado por `@supabase/ssr` y directamente en `service-role.ts`) |
| `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | Drag-and-drop del Kanban genérico (CRM y ATS) |
| `recharts` | Gráfico de actividad del Dashboard |
| `sonner` | Sistema de notificaciones toast |
| `lucide-react` | Iconos (atención: algunos nombres cambiaron entre versiones — ver sección 17) |

### Dependencias de desarrollo
| Paquete | Para qué se usa |
|---|---|
| `typescript` | Tipado estático, modo `strict` |
| `@types/node`, `@types/react`, `@types/react-dom` | Tipos |
| `tailwindcss`, `@tailwindcss/postcss` | Estilos (Tailwind v4, config CSS-first, no `tailwind.config.js`) |
| `eslint`, `eslint-config-next` | Lint (flat config en `eslint.config.mjs`) |
| `@upstash/context7-mcp` | Binario del MCP server de Context7 disponible localmente sin fetch de red |

No hay ningún framework de testing configurado (`no test runner configured yet`, confirmado en `CLAUDE.md`).

---

## 17. Problemas solucionados (relevantes para no repetir el diagnóstico)

1. **Referencia circular en `globals.css`**: tokens de tema auto-referenciados dentro de `@theme inline` crasheaban Turbopack. Solución: tokens invariantes por tema van en `@theme` plano; el patrón `:root` + `@theme inline` solo se usa para tokens que realmente cambian entre light/dark.
2. **Renombres de iconos en `lucide-react`**: `Loader2`→`LoaderCircle`, `KanbanSquare`→`Kanban` (en algunos usos), `UserSquare2`→`SquareUser`, `AlertTriangle`→`TriangleAlert`; `Chrome`/`Github` (iconos de marca) fueron **removidos** de la versión instalada — los stubs de OAuth usan iconos neutros (`Mail`, `Terminal`, `AppWindow`) en su lugar. Si un ícono no se encuentra, grepear `node_modules/lucide-react/dist/lucide-react.d.ts` antes de asumir el nombre.
3. **`react-hooks/set-state-in-effect` (ESLint)**: apareció repetidamente (ThemeProvider, Sidebar colapsado, todos los `*DetailSheet`). Soluciones usadas: `useSyncExternalStore` (para estado sincronizado con el DOM/`localStorage`/`matchMedia`), o remount vía `key={id ?? "closed"}` (para resetear estado de un componente hijo en vez de resetearlo manualmente en un efecto).
4. **Hydration mismatch real** (no solo de lint) en el `ThemeToggle`: el servidor asumía siempre "light", el cliente leía `matchMedia` de inmediato — corregido con `useSyncExternalStore` cuyo `getServerSnapshot` siempre devuelve "light" y `getSnapshot` lee el DOM/media query real.
5. **`core` vs `public` schema para funciones RPC**: ver sección 12 — una función pensada para `supabase.rpc()` debe vivir en `public`, no en `core` (PostgREST no expone `core` por defecto).
6. **Crasheo nativo intermitente de `next dev` en esta máquina Windows** (código de salida `0xC0000142`): no es un bug de código — reproducido incluso con builds de producción limpios. Afecta tanto a Turbopack como a los workers de compilación de Webpack, y en un caso incluso a `npm run build`. **No es determinístico**: reintentar (o limpiar `.next/` y reiniciar) suele resolverlo. Si no se resuelve tras 1–2 reintentos en modo dev, verificar contra `npm run build && npx next start` en su lugar — es más estable y es lo que realmente se despliega.
7. **`.mcp.json` con interpolación de variable rota**: tenía `"SUPABASE_ACCESS_TOKEN": "SUPABASE_ACCESS_TOKEN"` (string literal, no interpolado) en vez de `"${SUPABASE_ACCESS_TOKEN}"` — corregido para ambos servers (`supabase` y `context7`). Esto rompía silenciosamente la autenticación del MCP desde el principio.
8. **Selectores ambiguos en scripts de Playwright** (no es un bug de la app, pero costó tiempo de diagnóstico varias veces): `page.click('button:has-text("X")')` (API legacy de string-selector) elige el *primer* match del DOM sin avisar cuando el texto es substring de otra cosa en la página (otro botón con label más largo, o incluso el contenido de un mensaje sembrado). Pasó 3 veces: profundidad de `xpath` incorrecta en el tablero, "Detalles" matcheando un mensaje sembrado que contenía "detalles", "Agregar" matcheando "Agregar candidato". Solución: usar `page.getByRole("button", { name: "X", exact: true })`, y si dos elementos comparten texto exacto (un botón disparador + el submit de un `Sheet` con el mismo label), scopear el locator a `[role="dialog"]` primero.

---

## 18. Decisiones importantes tomadas durante el desarrollo

1. **Multi-tenant desde el día uno**, no agregado después — cookie de workspace activo siempre re-validada server-side, nunca confiada a ciegas.
2. **RLS como mecanismo primario** de aislamiento entre tenants, con Server Actions agregando defensa en profundidad donde el costo es bajo (re-chequear pertenencia antes de un `update`).
3. **Alcance recortado deliberadamente en cada módulo nuevo**, confirmado explícitamente con el usuario antes de construir, en vez de intentar implementar la especificación completa del Blueprint de una sola vez:
   - Dashboard + CRM: sin automatizaciones, sin IA.
   - Inbox: sin composer de envío real (bloqueado por falta de credenciales YCloud — ver punto 4).
   - ATS: sin entrevistas/evaluaciones/CV/IA de preclasificación.
4. **No simular integraciones externas que no existen.** Se decidió explícitamente NO construir un botón de "enviar WhatsApp" que solo escribiera en la base de datos, porque violaría la regla del propio Blueprint (todo envío pasa por el adapter YCloud, con checks de opt-out y ventana de 24h) y generaría una falsa sensación de funcionalidad completa.
5. **Extracción de componentes compartidos solo cuando hay un segundo consumidor real** — el `KanbanBoard` genérico se extrajo recién cuando ATS lo necesitó, no especulativamente antes.
6. **Reutilización de esquema explícita**: antes de agregar una tabla nueva, se verificó primero si el Blueprint ya la especificaba (y se migró tal cual), y solo se agregaron 2 columnas/tablas más allá del Blueprint original con justificación documentada inline (`contacts.company`, tabla `tasks`).
7. **Verificación real obligatoria** antes de dar una feature por terminada — build/lint no son suficientes para este proyecto; se exige correr la app real y ejercitarla (ver `.claude` memory `verification-standard.md` si está disponible, o simplemente asumir este estándar).
8. **Seed de demostración en vez de datos mockeados en el frontend** — no había fuente de datos real (sin YCloud), así que se optó por sembrar datos realistas directo en Supabase (visible/editable como datos reales) en vez de hardcodear mocks en componentes.

---

## 19. Próximas tareas pendientes

### 19.1 Elegidas explícitamente por el usuario, sin construir todavía
De la lista completa del pedido original, quedan sin construir (el usuario fue priorizando módulo por módulo en cada sesión): **Automatizaciones** (constructor visual de flujos), **Calendario**, **Contactos + Empresas** (vistas de listado dedicadas — hoy los contactos solo se ven dentro de CRM/Inbox/ATS, no hay una sección propia), **Analytics**, **Configuración**, **Centro de IA** (RAG/base de conocimiento), **Marketplace**.

### 19.2 Deuda técnica / gaps conocidos dentro de lo ya construido
- Conectar **YCloud** (credenciales + webhook de ingestión + Buffer Inteligente + adapter de envío) para habilitar el composer real del Inbox y los modos `ai`/`hybrid` de conversación.
- Conectar **OpenRouter** y construir el **Agent Engine** ([13-agent-engine.md](docs/blueprint/13-agent-engine.md)) — motor de IA, herramientas, modos de conversación.
- Resolver la decisión "⚠️ a confirmar con el usuario" del Blueprint sobre `bookings.provider` por defecto para entrevistas del ATS, antes de construir `interviews`/`evaluations`.
- Configurar un bucket de Supabase Storage para habilitar `attachments` (CV en ATS, archivos en Inbox/CRM).
- `OpportunityCard.ownerName` sigue en `null` — completar si se agrega una UI que lo muestre.
- Corregir el typo en la Redirect URL de Supabase Auth (dashboard, ver sección 13).
- Habilitar "Leaked Password Protection" en Supabase Auth (dashboard, ver sección 13).
- Revisar si conviene restringir el `EXECUTE` de `public.workspace_member_names` solo al rol `authenticated` (hoy también lo tiene `anon`, aunque la función ya es segura internamente).
- Decidir si conviene fijar `--webpack` como default del script `dev` en `package.json` dado el historial de inestabilidad de Turbopack en esta máquina (ver sección 17, punto 6) — se dejó como decisión pendiente del usuario.

---

## 20. Instrucciones exactas para continuar el desarrollo

### 20.1 Puesta en marcha desde cero (otra computadora / otra cuenta)
```bash
# 1. Clonar/copiar el repositorio completo, incluyendo docs/blueprint/ y supabase/
cd d:\growthlink\codigo   # o la ruta correspondiente
npm install

# 2. Configurar variables de entorno
cp .env.local.example .env.local
# completar NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY con los valores del proyecto Supabase real
# (Project Settings > API en el dashboard de Supabase)

# 3. Exportar el token de acceso de Supabase para el MCP / fallback de Management API
setx SUPABASE_ACCESS_TOKEN "..."   # Windows, requiere reiniciar la terminal/Claude Code después
# (o el equivalente de tu shell en otro SO)

# 4. Aplicar las migraciones (en orden) al proyecto Supabase, vía el MCP
#    (mcp__supabase__apply_migration) o vía curl a la Management API si el MCP falla:
#    curl -X POST https://api.supabase.com/v1/projects/{ref}/database/query \
#      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
#      -H "Content-Type: application/json" \
#      -d '{"query": "<contenido del .sql>"}'
#    Orden: 0001 → 0002 → 0003 → 0004

# 5. (Opcional) Sembrar datos de demostración — editar primero el email objetivo
#    en supabase/seed.sql (busca 'alancitofeck@gmail.com') si el usuario real es otro

# 6. Levantar el servidor de desarrollo
npx next dev --webpack   # NO usar `npm run dev` a secas en Windows — ver sección 17, punto 6
# Si hay problemas de estabilidad en dev, usar en su lugar:
npm run build && npx next start

# 7. Verificar
npm run lint     # debe salir limpio
npm run build    # debe compilar sin errores de TypeScript
```

### 20.2 Antes de escribir código nuevo, siempre
1. Leer [docs/blueprint/MASTER_BLUEPRINT.md](docs/blueprint/MASTER_BLUEPRINT.md) y el documento detallado del área a tocar.
2. Leer este `PROJECT_CONTEXT.md` completo.
3. Revisar si ya existe un patrón reutilizable (componente en `src/components/ui/` o `src/components/kanban/`, un `lib/<módulo>/queries.ts` similar) antes de crear uno nuevo.
4. Si la tarea toca esquema de base de datos: verificar primero contra [docs/blueprint/02-database.md](docs/blueprint/02-database.md) si la tabla ya está especificada ahí (aunque no esté migrada) — migrarla tal cual en vez de inventar un esquema distinto.
5. Si se detecta una inconsistencia entre el Blueprint y lo pedido, plantearla antes de escribir código (regla explícita de `CLAUDE.md`).

### 20.3 Al construir un módulo/feature nueva
1. Explorar el código relevante existente primero (patrones de `crm`/`inbox`/`ats` como referencia).
2. Si la tarea es no trivial (más de 2-3 archivos, decisiones de arquitectura reales), plantear un plan explícito antes de implementar — este proyecto tiene precedente fuerte de planificar y confirmar alcance con el usuario antes de construir cada módulo.
3. Recortar alcance deliberadamente cuando haga falta (dependencias externas no conectadas, features que necesitan su propia sesión de diseño) — comunicarlo explícitamente, no callarlo.
4. Seguir el patrón `lib/<módulo>/queries.ts` (server-only, filtra por `workspace_id` explícito) + `lib/<módulo>/actions.ts` (`"use server"`, `requireActiveWorkspace()`, `revalidatePath`).
5. Para cualquier tablero con drag-and-drop, usar `src/components/kanban/KanbanBoard.tsx` — no reimplementar `@dnd-kit`.
6. Para cualquier panel de detalle lateral, seguir el patrón `Sheet` + `Tabs` con tabs "Pronto" para lo que quede fuera de alcance.

### 20.4 Verificación antes de dar por terminada una feature
1. `npm run lint` y `npm run build` limpios (no opcional).
2. Levantar el servidor real y ejercitar la feature en un navegador real — build/lint no son suficientes para este proyecto. Usar Playwright + Chromium si hace falta automatizar (patrón usado en toda la sesión: login real, navegar, click, screenshot, revisar errores de consola).
3. Si algo no se puede verificar en vivo (ej. falta una credencial externa), decirlo explícitamente en vez de asumir que funciona.
4. Aplicar cualquier migración nueva al proyecto Supabase real (no dejarla solo en el archivo `.sql` local) y correr el equivalente de `get_advisors` (seguridad) antes de cerrar.

### 20.5 Estado actual del `.mcp.json` y credenciales
`.mcp.json` está en el repo (no gitignored) y usa `${VAR}` para interpolar `SUPABASE_ACCESS_TOKEN`/`CONTEXT7_API_KEY` desde el entorno — nunca hardcodear el token ahí. Si el Supabase MCP aparece desconectado, usar el fallback de `curl` a la Management API descripto en 20.1, paso 4.
