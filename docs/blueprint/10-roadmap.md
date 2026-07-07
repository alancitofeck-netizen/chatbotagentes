# 10 — Roadmap, riesgos y decisiones

## Roadmap por fases

> **Nota post-auditoría** ([12-security-audit.md](12-security-audit.md) #23): los hallazgos de prioridad **Crítica** de la auditoría se movieron explícitamente a las fases tempranas donde corresponden por capa — no son "endurecimiento posterior", son requisitos de esas fases, válidos incluso para un único workspace piloto. Están marcados con **[AUDITORÍA]** abajo.

**Fase 0 — Fundación**
Workspaces, membresía/roles, RLS base ([09-security.md](09-security.md)), esquema núcleo ([02-database.md](02-database.md)), mecanismo `workspace_modules` ([03-modules.md](03-modules.md)) aunque todavía sin módulos que activar.
- **[AUDITORÍA]** Policies RLS separadas por comando (`WITH CHECK` en INSERT, no `USING`) y funciones `SECURITY DEFINER` con `search_path` fijo desde la primera migración (#2).
- **[AUDITORÍA]** Connection pooling (Supabase pooler/pgbouncer) para todo acceso desde Route Handlers/Edge Functions desde el primer despliegue, no como optimización posterior (#17).

**Fase 1 — Inbox + YCloud**
Adapter YCloud, ingestión de webhooks (`webhook_events`), inbox humano (sin IA todavía): lista, hilo, estado, etiquetas, asignación, búsqueda, filtros, notas, adjuntos, tiempo real ([04-inbox.md](04-inbox.md)).
- **[AUDITORÍA]** Resolución de `workspace_id` en webhooks siempre por `to`/`wabaId`, nunca por `from` (#1).
- **[AUDITORÍA]** Autenticidad del webhook (header secreto + secreto de path) antes de insertar en `webhook_events` (#5).
- **[AUDITORÍA]** Reintentos con backoff + techo (`webhook_events.attempts`/`status='failed'`) desde el primer adapter, no agregados después (#12).
- **[AUDITORÍA]** `contacts.whatsapp_opt_status` y enforcement de opt-out en el adapter de envío desde el primer mensaje saliente — no es una función "de cumplimiento" separable, es parte de poder enviar mensajes en absoluto (#8).
- **[AUDITORÍA]** Storage privado + URLs firmadas para adjuntos desde la primera subida de archivo (#19).

**Fase 2 — CRM base**
Contactos enriquecidos, pipeline genérico ([02-database.md](02-database.md)) instanciado para oportunidades, notas/actividad, módulo CRM activable ([06-crm.md](06-crm.md)) sin IA todavía.
- **[AUDITORÍA]** `pipeline_stages.external_refs` a nivel de etapa (no por oportunidad) desde el primer mapeo con HighLevel (#18).

**Fase 3 — Motor IA**
Prompt Builder, integración OpenRouter, buffer inteligente ([04-inbox.md](04-inbox.md)), tools framework con tools base, modo IA/híbrido ([05-ai-engine.md](05-ai-engine.md)).
- **[AUDITORÍA]** Claim atómico de `conversation_buffers` (`status`/`claimed_at`) desde el primer job de flush — la concurrencia no es un caso extremo raro, es el modo normal de operación con más de un mensaje en ráfaga (#6).
- **[AUDITORÍA]** Defensas de prompt injection (jerarquía de instrucción, re-validación server-side de todo id que usa una tool) y contrato de tool handler (validar esquema + revalidar workspace + idempotency key) desde la primera tool con efecto secundario, no después de tener varias (#9, #10).
- **[AUDITORÍA]** `workspace_quotas` y chequeo preflight de costo antes de cada llamada a OpenRouter desde el primer prompt activo — el métering retroactivo por sí solo no es una protección (#11, #13).
- **[AUDITORÍA]** Degradación a `pending_human` ante fallo total de proveedor o cuota excedida, reusando el mecanismo de handoff (#15).

**Fase 4 — Handoff + Modo Setter**
Reglas y estados de escalamiento, Modo Setter del CRM integrado con agenda interna.

**Fase 5 — HighLevel**
OAuth (confirmar antes el hueco de documentación, [08-integrations.md](08-integrations.md)), sync de contactos/oportunidades, calendario externo para agenda del CRM.

**Fase 6 — Módulo ATS**
Vacantes, candidatos (extensión de contactos), pipeline de reclutamiento (reuso del motor genérico), entrevistas/agenda, evaluaciones, IA de preclasificación, reportes/dashboard RR. HH. ([07-ats.md](07-ats.md)). Se secuencia después de que el motor de pipeline y el motor IA del núcleo estén sólidos en producción con el módulo CRM, para heredar esa estabilidad en vez de construir ambos módulos en paralelo sobre un núcleo aún cambiante.

**Fase 7 — Automatizaciones + endurecimiento**
Motor de automatizaciones, métering de OpenRouter para facturación ([08-integrations.md](08-integrations.md)), auditoría/compliance completos, observabilidad de costos.

**Fase 8 — Escala**
Revisar límites de Supabase Realtime a volumen real, evaluar necesidad de mover el procesamiento asíncrono fuera de pg_cron/Edge Functions si el volumen lo exige (ver riesgos abajo).

## Riesgos técnicos

| Riesgo | Detalle | Mitigación propuesta |
|---|---|---|
| Verificación de webhooks de YCloud no confirmada | Ver [08-integrations.md](08-integrations.md) | Confirmar con soporte YCloud antes de producción; interim: secret en URL + `webhook_events` idempotente |
| OAuth2 de HighLevel con detalles no confirmados | Scopes/endpoints exactos no documentados públicamente | Spike de confirmación contra dashboard real antes de Fase 5 |
| OpenRouter sin métering nativo por sub-cliente | Riesgo de sobrecosto no atribuible | Construir `usage_events` y límites propios por workspace desde Fase 3 |
| Procesamiento asíncrono 100% serverless | Límite ~150s en Edge Functions; pg_cron con granularidad de segundos, no verdaderamente en tiempo real | Diseñar todo job como idempotente/reanudable; medir en Fase 3 si la latencia del buffer es aceptable |
| Supabase Realtime a "miles de conversaciones simultáneas" | No hay cifra de límite confirmada para este proyecto | Suscripción por conversación abierta + lista, no canal global; revisar en Fase 8 con carga real |
| Ventana de 24h de WhatsApp | Enviar fuera de ventana sin plantilla aprobada viola política de Meta | Guardrail obligatorio en el motor IA y en el envío manual ([09-security.md](09-security.md)) |
| Tokens de HighLevel por workspace (muchos refresh tokens) | Exposición si se filtran | Supabase Vault + job de refresco proactivo antes de expiración |
| Alcance de "Movinsa" sin aclarar | Ver [00-product.md](00-product.md) | No bloquea el plan; confirmar con el usuario |
| Prompt injection vía contenido de WhatsApp | Tools con efectos secundarios reales invocadas por un LLM alimentado con texto de un contacto no confiable | Jerarquía de instrucción + re-validación server-side de todo id en cada tool handler ([05-ai-engine.md](05-ai-engine.md), [12-security-audit.md](12-security-audit.md) #9) |
| Falta de opt-in/opt-out (omisión del diseño original) | Envíos a contactos dados de baja violan política de Meta y regulación local | `whatsapp_opt_status` + enforcement incondicional en el adapter ([09-security.md](09-security.md) #8) |
| Concurrencia no controlada en el buffer | Doble respuesta de IA / doble ejecución de tools si el cron se solapa | Claim atómico `UPDATE...RETURNING` ([04-inbox.md](04-inbox.md) #6) |
| RLS con sintaxis incorrecta en INSERT / sin `search_path` fijo | Falsa sensación de protección; vector teórico de escalación de privilegios | Policies separadas por comando + `search_path=''` ([09-security.md](09-security.md) #2) |
| Métering de OpenRouter solo retroactivo | Sobrecosto sin techo ante bug o abuso | Chequeo preflight contra `workspace_quotas` ([05-ai-engine.md](05-ai-engine.md) #11) |

## Decisiones de arquitectura (con justificación)

1. **Multi-tenancy por columna + RLS**, no schema-per-tenant. *Por qué*: patrón estándar de Supabase, administración cross-tenant simple, sin overhead operativo de N esquemas.
2. **Motor de pipeline genérico** (`pipelines`/`stages`/`items`) compartido entre oportunidades de CRM y pipeline de reclutamiento de ATS. *Por qué*: mismo concepto de negocio (embudo con etapas configurables) — construirlo dos veces sería duplicación pura.
3. **Candidatos como extensión 1:1 de Contactos**, no entidad paralela. *Por qué*: preserva el hilo de WhatsApp/identidad único por persona sin importar si es "prospecto" o "candidato"; requisito explícito de integración completa con el inbox.
4. **Cola/estado en Postgres + Cron**, no infraestructura de colas externa. *Por qué*: se ajusta al stack obligatorio (Vercel + Supabase, sin servidor propio); suficiente para el volumen inicial; el buffer inteligente necesita sobrevivir a cold starts serverless, lo cual una cola externa no resuelve mejor que una fila de estado inspeccionable con SQL.
5. **Adapter/interfaz por integración** (`MessagingProvider`/`LLMProvider`/`CRMProvider`). *Por qué*: aísla el detalle de vendor del dominio; aunque hoy hay una sola implementación por interfaz, evita que rate limits/formatos de payload de YCloud/OpenRouter/HighLevel se filtren a la lógica de negocio.
6. **Activación de módulos en 3 capas** (servidor, RLS, UI). *Por qué*: la UI sola es solo UX, no seguridad; el servidor solo es el enforcement real pero un bug lo puede saltar; RLS es la última línea de defensa a nivel de dato.
7. **Métering propio de OpenRouter por workspace**. *Por qué*: OpenRouter gobierna límites/costo a nivel de cuenta global, no por sub-cliente — sin esta capa no hay forma de facturar ni limitar abuso por workspace.
8. **Fase ATS después de CRM**, no en paralelo. *Por qué*: ATS depende fuertemente del motor de pipeline y del motor IA genéricos — construirlos ambos a la vez arriesga tener que rehacer el núcleo mientras dos módulos lo estresan simultáneamente.
9. **Guardrails de cumplimiento (ventana 24h, opt-out) centralizados en el adapter de YCloud, no en cada flujo llamador** ([12-security-audit.md](12-security-audit.md) #7, #8). *Por qué*: un guardrail que depende de que cada punto de llamada (IA, humano, automatización, tool) lo implemente correctamente es frágil por construcción; centralizarlo en el único punto de salida lo hace imposible de saltarse por omisión.
10. **Handoff humano como mecanismo también de degradación técnica**, no solo de escalamiento por contenido ([12-security-audit.md](12-security-audit.md) #15). *Por qué*: reusa un estado/flujo que ya existe (`pending_human`) para un problema nuevo (fallo total de proveedor o cuota excedida) en vez de introducir un estado "degradado" paralelo.
11. **Cuota (`workspace_quotas`) compartida entre control de costo de IA y rate limiting de abuso**, no dos mecanismos separados ([12-security-audit.md](12-security-audit.md) #11, #13). *Por qué*: ambos problemas ("no gastar de más" y "no dejar que un workspace abuse del recurso compartido") se resuelven con la misma pregunta — cuánto ha consumido este workspace en esta ventana de tiempo.

## Lista de tareas de implementación (por fase, checklist)

**Fase 0**
- [ ] Migraciones: `workspaces`, `workspace_members`, `workspace_modules`, funciones RLS (`is_workspace_member`, `has_workspace_role`) con `search_path` fijo.
- [ ] Policies separadas por comando (`WITH CHECK` en INSERT) desde la primera tabla.
- [ ] Connection pooler de Supabase configurado para todo acceso desde Next.js.
- [ ] UI de creación de workspace + invitación de miembros.

**Fase 1**
- [ ] Adapter YCloud (`sendMessage` con guardrail de ventana 24h + opt-out incondicionales, `sendWebhook` con verificación de autenticidad, reintentos con backoff + techo).
- [ ] Route Handler `/api/webhooks/ycloud` (autenticidad → `webhook_events` con `attempts`/`status` → resolución de `workspace_id` por `to`/`wabaId`).
- [ ] Migraciones: `contacts` (incl. `whatsapp_opt_status`), `conversations`, `messages`, `tags`, `notes`, `attachments`, bucket privado de Storage + URLs firmadas.
- [ ] UI de inbox (lista + hilo + realtime).

**Fase 2**
- [ ] Migraciones: `pipelines`, `pipeline_stages`, `pipeline_items`, `opportunities`.
- [ ] UI de tablero kanban (componente reutilizable para CRM y ATS).
- [ ] Activación del módulo `crm` en `workspace_modules`.

**Fase 3**
- [ ] Adapter OpenRouter (`complete`, manejo de `models`/`provider`, tool calling, reintento propio con backoff).
- [ ] Migraciones: `ai_prompts`, `tools`, `agent_tools`, `conversation_buffers` (con `status`/`claimed_at`), `usage_events`, `workspace_quotas`.
- [ ] Job de flush de buffer con claim atómico (`UPDATE...RETURNING`) + flujo IA completo ([05-ai-engine.md](05-ai-engine.md)).
- [ ] Contrato de tool handler: validación de esquema + re-validación de workspace + idempotency key, aplicado desde la primera tool con efecto secundario.
- [ ] Chequeo de cuota preflight contra `workspace_quotas` antes de cada llamada a OpenRouter.
- [ ] Prompt Builder UI (crear/versionar/activar/probar).

**Fase 4**
- [ ] Reglas de handoff + UI de escalamiento/reasignación.
- [ ] Modo Setter (prompt + tools de agenda interna).

**Fase 5**
- [ ] Spike de confirmación OAuth2 HighLevel (bloqueante antes de codificar el flujo).
- [ ] Adapter HighLevel (`upsertContact`, `upsertOpportunity`, `checkAvailability`, `createBooking`, webhooks).
- [ ] Migración: `bookings`, `integration_connections`.

**Fase 6**
- [ ] Migraciones: `vacancies`, `candidates`, `candidate_applications`, `interviews`, `evaluations`.
- [ ] Tools de IA de preclasificación (`extract_resume_data`, `score_candidate`).
- [ ] Vistas de reportes ATS + dashboard RR. HH.
- [ ] Activación del módulo `ats` en `workspace_modules`.

**Fase 7**
- [ ] Motor de automatizaciones (`automations`) + UI.
- [ ] Dashboard de costo/uso de OpenRouter por workspace.
- [ ] Auditoría completa (`audit_log`) en todas las acciones sensibles.

**Fase 8**
- [ ] Pruebas de carga de Realtime y del job de buffer a volumen objetivo.
- [ ] Revisión de si pg_cron/Edge Functions siguen siendo suficientes o se requiere un worker dedicado.
