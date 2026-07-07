# 12 — Auditoría técnica (arquitectura + Blueprint)

Auditoría del Blueprint (`00`–`11`) hecha desde la perspectiva de llevar la plataforma a producción para miles de empresas (multi-tenant real, no un solo cliente). Rol asumido: Principal Software Architect + Security Engineer + Staff Backend Engineer.

Formato por punto: **qué está bien / riesgos / qué mejoraría / qué cambiaría / por qué / impacto / prioridad**.

Los cambios marcados como aplicados ya están reflejados en los documentos correspondientes (se referencia el archivo). Ningún cambio elimina funcionalidad — todos son endurecimiento o adición.

---

## 1. Seguridad multi-tenant

- **Qué está bien**: `workspace_id` en toda tabla tenant-scoped, RLS como mecanismo de aislamiento ([02-database.md](02-database.md), [09-security.md](09-security.md)), y enforcement en 3 capas para módulos ([03-modules.md](03-modules.md)).
- **Riesgos**: el punto más débil no es RLS en sí, es la **ingestión de webhooks**, que corre con `service_role` (evade RLS por diseño, [09-security.md](09-security.md)). El Blueprint original decía "resolver `workspace_id` a partir del número de WhatsApp" sin especificar **cuál** número — si se resuelve por el teléfono del *contacto* (`from`) en vez del número *receptor* del negocio (`to`/`wabaId`), un mismo número de contacto que escribe a dos workspaces distintos (plausible: un candidato que también es prospecto de otra empresa cliente de la plataforma) podría cruzar datos entre tenants.
- **Qué mejoraría**: resolución de `workspace_id` explícitamente por `to` (número emisor del negocio) / `wabaId` contra `integration_connections`, nunca por `from`. Aplicado en [04-inbox.md](04-inbox.md).
- **Qué cambiaría**: nada estructural — el modelo `workspace_id`+RLS es correcto para este caso de uso; el fix es de lógica de resolución, no de esquema.
- **Por qué**: es la única ruta donde el aislamiento depende de código de aplicación en vez de la base de datos — debe ser inequívoca.
- **Impacto**: filtración cross-tenant de conversaciones si no se corrige.
- **Prioridad**: **Crítica**.

## 2. Políticas RLS de Supabase

- **Qué está bien**: función `SECURITY DEFINER` para evitar recomputar membresía en cada fila, patrón `is_workspace_member`/`has_workspace_role` reutilizable.
- **Riesgos**: (a) el ejemplo original usaba `for insert, update using (...)` — sintácticamente esto **no aplica a INSERT** en Postgres (INSERT solo evalúa `WITH CHECK`, no `USING`); tal como estaba escrito, una política así sobre INSERT sería ignorada o rechazada por Postgres, dejando el INSERT sin protección real de rol. (b) Las funciones `SECURITY DEFINER` sin `search_path` fijo son vulnerables a *search_path hijacking* (un objeto malicioso en un esquema con mayor prioridad en el `search_path` de la sesión podría suplantar a una tabla/función referenciada sin calificar) — es un lint de seguridad estándar de Supabase. (c) Solo se mostró el patrón de SELECT gateado por módulo; faltaba el mismo patrón para INSERT/UPDATE/DELETE.
- **Qué mejoraría**: (a) separar policies por comando (`FOR INSERT WITH CHECK (...)`, `FOR UPDATE USING (...) WITH CHECK (...)`, `FOR DELETE USING (...)`); (b) `SET search_path = ''` (o al esquema explícito) en toda función `SECURITY DEFINER`; (c) policies de escritura con el mismo check de módulo activo que SELECT. Aplicado en [09-security.md](09-security.md).
- **Qué cambiaría**: nada del modelo de roles; es corrección de sintaxis/hardening, no de diseño.
- **Por qué**: una policy de INSERT mal formada es peor que no tener policy — da falsa sensación de seguridad mientras Postgres la ignora silenciosamente en el peor caso, o produce fallos confusos en el mejor. `search_path` sin fijar es una CVE-class conocida en Postgres/Supabase.
- **Impacto**: escritura no autorizada por rol si no se corrige (a); escalación de privilegios teórica vía `search_path` (b); módulo desactivado pero con datos escribibles igual (c).
- **Prioridad**: **Crítica** (a, b) / **Alta** (c).

## 3. Autenticación y autorización

- **Qué está bien**: Supabase Auth vía los helpers ya existentes (`src/lib/supabase/{client,server,middleware}.ts`), 4 roles (owner/admin/agent/viewer) suficientes para v1.
- **Riesgos**: modelo de roles es plano/global por workspace — no hay permisos granulares (p. ej. "agent que solo ve sus conversaciones asignadas" vs "agent que ve todas"), lo cual algunos clientes enterprise van a pedir. No es un riesgo de seguridad hoy, es una limitación de producto.
- **Qué mejoraría**: dejar el esquema de roles como enum simple por ahora (no sobre-diseñar), pero documentar el punto de extensión (tabla `role_permissions` o similar) para cuando se necesite, en vez de improvisarlo bajo presión.
- **Qué cambiaría**: nada ahora — es una decisión de "no construir antes de necesitarlo" correcta, solo falta anotarla como decisión consciente.
- **Por qué**: agregar RBAC granular sin un caso de uso concreto es sobre-ingeniería; pero no dejar la puerta señalizada genera un rediseño costoso después.
- **Impacto**: bajo hoy; medio si un cliente enterprise grande lo pide antes de tener el punto de extensión pensado.
- **Prioridad**: **Media**.

## 4. Gestión de secretos y credenciales

- **Qué está bien**: Vault para credenciales por workspace (`integration_connections.credentials_vault_ref`), separación clara de las env vars propias de la instancia (`.env.local.example`) vs. credenciales de clientes ([08-integrations.md](08-integrations.md), [09-security.md](09-security.md)).
- **Riesgos**: no se especificaba **quién/qué puede invocar el decrypt de Vault** (solo debe ser código server-side con `service_role`, nunca expuesto vía RPC accesible desde el cliente) ni la **rotación de claves** (qué pasa si un token de HighLevel se revoca o un `SUPABASE_SERVICE_ROLE_KEY` se filtra).
- **Qué mejoraría**: (a) documentar explícitamente que el acceso a Vault es exclusivo de funciones server-side/Edge Functions, nunca expuesto como RPC callable por el cliente autenticado; (b) procedimiento de rotación (revocar + re-conectar integración) como parte del runbook operativo, no solo del esquema.
- **Qué cambiaría**: nada de la mecánica (Vault es la elección correcta en Supabase); es documentación operativa faltante.
- **Por qué**: una credencial bien guardada pero sin política de rotación/acceso documentada suele terminar mal accedida "por conveniencia" bajo presión de un incidente.
- **Impacto**: exposición de credenciales de clientes si se accede indebidamente a Vault.
- **Prioridad**: **Alta**.

## 5. Webhooks de YCloud (firma, autenticidad, idempotencia)

- **Qué está bien**: idempotencia ya resuelta con `webhook_events` `unique(provider, event_id)` ([02-database.md](02-database.md)); el hueco de firma ya estaba documentado explícitamente como riesgo abierto en vez de asumido silenciosamente ([08-integrations.md](08-integrations.md)).
- **Riesgos**: sin verificación de autenticidad real, cualquiera que descubra la URL del webhook puede inyectar eventos falsos (mensajes falsos, cambios de estado falsos) si solo se confía en un secreto en el path de la URL (que puede filtrarse en logs de proxies/CDN).
- **Qué mejoraría**: capa doble: (a) un **header secreto estático** configurado en el dashboard de YCloud (si soporta headers custom en la config del webhook) verificado por comparación de tiempo constante (`timingSafeEqual`), como mecanismo primario mientras se confirma si existe firma HMAC real; (b) mantener el secreto de path como defensa adicional, no única; (c) rechazar (`401`) sin insertar en `webhook_events` si el header no matchea, para no ensuciar la tabla de idempotencia con basura.
- **Qué cambiaría**: nada de la estrategia de idempotencia; se refuerza solo la autenticidad.
- **Por qué**: un secreto en query string es más propenso a terminar en logs de acceso (Vercel, proxies intermedios) que un header, que normalmente no se loguea por defecto.
- **Impacto**: inyección de mensajes/eventos falsos, posible manipulación de conversaciones o disparo indebido de acciones de IA con tools.
- **Prioridad**: **Alta** (mientras no se confirme un mecanismo HMAC real de YCloud, que sería la solución definitiva y pasaría a Crítica-resuelta).

## 6. Buffer inteligente y procesamiento concurrente

- **Qué está bien**: el diseño de estado-en-Postgres (en vez de timers en memoria) es correcto para el stack serverless ([04-inbox.md](04-inbox.md)).
- **Riesgos**: el diseño original no especificaba **claim atómico** de la fila de buffer — si dos ejecuciones del cron se solapan (posible si el job tarda más que el intervalo, o hay reintentos), ambas podrían leer el mismo `conversation_buffers` con `flush_at <= now()` y procesar los mismos mensajes dos veces (doble respuesta de IA al mismo lote). Tampoco se manejaba el caso de que **lleguen mensajes nuevos mientras la IA está procesando** el lote anterior (podrían perderse si se limpia el buffer con un `UPDATE` que no considera lo insertado durante el procesamiento).
- **Qué mejoraría**: (a) claim atómico vía `UPDATE conversation_buffers SET status='processing', claimed_at=now() WHERE flush_at <= now() AND status='pending' RETURNING *` (o `SELECT ... FOR UPDATE SKIP LOCKED` si se procesa en un loop), garantizando que solo una ejecución gane la fila; (b) al terminar de procesar, si `pending_message_ids` tiene entradas nuevas (llegadas durante el procesamiento), no limpiar del todo — reprogramar un flush inmediato para ese remanente en vez de descartarlo.
- **Qué cambiaría**: se agrega `conversation_buffers.status` (`pending|processing`) y `claimed_at`. Aplicado en [02-database.md](02-database.md) y [04-inbox.md](04-inbox.md).
- **Por qué**: sin claim atómico, el "evitar respuestas fragmentadas" que es el objetivo mismo del buffer se rompe bajo concurrencia — exactamente el escenario que el buffer existe para prevenir.
- **Impacto**: respuestas duplicadas o fragmentadas de IA al contacto, doble ejecución de tools con efectos secundarios (p. ej. crear la misma oportunidad dos veces).
- **Prioridad**: **Crítica**.

## 7. Cumplimiento de la ventana de 24 horas (Meta)

- **Qué está bien**: guardrail conceptual ya documentado ([05-ai-engine.md](05-ai-engine.md), [09-security.md](09-security.md)), consultando el último `direction='inbound'`.
- **Riesgos**: el guardrail se describía solo para el flujo de IA — pero **cualquier envío saliente** (una tool que agenda y quiere confirmar por WhatsApp, un agente humano respondiendo manualmente tarde, una automatización) puede violar la ventana igual si no pasa por el mismo guardrail centralizado.
- **Qué mejoraría**: centralizar el chequeo de ventana de 24h **dentro del adapter de YCloud** (`sendMessage`), no en cada llamador — así ningún camino de envío (IA, humano, automatización, tool) puede saltárselo por accidente.
- **Qué cambiaría**: mover la responsabilidad del guardrail de "cada flujo debe acordarse de chequear" a "el adapter lo aplica siempre, con una bandera explícita de override solo para plantillas". Aplicado en [08-integrations.md](08-integrations.md).
- **Por qué**: un guardrail de compliance que depende de que cada punto de llamada lo implemente correctamente es frágil; centralizarlo en el punto único de salida (el adapter) lo hace imposible de saltarse por omisión.
- **Impacto**: violación de política de Meta → riesgo de suspensión del número/WABA del cliente.
- **Prioridad**: **Crítica**.

## 8. Gestión de opt-in y opt-out

- **Qué está bien**: YCloud expone eventos `contact.unsubscribe.created/deleted` (ya listados en [08-integrations.md](08-integrations.md)).
- **Riesgos**: **el Blueprint original no tenía ningún campo, tabla ni flujo para opt-in/opt-out** — los eventos estaban listados como referencia de la API pero no conectados a ninguna lógica. Esto es una omisión real y grave: sin esto, la plataforma podría seguir enviando mensajes (incluida IA) a alguien que se dio de baja, lo cual es tanto una violación de política de Meta como, en varias jurisdicciones, un problema legal (equivalente a spam no consentido).
- **Qué mejoraría**: (a) campo `contacts.whatsapp_opt_status` (`subscribed|unsubscribed|unknown`); (b) el webhook `contact.unsubscribe.created` lo pone en `unsubscribed`, `contact.unsubscribe.deleted` lo revierte; (c) el adapter de YCloud (mismo punto centralizado del ítem 7) rechaza cualquier envío no transaccional/no solicitado por el propio contacto si `whatsapp_opt_status='unsubscribed'`.
- **Qué cambiaría**: se agrega el campo y el flujo. Aplicado en [02-database.md](02-database.md), [04-inbox.md](04-inbox.md), [08-integrations.md](08-integrations.md).
- **Por qué**: es un requisito de cumplimiento explícitamente pedido en esta auditoría y ausente del diseño original — no es opcional para una plataforma que va a producción con miles de empresas.
- **Impacto**: riesgo legal/regulatorio + riesgo de suspensión de cuenta de WhatsApp Business a nivel de plataforma completa (no solo de un workspace).
- **Prioridad**: **Crítica**.

## 9. Protección contra prompt injection

- **Qué está bien**: nada todavía — es una omisión total del Blueprint original.
- **Riesgos**: el contenido de mensajes de WhatsApp (texto libre, controlado por el contacto) se inyecta directamente en el contexto del modelo ([05-ai-engine.md](05-ai-engine.md)). Un contacto malicioso puede intentar: (a) hacer que el modelo revele el system prompt o las tools disponibles; (b) manipular al modelo para invocar una tool con argumentos fuera de su alcance legítimo (p. ej. inducir a la IA a "confirmar" una cita gratis, o a describir datos de otro contacto si el prompt los incluyó como contexto); (c) hacer que el modelo ignore el guardrail de ventana de 24h o de escalamiento.
- **Qué mejoraría**: (a) enmarcar explícitamente en el system prompt que el contenido del contacto es **dato, no instrucción** (patrón estándar de instruction hierarchy); (b) **nunca confiar en IDs/valores que el modelo "recuerda" de la conversación para autorizar una tool** — todo tool handler revalida server-side que cualquier `contact_id`/`opportunity_id`/`candidate_id` que reciba pertenece al `workspace_id` de la conversación actual, independientemente de lo que el modelo haya pasado como argumento; (c) los guardrails de compliance (ventana 24h, opt-out) se aplican en el adapter (ítems 7-8), no dependen de que el modelo "decida" respetarlos.
- **Qué cambiaría**: se agrega una sección explícita de defensas contra prompt injection al motor de IA. Aplicado en [05-ai-engine.md](05-ai-engine.md).
- **Por qué**: en un sistema donde el input no confiable (WhatsApp) llega directo al LLM que además tiene *tools con efectos secundarios reales* (crear oportunidades, agendar citas, mover candidatos de etapa), la superficie de ataque de prompt injection no es teórica — es el vector más probable de abuso de toda la plataforma.
- **Impacto**: ejecución de acciones no autorizadas, filtración de contexto entre entidades, abuso de tools.
- **Prioridad**: **Crítica**.

## 10. Seguridad de las herramientas (Tools)

- **Qué está bien**: activación explícita por prompt vía `agent_tools` (allowlist, [05-ai-engine.md](05-ai-engine.md)), handlers server-side (nunca en el cliente).
- **Riesgos**: (a) sin re-validación de workspace por handler (cubierto en el ítem 9, pero vale repetirlo aquí como control de Tools específicamente); (b) sin validación de esquema de argumentos antes de ejecutar (el modelo puede alucinar un argumento con forma incorrecta); (c) sin protección de idempotencia/doble-ejecución para tools con efecto secundario (crear una cita/oportunidad dos veces si el flujo de IA se reintenta, relacionado con el ítem 6).
- **Qué mejoraría**: (a) cada handler valida `parameters` contra su `json_schema` antes de ejecutar y rechaza si no matchea; (b) cada handler re-valida pertenencia a `workspace_id`; (c) tools con efecto secundario aceptan un `idempotency_key` (derivado del `conversation_id` + turno de buffer) para poder detectar/evitar doble-ejecución ante reintentos.
- **Qué cambiaría**: se documenta el contrato de un tool handler (validar esquema → re-validar workspace → ejecutar con idempotency key) como parte del núcleo de IA, no como responsabilidad de cada tool individual. Aplicado en [05-ai-engine.md](05-ai-engine.md).
- **Por qué**: las tools son el punto donde "texto generado por un LLM" se convierte en "escritura real en la base de datos" — es exactamente donde más validación se necesita y menos había en el diseño original.
- **Impacto**: efectos secundarios duplicados o incorrectos en CRM/ATS por alucinación del modelo o reintentos.
- **Prioridad**: **Crítica**.

## 11. Límites de uso y control de costes de OpenRouter

- **Qué está bien**: ya se había identificado que OpenRouter no aísla límites por sub-cliente y que la plataforma debe construir su propio métering (`usage_events`, [08-integrations.md](08-integrations.md)).
- **Riesgos**: el diseño original solo mencionaba **registrar** el uso (`usage_events`) — eso es facturación retroactiva, no un límite duro. Sin un chequeo *antes* de llamar a OpenRouter, un workspace (o un ataque de prompt injection que fuerce loops de tool-calling) puede generar costo ilimitado antes de que nadie note el problema en un dashboard.
- **Qué mejoraría**: chequeo de cuota **preflight**: antes de cada llamada a OpenRouter, sumar `usage_events.cost_usd` del período vigente para ese workspace contra un límite configurable (`workspace_modules.config` o una tabla `workspace_quotas`); si excede, no llamar al modelo — degradar a "requiere atención humana" en vez de fallar silenciosamente.
- **Qué cambiaría**: se agrega el chequeo preflight como parte del flujo IA, no solo el registro posterior. Aplicado en [05-ai-engine.md](05-ai-engine.md).
- **Por qué**: métering sin límite duro es solo un reporte de cuánto dinero ya se perdió, no una protección.
- **Impacto**: sobrecosto no controlado, potencialmente sin techo si hay un bug o abuso.
- **Prioridad**: **Alta**.

## 12. Manejo de errores y reintentos

- **Qué está bien**: fallback de modelos de OpenRouter ya cubre errores a nivel de modelo/proveedor LLM ([08-integrations.md](08-integrations.md)).
- **Riesgos**: no había una política general de reintentos para YCloud (envío) ni HighLevel (sync/booking), ni un mecanismo de "dead letter" para eventos de `webhook_events` que fallan procesamiento repetidamente (podrían quedar reintentándose para siempre, o perderse silenciosamente si el cron no maneja la excepción).
- **Qué mejoraría**: (a) reintento con backoff exponencial + jitter para llamadas salientes a YCloud/HighLevel (máx N intentos); (b) columna `webhook_events.attempts`/`last_error` y un umbral tras el cual el evento se marca `failed` (no se sigue reintentando indefinidamente) y genera una alerta/entrada de auditoría en vez de fallar en silencio.
- **Qué cambiaría**: se agrega esta política como parte de [08-integrations.md](08-integrations.md) y las columnas correspondientes en [02-database.md](02-database.md).
- **Por qué**: sin un techo de reintentos y un estado terminal `failed`, un fallo transitorio de un proveedor externo puede convertirse en un job que consume recursos indefinidamente o en un mensaje que nunca se entrega ni se reporta como no entregado.
- **Impacto**: mensajes/eventos perdidos silenciosamente, jobs colgados.
- **Prioridad**: **Alta**.

## 13. Rate limiting y protección contra abuso

- **Qué está bien**: los rate limits *de los proveedores* (YCloud, OpenRouter) ya están documentados como restricción externa a respetar ([08-integrations.md](08-integrations.md)).
- **Riesgos**: no existía ningún rate limiting **propio** — ni a nivel de los endpoints públicos (`/api/webhooks/*`, que son URLs públicas por definición) ni a nivel de acciones por workspace (cuántos mensajes/tool-calls puede disparar un workspace por minuto), lo que deja la plataforma expuesta a que un solo workspace comprometido o un atacante externo golpeando el endpoint de webhook consuma recursos compartidos (incluyendo cuota de OpenRouter global de la cuenta, ítem 11).
- **Qué mejoraría**: (a) rate limit básico a nivel de Route Handler para los endpoints de webhook (independiente de si el payload es válido, para frenar volumen antes de tocar la base de datos); (b) un límite de tool-calls/mensajes-IA por workspace por minuto, reusando la misma tabla de cuota del ítem 11.
- **Qué cambiaría**: se documenta como parte de [09-security.md](09-security.md), reusando la infraestructura de cuota ya introducida para OpenRouter en vez de crear un mecanismo paralelo.
- **Por qué**: los rate limits de terceros protegen a YCloud/OpenRouter de nosotros — no protegen a la plataforma de un consumidor abusivo propio.
- **Impacto**: degradación de servicio compartido entre todos los workspaces si uno abusa; ningún riesgo de aislamiento de datos (RLS lo cubre) pero sí de disponibilidad.
- **Prioridad**: **Alta**.

## 14. Observabilidad (logs, métricas, auditoría)

- **Qué está bien**: `audit_log` para auditoría de negocio (acciones sensibles, cambios de modo/estado, [09-security.md](09-security.md)) — esto es correcto y suficiente para lo que audita.
- **Riesgos**: `audit_log` es auditoría de negocio, no observabilidad operativa — no hay mención de cómo se detecta *latencia* del pipeline (webhook → buffer → IA → envío), *tasa de error* por proveedor externo, o *costo en tiempo real* por workspace, todo lo cual es necesario para operar la plataforma (no para auditar a un cliente).
- **Qué mejoraría**: (a) un `correlation_id` (puede ser el `conversation_id` + timestamp del flush) propagado a través de todo el pipeline, para poder rastrear un mensaje de punta a punta en logs; (b) usar los logs nativos de Vercel/Supabase (`get_logs` vía MCP de Supabase ya configurado, ver [CLAUDE.md](../../CLAUDE.md)) como primera línea, sin construir un sistema de logging propio prematuramente; (c) un dashboard mínimo (aunque sea una vista SQL) de: eventos de webhook fallidos por proveedor, latencia media de flush de buffer, costo diario por workspace.
- **Qué cambiaría**: se documenta como sección propia (antes ausente) en [09-security.md](09-security.md), explícitamente distinguiéndola de `audit_log`.
- **Por qué**: auditoría de negocio y observabilidad operativa responden preguntas distintas ("¿qué hizo el usuario/la IA?" vs. "¿está el sistema sano?") — conflar ambas en una sola tabla las vuelve ineficientes para ambos propósitos.
- **Impacto**: sin esto, un incidente en producción (p. ej. YCloud degradado) se detecta por quejas de clientes en vez de por monitoreo propio.
- **Prioridad**: **Alta**.

## 15. Recuperación ante fallos de YCloud, OpenRouter y HighLevel

- **Qué está bien**: fallback de modelos ya cubre caídas parciales de OpenRouter a nivel de modelo/proveedor específico ([08-integrations.md](08-integrations.md)).
- **Riesgos**: no había plan para: (a) caída **total** de OpenRouter (todos los modelos/proveedores fallan) — hoy el flujo simplemente fallaría; (b) caída de YCloud — un mensaje que no puede enviarse hoy no tiene un camino claro de reintento/aviso; (c) caída de HighLevel — no debería bloquear la conversación principal (agendar es una acción secundaria).
- **Qué mejoraría**: (a) si OpenRouter falla tras agotar la cadena de fallback, la conversación pasa automáticamente a `pending_human` en vez de quedar sin respuesta (reusa el mecanismo de handoff ya existente, [05-ai-engine.md](05-ai-engine.md), como mecanismo de degradación, no solo de escalamiento por contenido); (b) reintentos con backoff para envío YCloud (ítem 12) y, tras agotar reintentos, el mensaje queda visible en el inbox como "no entregado" para acción humana; (c) toda operación de HighLevel es asíncrona/best-effort respecto al flujo conversacional — nunca bloquea el envío/recepción de un mensaje de WhatsApp.
- **Qué cambiaría**: se formaliza "handoff a humano" como mecanismo también de *degradación por fallo de proveedor*, no solo de escalamiento por contenido de la conversación. Aplicado en [05-ai-engine.md](05-ai-engine.md) y [08-integrations.md](08-integrations.md).
- **Por qué**: reusa un mecanismo que ya existe (handoff) para un problema nuevo (resiliencia), en vez de inventar un estado paralelo de "modo degradado".
- **Impacto**: sin esto, una caída de proveedor externo se traduce directamente en mala experiencia del cliente final (silencio) en vez de una degradación controlada.
- **Prioridad**: **Alta**.

## 16. Escalabilidad para miles de conversaciones simultáneas

- **Qué está bien**: ya identificado como riesgo abierto explícito con mitigación de diseño (suscripción Realtime por conversación abierta + lista, no canal global, [04-inbox.md](04-inbox.md), [10-roadmap.md](10-roadmap.md)).
- **Riesgos**: "miles de conversaciones simultáneas" en el brief original es ambiguo — no se definió si es miles de conversaciones *abiertas en el inbox de un agente a la vez* (cientos de canales Realtime concurrentes, manejable) vs. miles de *mensajes/segundo* de throughput de ingestión (un problema distinto, de escritura, no de Realtime).
- **Qué mejoraría**: mantener la mitigación de diseño ya propuesta (correcta), pero **no fijar un número sin datos reales** — el Blueprint ya evita comprometerse a una cifra y delega la validación a la Fase 8 con carga real, lo cual es la postura correcta dado que no hay datos de producción todavía.
- **Qué cambiaría**: nada por ahora — es explícitamente una decisión de "medir antes de sobre-diseñar", correcta para esta etapa.
- **Por qué**: diseñar para una escala no confirmada es tan riesgoso como no diseñar para ninguna escala.
- **Impacto**: bajo mientras se mantenga como ítem de validación explícito en el roadmap (ya lo está).
- **Prioridad**: **Media** (ya mitigado a nivel de diseño; pendiente de validación empírica, no de rediseño).

## 17. Rendimiento de la base de datos

- **Qué está bien**: índices clave ya identificados (`workspace_id`, `(conversation_id, created_at)`, `(provider, event_id)`, etc., [02-database.md](02-database.md)).
- **Riesgos**: (a) no se consideraba el **connection pooling** — funciones serverless (Vercel) abren conexiones cortas y frecuentes; sin usar el pooler de Supabase (modo transacción/pgbouncer) esto agota conexiones bajo carga; (b) tablas de alto volumen y solo-append (`messages`, `webhook_events`, `audit_log`) no tenían mención de estrategia de particionado/retención a largo plazo.
- **Qué mejoraría**: (a) documentar explícitamente el uso del connection pooler de Supabase para todo acceso desde Route Handlers/Edge Functions; (b) considerar particionado por rango de fecha (mensual) para `messages`/`webhook_events`/`audit_log` como ítem de Fase 8, con política de retención/archivado a definir con el negocio (no técnica pura — cuánto tiempo debe conservarse el historial de mensajes es una decisión de producto/legal).
- **Qué cambiaría**: se agrega nota de pooling (ahora, no opcional) y de particionado (como ítem de escala, Fase 8). Aplicado en [02-database.md](02-database.md), [10-roadmap.md](10-roadmap.md).
- **Por qué**: agotar el pool de conexiones de Postgres es una de las causas más comunes de caída total (no degradación parcial) en arquitecturas serverless+Postgres — es barato de prevenir ahora y muy caro de diagnosticar en producción bajo incidente.
- **Impacto**: (a) caída total de escritura/lectura bajo carga si no se usa pooler; (b) degradación gradual de queries sobre tablas de mensajes/auditoría a medida que crecen sin límite.
- **Prioridad**: **Alta** (pooling, aplica desde ahora) / **Media** (particionado, es preocupación de escala futura).

## 18. Diseño del CRM

- **Qué está bien**: reuso completo del motor de pipeline genérico para oportunidades, sin tablas paralelas ([06-crm.md](06-crm.md)).
- **Riesgos**: el mapeo de etapas hacia HighLevel se dejó como "a definir" en `opportunities.metadata` (jsonb libre) — esto funciona para prototipar pero no da integridad referencial (nada impide que el jsonb quede desalineado del catálogo real de stages de HighLevel).
- **Qué mejoraría**: mover el mapeo a una columna estructurada y genérica en el propio motor de pipeline (no específica de HighLevel, para que cualquier integración externa futura la reuse): `pipeline_stages.external_refs jsonb` con forma `{"highlevel": "stage_id_xyz"}`, en vez de guardar el mapeo colgado de cada `opportunity` individual.
- **Qué cambiaría**: se mueve el mapeo de nivel-oportunidad a nivel-etapa (una sola vez por etapa, no repetido por cada oportunidad). Aplicado en [02-database.md](02-database.md), [06-crm.md](06-crm.md).
- **Por qué**: el mapeo etapa↔proveedor-externo es una propiedad de la etapa (constante), no de cada instancia de oportunidad — guardarlo por oportunidad es normalización incorrecta y permite inconsistencias.
- **Impacto**: bajo (no es un riesgo de seguridad), pero evita deuda técnica de sincronización inconsistente.
- **Prioridad**: **Media**.

## 19. Diseño del ATS

- **Qué está bien**: candidatos como extensión 1:1 de contactos (reuso total del inbox/WhatsApp/motor IA, [07-ats.md](07-ats.md)), pipeline de reclutamiento reusando el mismo motor genérico que CRM.
- **Riesgos**: la decisión de que las entrevistas usen `bookings.provider='internal'` por defecto (no HighLevel) ya estaba marcada como supuesto a confirmar — correcto mantenerla así, pero vale remarcar el riesgo de seguridad adyacente: los CVs (`attachments`) contienen PII sensible (nombre completo, historial laboral, a veces datos de contacto adicionales) y deben tratarse con el mismo rigor de RLS + Storage privado que cualquier dato de cliente, no como "solo un archivo".
- **Qué mejoraría**: confirmar explícitamente en [09-security.md](09-security.md) que el bucket de Storage para adjuntos es privado por workspace (no público ni de acceso por URL directa sin firma), con URLs firmadas de corta duración para visualizar un CV.
- **Qué cambiaría**: se añade esta precisión en [09-security.md](09-security.md) (ya implícita en "Gestión de secretos" pero no explícita para adjuntos/Storage).
- **Por qué**: los CVs son de los datos más sensibles del sistema (PII completa) y el Blueprint no mencionaba explícitamente el modelo de acceso de Storage.
- **Impacto**: exposición de PII de candidatos si el bucket no está correctamente aislado.
- **Prioridad**: **Alta**.

## 20. Arquitectura modular

- **Qué está bien**: enforcement en 3 capas (servidor, RLS, UI) es el diseño correcto — ninguna capa sola es suficiente y las 3 juntas sí lo son ([03-modules.md](03-modules.md)).
- **Riesgos**: ya cubierto en el ítem 2 — el ejemplo de RLS gateado por módulo solo mostraba SELECT.
- **Qué mejoraría**: cubierto por el fix del ítem 2 (mismo patrón para INSERT/UPDATE/DELETE).
- **Qué cambiaría**: nada adicional al ítem 2.
- **Por qué**: ver ítem 2.
- **Impacto**: ver ítem 2.
- **Prioridad**: **Alta** (duplicado del ítem 2, no un hallazgo nuevo independiente).

## 21. Integraciones

- **Qué está bien**: patrón adapter/interfaz ya aísla el detalle de vendor del dominio ([01-architecture.md](01-architecture.md), [08-integrations.md](08-integrations.md)); huecos de documentación de YCloud/HighLevel ya señalados explícitamente en vez de asumidos en silencio.
- **Riesgos**: ya cubiertos en detalle en los ítems 5 (YCloud), 12 y 15 (reintentos/resiliencia), y el hueco de OAuth2 de HighLevel sigue pendiente de un spike de confirmación antes de la Fase 5 (ya estaba en el roadmap).
- **Qué mejoraría**: nada nuevo aquí — es el punto de agregación de los hallazgos de otros ítems.
- **Qué cambiaría**: nada adicional.
- **Por qué**: —
- **Impacto**: —
- **Prioridad**: **Crítica/Alta** (heredada de los ítems 5, 12, 15).

## 22. API pública

- **Qué está bien**: el patrón adapter/módulo ya deja la puerta abierta a exponer una API pública propia en el futuro sin rediseño ([01-architecture.md](01-architecture.md)).
- **Riesgos**: el brief original no pidió explícitamente una API pública de la plataforma hacia sus propios clientes (para que ellos integren *su* CRM/ERP con *nuestra* plataforma) — construirla ahora sería alcance no solicitado.
- **Qué mejoraría**: dejarla **explícitamente fuera de alcance por ahora**, en vez de que su ausencia se lea como un olvido.
- **Qué cambiaría**: se agrega una nota de decisión explícita ("diferido, no un olvido") en [01-architecture.md](01-architecture.md).
- **Por qué**: instrucción del proyecto de no construir antes de que exista un requisito real; documentar la decisión evita que un futuro colaborador la interprete como un gap accidental.
- **Impacto**: ninguno si se documenta la decisión; confusión de alcance si no se documenta.
- **Prioridad**: **Baja** (decisión de alcance, no un riesgo técnico).

## 23. Roadmap técnico

- **Qué está bien**: secuenciación por fases ya prioriza fundación → inbox → CRM → IA → handoff → HighLevel → ATS → automatizaciones → escala, con justificación explícita de por qué ATS va después de que el núcleo esté probado con CRM ([10-roadmap.md](10-roadmap.md)).
- **Riesgos**: varios de los hallazgos **Crítica** de esta auditoría (opt-out, prompt injection, concurrencia de buffer, RLS con `WITH CHECK`/`search_path`, resolución de workspace en webhooks) estaban implícitamente en fases tardías o no tenían fase asignada — un hallazgo crítico de seguridad no puede esperar a la Fase 7.
- **Qué mejoraría**: mover todos los hallazgos **Crítica** de esta auditoría a la Fase 0/1/3 (según a qué capa pertenecen — fundación, inbox, o motor IA respectivamente), no dejarlos como "endurecimiento posterior".
- **Qué cambiaría**: roadmap reordenado con estos ítems explícitamente listados en las fases tempranas correspondientes. Aplicado en [10-roadmap.md](10-roadmap.md).
- **Por qué**: seguridad multi-tenant, cumplimiento legal (opt-out) y corrección de concurrencia no son "mejoras", son requisitos de la Fase 0/1 para cualquier despliegue con datos reales, incluso de un solo cliente piloto.
- **Impacto**: si se difieren, cualquier piloto temprano (incluso con un solo workspace) queda expuesto a los riesgos críticos ya identificados.
- **Prioridad**: **Crítica**.

---

## Resumen ejecutivo (prioridad → acción)

| Prioridad | Hallazgos |
|---|---|
| **Crítica** | Resolución de workspace en webhooks (1); RLS `WITH CHECK`/`search_path` (2); concurrencia de buffer (6); ventana 24h centralizada en adapter (7); opt-in/opt-out (8); prompt injection (9); seguridad de Tools (10); reordenar roadmap (23) |
| **Alta** | Rotación/acceso a Vault (4); autenticidad de webhooks YCloud (5); cuota preflight de OpenRouter (11); reintentos/dead-letter (12); rate limiting propio (13); observabilidad operativa (14); recuperación ante fallos de proveedor (15); connection pooling (17); Storage privado para CVs (19); RLS de escritura por módulo (20, dup. de 2) |
| **Media** | Punto de extensión de roles granulares (3); particionado a futuro (17); mapeo de etapas a nivel-etapa no nivel-oportunidad (18); escalabilidad — validar con datos reales (16) |
| **Baja** | API pública — decisión de alcance diferido (22) |

Todos los hallazgos **Crítica** y **Alta** ya están reflejados como cambios aplicados en los documentos correspondientes del Blueprint (ver referencias cruzadas en cada punto). Ningún cambio elimina funcionalidad descrita previamente — todos son endurecimiento, corrección de un defecto de diseño, o adición de un flujo faltante.
