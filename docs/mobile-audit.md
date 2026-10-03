# Auditoría mobile — Fase 1 (390×844)

Medido en el navegador real (Chrome, emulación táctil) contra la app en build de producción, logueado con la cuenta QA (`qa-mobile@example.com`, rol agente, workspace vacío). Script: `scripts/mobile-qa/audit.mjs`. Datos crudos: `audit-390.json` (fuera del repo).

## Datos de medición

- Workspace QA sembrado con 10 contactos, 8 oportunidades en el pipeline, 3 conversaciones, 6 tareas y 4 citas (todo con prefijo `[QA]`).
- Dos cuentas: **agente** (`qa-mobile@example.com`) y **admin** (`qa-mobile-admin@example.com`, membresía admin en el mismo workspace). Las contraseñas se rotan en cada corrida y no se guardan en disco.
- Auditorías completas: `audit-390-agent.json` y `audit-390-admin.json` en la carpeta temporal de QA (fuera del repo).

## Limitaciones de la medición

- **Tablas no renderizan en las rutas medidas**: `tables=0` en todas. Las tablas de `/asesores/*` (agendas, performance, operaciones) necesitan datos propios de asesores que el workspace QA no tiene. Para esas, la columna "Fuente" dice "Código".
- **Detalles de Kanban no medidos**: el Kanban de ATS vive en `/ats/[vacancyId]`, que requiere una vacante creada. No hay.
- **Rutas dinámicas no auditadas** (requieren IDs): ver lista abajo.
- **Rutas dinámicas no auditadas** (requieren IDs que la cuenta no tiene): `/advisors/*` detalle, `/agentes-ia/[agentId]`, `/asesores/[clientId]/*` (8 rutas), `/classroom/admin/cursos/[courseId]`, `/classroom/categorias/[categorySlug]`, `/classroom/cursos/[courseSlug]` y `/[lessonId]`, `/crm/agents/[memberId]`, `/inbox`-detalle, `/mini-apps/[miniAppId]` y `/leads/[leadId]/resumen`, `/polizas/posibles-polizas/[prospectId]`, `/presentaciones/[presentationId]`, `/tasks/[taskId]`, `/tasks/groups/[groupId]`, `/asesorias/[asesoriaId]/resumen`, `/ats/[vacancyId]`.

## Resultados globales

| Chequeo | Resultado |
|---|---|
| Scroll horizontal de la página | **No hay** en ninguna ruta medida (`scrollWidth` = 390). Única excepción: `/ats`, no medible (ver arriba). |
| Elementos que se salen del viewport | Casi todas las rutas tienen 4 elementos fuera de pantalla: es el **drawer del menú móvil** (`MobileNav`), oculto a propósito a la derecha. No es un bug. Otros casos (kanbans, carruseles de KPIs, chips de filtros) están dentro de un contenedor con scroll propio. |
| Targets táctiles < 44px | **Presente en todas las rutas**: header (botones de menú, ayuda, notificaciones y tema a 36px) y links del drawer a 36px de alto. |
| Inputs con letra < 16px (zoom en iPhone) | **Presente en ~15 rutas**, sobre todo en `/crm`, `/agenda`, `/inbox`. |
| Acciones solo con hover | Presentes en 3 rutas (ver tabla). |
| Kanbans sin `TouchSensor` | **Ninguno**: CRM, ATS, cobranza, advisors, pólizas y tareas usan `KanbanBoard` (`components/kanban`) con `TouchSensor` de 250 ms de delay. Sin embargo, no tienen modo "una columna por pantalla" ni opción "Mover a etapa…" (pendiente Paso 2). |
| Modales y sheets | `Sheet` ya es bottom sheet en mobile (92vh). Pendiente revisar cada modal que use `Dialog` directo. |
| Notch / barra inferior | No hay barra inferior todavía (se crea en Paso 2). `safe-area` se usa en 9 archivos. |
| `100vh` / `h-screen` vs `dvh` | 14 archivos usan `h-screen`/`100vh` y solo 4 usan `dvh`. En iOS, `100vh` queda detrás de la barra del navegador. |

## Tabla por ruta

Gravedad: **A** alta · **M** media · **B** baja. "Medido" = DOM real; "Código" = verificado en fuente.

| Ruta | Problemas | Grav. | Componente responsable | Fuente |
|---|---|---|---|---|
| `/dashboard` | 33 targets < 44px (header y drawer). 5 acciones solo en hover (`PendingTasks.tsx`). Gráficos de Recharts no medidos en detalle. | M | `components/layout/Navbar.tsx`, `dashboard/PendingTasks.tsx` | Medido + Código |
| `/crm` | Search de leads y select de orden a 13px (zoom en iOS). 80 targets < 44px (incluye tabs Tablero/Analytics a 42px de alto). 8 acciones solo en hover en las tarjetas del Kanban. Kanban de 7 columnas (contenido en scroll propio, sin modo de una columna). | A | `crm/CrmBoardShell.tsx`, `components/kanban/KanbanBoard.tsx` | Medido + Código |
| `/inbox` | Search de contactos a 14px. Chips "Sin asignar" / "Cerradas" dentro de scroll propio. Conversación no medible sin datos; la vista lista + hilo en dos pantallas no existe todavía. | A | `inbox/*`, `inbox/ConversationThread.tsx` | Medido + Código |
| `/agenda` | 3 controles a 13–14px (selects Día/Semana/Mes y búsqueda). 61 targets < 44px (celdas de calendario). | A | `calendar/CalendarShell.tsx`, `calendar/TimeGrid.tsx` | Medido + Código |
| `/tasks`, `/tasks/agenda`, `/tasks/archived`, `/tasks/favorites` | 22 targets < 44px (filtros, botones de fila). Sin inputs chicos. Kanban de tareas sin opción "Mover a etapa…". | M | `tasks/views/TaskListView.tsx`, `tasks/views/TaskKanbanView.tsx` | Medido + Código |
| `/advisors` | 33 elementos fuera de su contenedor de scroll (columnas del kanban, contenidas). 33 targets < 44px. 5 acciones solo en hover. | M | `advisors/AdvisorsKanban.tsx` | Medido + Código |
| `/advisors/import` | 10 targets < 44px. | B | `advisors/import/*` | Medido |
| `/agentes-ia` | 14 targets < 44px (tarjetas de agente). | M | `agentes-ia/AgentCard.tsx` (hover en 1 elemento) | Medido + Código |
| `/agentes-ia/nuevo` | 2 inputs < 16px. 11 targets < 44px. | A | `agentes-ia/nuevo/*` | Medido |
| `/ats` | Medido con cuenta admin: sin scroll de página. 17 targets < 44px, solo en header/drawer. Kanban de vacante (`/ats/[vacancyId]`) no medido: no hay vacantes QA. | M | `ats/[vacancyId]/VacancyBoardView.tsx` | Medido (parcial) |
| `/analizador-cartera` | 16 targets < 44px. | M | página propia | Medido |
| `/aseguradoras` | 13 targets < 44px. | B | página propia | Medido |
| `/asesores` | 11 targets < 44px (header). Lista de clientes no medible sin datos. | M | `asesores/ClientListRow.tsx`, `asesores/ClientCard.tsx` | Medido + Código |
| `/asesores/agendas`, `/asesores/operaciones`, `/asesores/performance` | 11 targets < 44px (header). **Tablas** (`AgendaSetterPerformanceTable`, `PerformanceRankingTable`, `OperacionesShell`) sin datos: no medidas. Son el caso típico de tabla que desborda. | A | `asesores/agendas/AgendaSetterPerformanceTable.tsx`, `asesores/performance/PerformanceRankingTable.tsx` | Código |
| `/asesorias` | 16 targets < 44px. KPIs con hover. | M | `asesorias/AsesoriaKpiCards.tsx` | Medido + Código |
| `/asesorias/cierre` | 11 targets < 44px. | B | página propia | Medido |
| `/asesorias/presentacion` | 1 elemento con acción solo en hover. 11 targets < 44px. | M | verificar en `asesorias/presentacion/*` | Medido |
| `/asesorias/referidos` | 4 inputs < 16px. 11 targets < 44px. | A | `asesorias/referidos/*` | Medido |
| `/asistente` | 1 input < 16px. 15 targets < 44px. | M | página propia | Medido |
| `/automations`, `/automatizaciones` | 20 y 34 targets < 44px (lista de reglas). `/automatizaciones` tiene 1 input < 16px. | M | `automatizaciones/*` | Medido |
| `/calendar` | 22 targets < 44px. Vista Mes/Semana no se puede usar en 390px sin la agenda por defecto (Fase 2 de la optimización anterior). | M | `calendar/CalendarShell.tsx` | Medido + Código |
| `/classroom` | 3 acciones solo en hover (tarjetas de curso). 1 input < 16px. 13 targets < 44px. | M | `components/classroom/CourseCard.tsx` | Medido + Código |
| `/classroom/admin` | 10 targets < 44px. | B | `classroom/admin/*` | Medido |
| `/cobranza` | 12 targets < 44px. Kanban de cobranza sin opción "Mover a etapa…". | M | `cobranza/CollectionsKanban.tsx` | Medido + Código |
| `/documents` | 1 input < 16px. 15 targets < 44px. Grilla con hover en `DocumentsGrid`. | M | `components/documents/DocumentsGrid.tsx` | Medido + Código |
| `/extraccion-polizas` | 21 elementos fuera de contenedor (contenidos). 13 targets < 44px. | M | `extraccion-polizas/*` | Medido |
| `/importar-exportar` | 22 elementos fuera de contenedor. 24 targets < 44px. | M | `importar-exportar/*` | Medido |
| `/inbox/contactos` | 1 input < 16px. 19 targets < 44px. | A | `inbox/contactos/*` | Medido |
| `/inbox/etiquetas` | 2 inputs < 16px. 20 targets < 44px. | A | `inbox/etiquetas/*` | Medido |
| `/inbox/plantillas` | 15 targets < 44px. | M | `inbox/plantillas/*` | Medido |
| `/kpis` | 15 targets < 44px. Gráficos no medibles sin datos. | M | `kpis/KpisSection.tsx` | Medido + Código |
| `/metas` | 1 input < 16px. 11 targets < 44px. | M | página propia | Medido |
| `/mini-apps` | 13 targets < 44px (tarjetas). | B | `mini-apps/MiniAppCard.tsx` | Medido |
| `/operaciones` | 10 targets < 44px. | B | página propia | Medido |
| `/polizas`, `/polizas/posibles-polizas` | 13 y 12 targets < 44px. Kanban de pólizas (`PolicyKanban`) sin opción "Mover a etapa…". | M | `polizas/PolicyKanban.tsx` | Medido + Código |
| `/presentaciones` | 0 problemas medidos (lista vacía). | B | `presentaciones/PresentationsTable.tsx` | Código |
| `/profile` | 5 acciones solo en hover. 32 targets < 44px. | M | `profile/sections/MyProfileSection.tsx` | Medido + Código |
| `/settings` | 1 input < 16px. 41 targets < 44px. | A | página propia / `components/ui/Select.tsx` | Medido |

## Causas raíz (para el Paso 2)

1. **Inputs < 16px** — `components/ui/Input.tsx` usa `text-sm` (14px) y `text-[15px]` en tamaño lg; `Select.tsx` y `PasswordInput.tsx` usan `text-sm`. Fix central: `text-base` debajo de `md`, `text-sm` desde `md`. Los inputs que están escritos a mano en páginas (`/crm`, `/agenda`) hay que tocarlos uno por uno.
2. **Targets < 44px** — los botones del header (`Navbar.tsx`) y los links del drawer (`MobileNav.tsx`) son `size-9` (36px). Fix central en esos dos componentes, sin tocar desktop.
3. **Hover-only** — `group-hover:opacity-0` en tarjetas (`CourseCard`, `DocumentsGrid`, `AgentCard`). Fix: mostrar las acciones siempre debajo de `md` y solo ocultarlas por hover desde `md`.
4. **Kanbans sin modo mobile** — `components/kanban/KanbanBoard.tsx` ya tiene `TouchSensor` (250 ms). Falta: una columna por pantalla con scroll-snap debajo de `md`, indicador de etapa y la acción "Mover a etapa…" desde la tarjeta.
5. **Tablas** — 41 archivos renderizan `<table>`. Falta un componente reutilizable tarjeta/scroll-contenido debajo de `md`. Las tablas de `/asesores/*` son las prioritarias (no medidas, sin datos).
6. **Viewport** — 14 usos de `h-screen`/`100vh` vs 4 de `dvh`. Cambiar a `dvh` donde haya un layout a pantalla completa (inbox, login, layout protegido).
7. **Navegación** — no existe barra inferior. Se crea en Paso 2 con safe-area y respetando módulos habilitados.

## Pendiente de confirmar antes del Paso 2

- Cuenta **admin** para auditar `/ats` y las rutas que requieren rol admin.
- Datos de prueba en el workspace QA para medir tablas, conversaciones y KPIs reales (¿autorizás que siembre algunos leads/conversaciones en la cuenta QA?).
