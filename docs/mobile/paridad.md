# Matriz de paridad mobile — Fase 1 (borrador de inventario)

Rama: `mobile-paridad` (sale de `mobile-fase-1`). Referencia visual: `docs/mobile/growthlink-movil.html` (capturas en `docs/mobile/referencia/`). Antes de cambios: `docs/mobile/antes-desktop/` y `docs/mobile/antes-mobile/` (58 rutas por resolución, con la cuenta admin QA).

**Alcance de este borrador:** cada fila es un módulo o función. Las columnas de problema y solución salen de leer el código y de la auditoría de `docs/mobile-audit.md`. Lo marcado como **por verificar** no se probó en el celular todavía; se confirma en la Fase 4.

**Estado**: `OK` = ya funciona en mobile según medición · `Parcial` = funciona pero con problemas conocidos · `Pendiente` = sin resolver · `Por verificar` = no medido.

## Resumen

| Concepto | Valor |
|---|---|
| Módulos/funciones inventariadas (filas) | ~95 |
| Rutas con captura "antes" | 58 por resolución (51 protegidas + 8 públicas, incluidas 5 dinámicas con datos) |
| Rutas no capturables (sin dato en el workspace QA) | 20 dinámicas (ver al final) |
| Críticas | 9 |

## Auth y cuenta

| Ruta | Función | Escritorio | Problema mobile | Solución propuesta | Componente | Estado |
|---|---|---|---|---|---|---|
| /login | Login email+password, OAuth | Formulario centrado | Inputs de 14px hacen zoom en iOS (ya corregido en `Input`, falta verificar en la página) | Inputs 16px, `autocomplete`, `inputmode=email` | `login/LoginForm.tsx` | Parcial |
| /login/verify-mfa | Segundo factor | Formulario | Código de 6 dígitos sin `inputmode=numeric` | `inputmode="numeric"`, `autocomplete="one-time-code"` | `login/verify-mfa` | Por verificar |
| /register | Registro | Formulario | Mismo problema de inputs | Inputs 16px, `autocomplete` | `register/RegisterForm.tsx` | Parcial |
| /confirm-email | Código OTP | Input de código | Teclado sin numérico | `inputmode="numeric"` | `confirm-email` | Por verificar |
| /forgot-password, /reset-password | Recuperar y resetear | Formularios | Igual que login | Inputs 16px | `forgot-password`, `reset-password` | Por verificar |
| /select-workspace | Elegir workspace | Lista de cards | Sin verificar tamaños | Lista de filas 44px+ | `select-workspace/WorkspacePicker.tsx` | Por verificar |
| /profile | Perfil, 2FA, exportar y eliminar cuenta | Secciones con hover | 5 acciones solo con hover, 32 targets < 44px | Acciones visibles, filas de 44px | `profile/sections/*` | Pendiente |
| /settings | Configuración del workspace | Página | 41 targets < 44px, 1 input < 16px | Lista de secciones navegable | `settings/page.tsx` | Pendiente |
| Cuenta | Cerrar sesión, modo oscuro, tema del workspace | Menú de usuario | Menú a 36px de alto (corregido en `UserMenu`) | Filas 44px | `components/layout/UserMenu.tsx` | Parcial |

## Globales

| Función | Escritorio | Problema mobile | Solución propuesta | Componente | Estado |
|---|---|---|---|---|---|
| Barra inferior | — | Creada en Fase 1 | Inicio, Inbox (contador real de no leídos), CRM, Agenda, Más; respeta módulos | `components/layout/MobileBottomNav.tsx` | Parcial (falta contador real y permisos por rol) |
| Pantalla Más | Sidebar completo | Drawer actual, no es grilla | Grilla de 3 por sección de `sidebarConfig`, con etiqueta IA | `components/layout/MobileNav.tsx` | Parcial |
| Header mobile | Navbar completo | Título, búsqueda y campana en 36px | Título, volver, búsqueda y notificaciones a 44px | `components/layout/Navbar.tsx` | Parcial |
| Búsqueda global | Atajo y buscador | Sin atajo de teclado en celular | Pantalla de búsqueda dedicada desde el header | Por ubicar el componente de búsqueda | Por verificar |
| Notificaciones (campana y panel) | Panel desplegable | Panel como popover | Panel como bottom sheet | `NotificationBell.tsx`, `NotificationPanel.tsx` | Por verificar |
| Breadcrumbs | Migas de pan | Pueden desbordar | Solo el último nivel con volver | Por ubicar | Por verificar |
| Favoritos y secciones del sidebar | Sidebar con secciones | Sin acceso en celular salvo drawer | Grilla de "Más" | `sidebarConfig.ts` | Parcial |
| Tour de onboarding | Tours con overlay | Overlays tapan contenido en pantallas chicas | Adaptar o saltar tours debajo de md | `components/onboarding/*` | Pendiente |
| Toasts | Esquina | Pueden tapar la barra inferior | Posición por encima de la barra | `components/toast/*` | Por verificar |
| Atajos de teclado | 12 listeners de keydown | No aplica a celular | Ocultar en mobile sin perder nada | Varios | Por verificar |
| Clic derecho / menús contextuales | No hay `onContextMenu` en el código | No aplica | Menú "⋯" donde haga falta | — | OK (no existe) |
| Hover | 8 acciones solo con hover en CRM, 5 en dashboard y advisors | Inaccesibles | Mostrar siempre debajo de md | Tarjetas CRM, `PendingTasks`, `AdvisorsKanban` | Pendiente |

## Principal

| Ruta | Función | Problema mobile | Solución | Componente | Estado |
|---|---|---|---|---|---|
| /dashboard | KPIs (2 col.), gráficos, "Para hoy", acciones recomendadas, widgets | 33 targets < 44px en header/drawer; hover en `PendingTasks` | Tarjeta destacada de leads sin responder (de la maqueta), KPIs 2x2 (ya hecho), widgets completos | `dashboard/*` | Parcial |
| /inbox | Lista con filtros | Filtros en dos filas con scroll | Chips Todos / No leídos / IA / Humano (de la maqueta) | `inbox/ConversationList.tsx` | Parcial |
| /inbox | Conversación: volver, enviar, adjuntar, responder rápido | Vista de dos pantallas ya existe; barra inferior oculta mientras hay conversación | Mantener, agregar cámara (`capture`), composer fijo con `visualViewport` | `inbox/ConversationThread.tsx` | Parcial |
| /inbox | Handoff IA ↔ humano ("Tomar") | Aviso y botón a 36px | Aviso y botón a 44px, conectado al handoff real | `ConversationThread.tsx` | Por verificar |
| /inbox | Realtime (Supabase channel) | **Sin `visibilitychange`**: al volver de segundo plano no reconecta ni refresca | Reconectar y refrescar al volver a primer plano | `inbox/InboxShell.tsx` | **Crítico** |
| /inbox | Búsqueda y etiquetas | Input de 14px (corregido en `Input`) | Búsqueda full-width arriba | `inbox/*` | Parcial |
| /inbox/contactos, /etiquetas, /plantillas | Gestión de contactos, etiquetas y plantillas | 19–20 targets < 44px, inputs 14px | Lista de filas 44px | `inbox/*` | Pendiente |

## Clientes

| Ruta | Función | Problema mobile | Solución | Componente | Estado |
|---|---|---|---|---|---|
| /crm | Kanban por etapa | Una columna por pantalla (hecho), botón "Mover a etapa…" (hecho), TouchSensor 250ms (ya existía) | Mantener, agregar barra de etapas con contadores de la maqueta | `components/kanban/KanbanBoard.tsx` | Parcial |
| /crm | KPIs, filtros por canal, buscar | Filtros en varias filas, 80 targets < 44px | Chips de canal, filtros en bottom sheet | `crm/CrmBoardShell.tsx` | Parcial |
| /crm | Detalle de tarjeta, editar, notas, actividad | Detalle no revisado | Ficha de lead como en la maqueta (mensaje, llamar `tel:`, agendar, etapa) | `crm/*` | Pendiente |
| /crm | Importar leads | `ImportLeadsSheet` con tabla (wrapper de scroll aplicado) | Asistente de un paso por pantalla | `crm/ImportLeadsSheet.tsx` | Parcial |
| /crm | Canales conectados, analytics | Sin revisar | Sección plegable | `crm/*` | Por verificar |
| /crm | Tab Agentes con su detalle | Sin revisar | Tabs scrolleables | `crm/*`, `crm/agents/[memberId]` | Por verificar |
| /crm | Cambio a ATS | Sin revisar | Selector en el header | `crm/*` | Por verificar |
| /ats | Vacantes y candidatos, kanban | Medido: solo targets del header; kanban de vacante no medido (no hay vacantes QA) | Kanban igual que CRM | `ats/*` | Por verificar |
| /ats/[vacancyId] | Detalle, alta de candidato | Sin dato para medir | Igual que CRM | `ats/[vacancyId]` | Por verificar |
| /advisors | Kanban, KPIs, detalle y alta de deal | 33 targets < 44px, 5 acciones con hover | Kanban por etapa, acciones visibles | `advisors/AdvisorsKanban.tsx` | Pendiente |
| /advisors/import | Wizard de importación | 10 targets < 44px | Un paso por pantalla | `advisors/import/*` | Pendiente |
| /mini-apps | Lista de mini apps, copiar link, QR | Tarjetas con acciones | Tarjetas de la maqueta (módulo genérico) | `mini-apps/MiniAppCard.tsx` | Parcial |
| /mini-apps/[miniAppId] | Tabs Resumen, Leads, Simulaciones, Analíticas, Configuración, Acceso, Contenido | Tabs largas, ya rediseñadas en Fase 1-5 | Tabs scrolleables; Configuración con sidebar → lista | `mini-apps/[miniAppId]/*` | Parcial |
| /mini-apps/[id]/leads/[leadId]/resumen | Resumen para imprimir o PDF | Vista de impresión | Vista legible + compartir (Web Share) | `mini-apps/*` | Por verificar |
| /asesorias | Lista, KPIs, etapas, referidos | 16 targets < 44px, KPIs con hover | Lista de la maqueta, KPIs visibles | `asesorias/*` | Pendiente |
| /asesorias/[id]/resumen | Resumen de la asesoría | Sin dato | Lectura en una columna | `asesorias/*` | Por verificar |
| /asesorias/cierre, /presentacion, /referidos | Cierre, presentación, referidos e iniciar conversación de referido | 11 targets < 44px; 4 inputs < 16px en referidos | Flujo en pasos | `asesorias/*` | Pendiente |

## Pólizas

| Ruta | Función | Problema mobile | Solución | Componente | Estado |
|---|---|---|---|---|---|
| /polizas | Lista, kanban de pólizas, filtros, exportar | Kanban sin modo de una columna; tabla | Kanban por etapa (como CRM), tabla → tarjetas (ResponsiveTable) | `polizas/PolicyKanban.tsx`, `PolicyTable.tsx` | Parcial |
| /polizas/posibles-polizas | Prospectos de póliza | 12 targets < 44px | Lista de filas | `polizas/posibles-polizas` | Pendiente |
| /polizas/posibles-polizas/[prospectId] | Detalle | Sin dato | Ficha de una columna | — | Por verificar |
| /extraccion-polizas | Subir PDF y revisar campos | Subida sin `capture` | Botón "Sacar foto" con `accept` + `capture` | `extraccion-polizas/*` | Pendiente |
| /aseguradoras | Conectar proveedor, gestionar conexión | 13 targets < 44px | Lista de tarjetas | `aseguradoras/*` | Pendiente |
| /analizador-cartera | Análisis de cartera | 16 targets < 44px | Resultados en una columna | `analizador-cartera/*` | Pendiente |

## Operación

| Ruta | Función | Problema mobile | Solución | Componente | Estado |
|---|---|---|---|---|---|
| /agenda | Tira de días, KPIs, timeline de citas | Tira de días y tarjetas OK en la vista de referencia; 61 targets < 44px (celdas) | Vista día por defecto (de la maqueta) | `agenda/*` | Parcial |
| /calendar | Vistas mes, semana, día, agenda; crear y editar eventos | Vista mes/semana no usable a 390px; `TimeGrid` sin revisar | Agenda por defecto (ya hecho antes), mes y semana en una columna | `calendar/*` | Parcial |
| /calendar, /agenda | Crear y editar eventos, selector de contacto | Formulario en sheet; contactos con buscador | Sheet pantalla completa | `calendar/EventFormSheet.tsx` | Por verificar |
| /cobranza | Kanban, tabla, calendario, prioridad, detalle, formulario, automatizaciones | Kanban sin modo, tabla ancha | Vista prioridad como lista (maqueta), kanban por etapa | `cobranza/*` | Pendiente |
| /metas | Metas y bonos | 11 targets < 44px, 1 input < 16px | Módulo genérico (stats + lista) | `metas/*` | Pendiente |
| /tasks | Todas sus vistas, crear y editar, swipe | Swipe existente; vista kanban de tareas sin modo de una columna | Vista lista por defecto, kanban por etapa | `tasks/*` | Parcial |
| /tasks | Sidebar de tareas (grupos, favoritos) | Sidebar fijo a la izquierda | Bottom sheet | `tasks/TasksSidebar.tsx` | Pendiente |
| /documents | Grilla de documentos, subir, ver | Grilla con hover; subir sin `capture` | Lista con acciones visibles, subir con cámara | `components/documents/*` | Pendiente |
| /kpis | KPIs con carrusel | Carrusel (decisión previa) | Grilla 2x2 como dashboard | `kpis/KpisSection.tsx` | Pendiente |

## IA

| Ruta | Función | Problema mobile | Solución | Componente | Estado |
|---|---|---|---|---|---|
| /asistente | Chat y smart cards | Input de 14px (corregido en `Input`), 15 targets | Chat a pantalla completa | `asistente/*` | Parcial |
| /agentes-ia | Lista, crear | 14 targets < 44px | Lista de tarjetas | `agentes-ia/*` | Pendiente |
| /agentes-ia/nuevo | Wizard de creación (todos sus pasos) | 2 inputs < 16px, 11 targets | Un paso por pantalla con progreso y botones fijos abajo | `agentes-ia/nuevo/*` | Pendiente |
| /agentes-ia/[agentId] | 12 tabs (General, Personalidad, Prompt, Base de conocimiento, Herramientas, Canales, Seguimientos, Referidos, Sugerencias, Métricas, Historial, Test) | Sin dato en QA (no hay agentes) | Tabs como lista de secciones navegable | `agentes-ia/[agentId]/tabs/*` | Por verificar |
| /automatizaciones y /automations | Mis automatizaciones, drawer, historial | 34 targets < 44px | Lista + drawer a pantalla completa | `automatizaciones/*` | Pendiente |
| /presentaciones | Lista | Vacía en QA (no medido) | Lista de tarjetas | `presentaciones/*` | Por verificar |
| /presentaciones/[id] | Editor de presentación, pasos, fotos | Sin dato en QA; `FotosStep` con hover | Editor de una columna | `presentaciones/[presentationId]/*` | Por verificar |
| /manychat | Canales, contactos | Sin revisar | Lista de tarjetas | `manychat/*` | Por verificar |

## Aprendizaje

| Ruta | Función | Problema mobile | Solución | Componente | Estado |
|---|---|---|---|---|---|
| /classroom | Home, búsqueda, categorías | 3 acciones con hover en `CourseCard`, 13 targets | Tarjetas con acción visible | `components/classroom/CourseCard.tsx` | Pendiente |
| /classroom/cursos/[slug] y player | Lecciones, video | Sin revisar en detalle | Drawer de capítulos (ya existe) | `classroom/*` | Parcial |
| /classroom/admin | Cursos, categorías, editor de capítulos | Reordenamiento con dnd-kit (`PointerSensor`, sin `TouchSensor`) | `TouchSensor` 250ms en `AdminChapterLessonTree` y `TasksSidebar` | `classroom/admin/*` | Pendiente |

## Administración

| Ruta | Función | Problema mobile | Solución | Componente | Estado |
|---|---|---|---|---|---|
| /asesores | Lista de clientes, nuevo cliente | 11 targets | Lista de filas | `asesores/*` | Pendiente |
| /asesores/agendas, /operaciones, /performance | Tablas, ranking, comparación, panel IA | Tablas anchas; sin datos QA para medir | ResponsiveTable | `asesores/agendas/AgendaSetterPerformanceTable.tsx`, `asesores/performance/*` | Pendiente |
| /asesores/[clientId] (8 subrutas) | Accesos, agenda, contrato con notas y pagos, documentos, KPIs, operación, pólizas, resumen, tareas | Sin dato en QA para capturar; contrato con tabla de pagos | Tabs scrolleables; pagos como tarjetas | `asesores/[clientId]/*` | Por verificar |
| /operaciones | Operaciones | 10 targets | Lista de filas | `operaciones/*` | Pendiente |
| /importar-exportar | Importar y exportar CSV/XLSX | 22 elementos y 24 targets; `exceljs` | Asistente de un paso por pantalla; descarga con Web Share | `importar-exportar/*` | Pendiente |

## Públicas

| Ruta | Función | Problema mobile | Solución | Componente | Estado |
|---|---|---|---|---|---|
| /apps/[slug] | Mini apps públicas (12 plantillas) | Medido en captura "antes" (caballo-de-troya, cotizador GMM); plantillas con dvh ya corregido en Fase 4 de optimización previa | Revisar cada plantilla en 390px | `app/apps/[slug]/*` | Por verificar |
| /p/* | Presentaciones públicas | Sin dato en QA | Revisar en 390px | `app/p/[slug]` | Por verificar |
| /access-denied | Acceso denegado | Sin revisar | Igual que el resto | `access-denied` | Por verificar |

## Transversal

| Tema | Hallazgo | Acción |
|---|---|---|
| Descargas y exportaciones (exceljs, pdfkit, jszip) | Se usan en 8, 7 y 1 archivos | Verificar en PWA iPhone; usar Web Share API como alternativa |
| QR (qrcode) | 2 archivos | Verificar que el código se vea completo en 390px |
| Recorte de imágenes (react-easy-crop) | 4 archivos | Probar gestos táctiles de arrastre y zoom |
| Editor de texto (TipTap) | 2 archivos | Probar barra de herramientas y teclado virtual |
| Gráficos (recharts) | 24 archivos | `ResponsiveContainer` al 100%; revisar alturas fijas |
| Subida de archivos | 9 archivos con `accept` | Agregar `capture` donde se tomen fotos |
| Links `tel:` | 7 archivos | Ya usan `tel:`, verificar en PWA |
| Links que abren pestaña nueva | Por revisar en la PWA instalada | Verificar `target="_blank"` en standalone |
| Login OAuth y sesión en PWA | La PWA de iPhone guarda sesión separada de Safari | Probar login y logout en modo standalone |
| `display-mode: standalone` | No se detecta en el código | Agregar lógica para standalone si hace falta |
| Realtime al volver de segundo plano | No hay `visibilitychange` | **Crítico**: implementar |
| Dark mode en mobile | Sin revisión sistemática | Capturas en dark en cada pantalla |

## Críticas (prioridad alta)

1. Realtime del Inbox al volver de segundo plano (no reconecta).
2. Inputs < 16px en login, registro y OTP (zoom en iOS).
3. CRM: acciones solo con hover en las tarjetas.
4. Inbox: handoff IA/humano en 36px y sin verificar contra el handoff real.
5. Agenda y calendario: vista mes/semana no usable en 390px.
6. Polizas: subida de PDF sin cámara.
7. Dashboard: widgets y acciones con hover.
8. Cobranza y tareas: kanban sin modo de una columna.
9. Tablas de asesores: sin ResponsiveTable.

## Rutas no capturables (sin dato en el workspace QA)

20 rutas dinámicas: `/asesores/[clientId]` y sus 8 subrutas, `/ats/[vacancyId]`, `/agentes-ia/[agentId]`, `/mini-apps/[miniAppId]` y `/leads/[leadId]/resumen`, `/polizas/posibles-polizas/[prospectId]`, `/tasks/groups/[groupId]`, `/asesorias/[asesoriaId]/resumen`, `/classroom/admin/cursos/[courseId]`, `/classroom/categorias/[categorySlug]`, `/advisors` detalle, `/presentaciones/[id]` (el id usado pertenece a otro workspace), y `/p/*`.
Para tener estas capturas hace falta crear datos en el workspace QA; lo propongo en la siguiente fase.

## Estado Fase 2 (base compartida)

Hecho:
- Barra inferior con contador real de no leídos (refresca al volver a primer plano y cada minuto) y reemplazo de módulos apagados por el siguiente disponible.
- Pantalla "Más" como la maqueta: perfil, cambio de workspace, grilla de 3 por sección con etiqueta IA, modo oscuro, perfil, configuración y cerrar sesión.
- Búsqueda global accesible en móvil (botón de lupa que abre el campo a pantalla completa).
- Sheet con agarre visual y cierre arrastrando hacia abajo (solo debajo de sm), padding de safe-area.
- TouchSensor de 250ms en todos los DndContext (MouseSensor para mouse, como el Kanban).
- dvh en las pantallas de altura completa y en las plantillas de mini apps.
- Componentes nuevos: FabMenu (botón crear con menú), MobileListRow, FilterChips, KpiTile, ResponsiveTable.
- Fab por encima de la barra inferior.

Verificación (cuenta admin QA, 390x844, 45 rutas estáticas):
- Scroll horizontal del body: 0 rutas con problema.
- Inputs menores a 16px: 23 -> 0.
- Targets menores a 44px: 878 -> 446.
- Hover-only: 30 sin cambios (pendiente Fase 4).

Escritorio (1440x900): 46 de 58 rutas idénticas píxel a píxel. Las 12 restantes difieren por estado, no por código: banner del dashboard que depende de datos, saludo según la hora, hover en una tarjeta del CRM, timestamps relativos.

Pendiente:
- Realtime al volver de segundo plano (Fase 3).
- Tours de onboarding en móvil (sin adaptar).
- Resultados del buscador en móvil: el panel sale algo corrido a la izquierda.
- Tablas: ResponsiveTable creado, aplicado en Fase 4.
- Modales distintos de Sheet: sin revisar.

## Estado Fase 3 (módulos: Inbox, CRM, Dashboard, Agenda, Tareas)

Hecho:
- Inbox: "Tomar" persiste el handoff (actualización optimista; la action se encola detrás de las del panel, ver ConversationThread). `updateConversationMode` ya no ignora el error. Realtime y refresco al volver de segundo plano. Check `flujo-critico.mjs` 9/9.
- CRM: acciones de la card (WhatsApp, llamar, tarea, más) visibles en mobile y de 44px (antes solo al hover, 24px).
- Dashboard: tarjeta destacada "leads sin responder" arriba (solo mobile; en desktop lo cubre Insights prioritarios). Acción de editar tarea visible y de 44px.
- Agenda (/agenda): tira de 7 días en vista día (solo mobile) y encabezado en columna.
- Tareas: sidebar de grupos como bottom sheet en mobile (antes drawer lateral); handle de arrastre y eliminar ítem de checklist visibles sin hover.

Verificación: capturas en docs/mobile/resultado-mobile/fase3-*-390x844.png; `scripts/mobile-qa/fase3-shots*.mjs`; `vitest` de UnansweredLeadsCard (4/4); hscroll 0 en CRM, Dashboard, Agenda, Calendario y Tareas.

Pendiente / conocido:
- Calendario (/calendar): agenda por defecto en mobile OK; el handle de redimensionar evento en TimeGrid sigue oculto hasta hover (es un control de arrastre, no una acción).
- Escritorio: no se recapturó 1440 en esta fase; los cambios en desktop son nulos salvo `max-md:`/`md:hidden` (verificar en la próxima pasada de paridad).

## Estado Fase 4 (resto de módulos, hover, tablas, tabs)

Hecho:
- Hover-only: acciones visibles en mobile (`max-md:opacity-100`) en CRM, dashboard, tareas, fotos de presentaciones, documentos, perfil, notificaciones, asesorías, cursos admin y progreso de aprendizaje. Botones de 44px donde eran acciones.
- Tablas: lista de tarjetas debajo de md (desktop igual) en Pólizas, Cobranza, CRM (vista tabla), Tareas (vista tabla), ranking de Performance y agendas por setter. `ResponsiveTable` queda como componente para las tablas que falten.
- Kanbans (CRM, pólizas, cobranza, tareas, ATS, advisors): todos usan el board genérico con columna de una a la vez en mobile.
- Tabs: `tabItemClassName` con 44px de alto en mobile (todas las tabs compartidas).
- Navegación: campana de notificaciones 44px; pestañas de perfil/configuración 44px; chips de canal y período del dashboard 44px.
- Buscador: el panel de resultados se alinea con el campo en mobile (antes salía corrido a la izquierda).
- Modales: revisados por código (ConfirmDialog, Wizard, Avatar, Recorte): centrados con `p-4` y `w-full`, sin ancho fijo en mobile.

Verificación:
- Auditoría 390x844 y 360x780 (admin, 45 rutas): 0 errores, 0 rutas con scroll horizontal de página. Targets menores a 44px: 446 (fase 2) -> 277. Hover-only oculto: 6, todos en el overlay decorativo de CourseCard (la card entera es un link).
- Flujo crítico 9/9. Vitest 141/141. Lint sin errores.
- Tests de render (`responsiveTables.test.ts`) para las 6 tablas: confirman la lista mobile y la tabla desktop.

No verificado en vivo (sin datos QA):
- Pólizas, cobranza y tablas de asesores: el workspace QA no tiene pólizas ni cobros, y la cuenta admin QA tiene "Acceso restringido" en Asesores. Se verificó por render, no por captura.
- Wizards multi-paso (mini apps, importar): revisados por código, sin captura en mobile.

Decisión pendiente (no resuelta por código):
- Subida de póliza por cámara: el backend extrae texto de PDFs y rechaza escaneos sin texto. Con cámara (foto) o escaneo a PDF como imagen haría falta OCR o un modelo de visión. Hoy iOS "Escanear documentos" produce PDF, pero si no tiene capa de texto la extracción falla.
- Tours de onboarding en móvil: sin adaptar.
