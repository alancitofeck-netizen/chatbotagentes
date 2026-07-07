# 05 — Motor de IA

Vive en `src/lib/ai/`, es parte del **núcleo** (no de un módulo) — tanto CRM (Modo Setter) como ATS (preclasificación de candidatos) son *especializaciones* (prompt + tools distintos) del mismo motor, no motores separados.

> Terminología: la especificación oficial del motor del agente ([13-agent-engine.md](13-agent-engine.md)) llama a la construcción de contexto + llamada a OpenRouter descrita en este documento **Agent Runtime**, al mecanismo de ejecución de herramientas **Tool Router**, y formaliza como **Decision Engine** el paso (descrito abajo como parte del "Flujo IA") que decide si una conversación llega a invocar al modelo. Léanse ambos documentos como uno solo: este cubre el detalle de cada mecanismo, [13-agent-engine.md](13-agent-engine.md) da el diagrama de punta a punta y el nombre de cada componente.

## Prompt Builder

- `ai_prompts` ([02-database.md](02-database.md)): prompt de sistema versionado por workspace y por `module_key`. Estados `draft → active → archived`; solo un prompt `active` por (workspace, module_key) a la vez a nivel de aplicación.
- Los usuarios pueden crear, versionar (nueva fila con `version` incremental, no editar in-place una versión activa), activar y **probar** un prompt (modo sandbox: ejecuta el prompt contra un mensaje de prueba sin enviar nada al contacto real ni tocar `messages`).
- `variables jsonb`: variables dinámicas disponibles al prompt (nombre del contacto, etapa del pipeline, campos personalizados, etc.), interpoladas al construir el contexto.

## Construcción de contexto (por cada turno de IA)

1. Prompt de sistema activo del workspace/módulo.
2. Variables dinámicas resueltas (contacto, CRM/ATS relacionado).
3. Contexto de contacto: campos de `contacts`, tags, notas recientes.
4. Contexto de CRM/ATS: pipeline/etapa actual, oportunidad o postulación asociada.
5. Memoria de conversación: últimos N mensajes (ventana configurable) + resumen si la conversación excede la ventana.
6. Definición de las `tools` habilitadas para ese prompt (`agent_tools`).

## Flujo IA (por flush de buffer, ver [04-inbox.md](04-inbox.md))

```
Decision Engine (13-agent-engine.md): ¿ai_respond?
  → si no (human_respond/wait/escalate/run_automation/invoke_tool_directly): fin, no se llega al Agent Runtime
  → si sí, continúa:

construir contexto (Agent Runtime)
  → chequeo preflight de cuota (workspace_quotas, ver "Límites y costo" abajo) — si excede, no llamar al modelo,
    escalar a pending_human (ver "Degradación por fallo o cuota")
  → POST OpenRouter /chat/completions (modelo(s) + fallback chain de ai_prompts.model_config, tools declaradas)
    con reintento propio (backoff exponencial + jitter, máx N intentos) si la llamada falla a nivel de red/5xx,
    independiente del fallback de modelos que ya hace OpenRouter internamente
  → si la respuesta incluye function_call (Tool Router):
       validar arguments contra el json_schema de la tool — rechazar si no matchea
       re-validar server-side que cualquier entity id referenciado pertenece al workspace_id actual
         (NUNCA confiar en que el modelo "recuerda" el workspace correcto — ver Prompt Injection)
       ejecutar la tool con un idempotency_key derivado de (conversation_id, buffer flush) para evitar
         doble-ejecución ante reintentos (ver Tools)
       registrar la invocación en tool_calls (arguments, result, status, latencia — 13-agent-engine.md)
       responder con function_call_output
       volver a llamar a OpenRouter con el resultado
    (repetir hasta que el modelo devuelva un mensaje final, con límite de iteraciones)
  → registrar usage_events (tokens, costo, modelo) para métering propio
  → enviar vía adapter YCloud (el adapter aplica ventana 24h + opt-out de forma incondicional, ver 04-inbox.md),
    guardar mensaje outbound
  → si agotan los reintentos de OpenRouter (proveedor caído por completo) o el adapter rechaza el envío,
    ver "Degradación por fallo o cuota" abajo — nunca queda la conversación sin ninguna acción
```

## Protección contra prompt injection ([12-security-audit.md](12-security-audit.md) #9)

El contenido de WhatsApp es texto libre controlado por el contacto — un usuario malicioso puede intentar que el modelo ignore sus instrucciones, revele el system prompt/tools disponibles, o invoque una tool fuera de su alcance legítimo. Esto no es un riesgo teórico: es el vector de abuso más probable de toda la plataforma, porque el motor IA tiene tools con efectos secundarios reales (crear oportunidades, agendar citas, mover candidatos de etapa).

Defensas, en capas (ninguna sola es suficiente):

1. **Jerarquía de instrucción explícita en el prompt de sistema**: el contenido del contacto se enmarca siempre como *dato a interpretar*, nunca como *instrucción a seguir* — el prompt de sistema declara explícitamente que ninguna instrucción dentro de un mensaje de contacto puede alterar el system prompt, las tools habilitadas, ni los guardrails de cumplimiento.
2. **Los guardrails de compliance no dependen del modelo**: la ventana de 24h y el opt-out se aplican en el adapter de YCloud de forma incondicional ([04-inbox.md](04-inbox.md)), no como una instrucción que el modelo podría "decidir" ignorar.
3. **Ningún tool handler confía en IDs que el modelo pasa como argumento para autorizar acceso**: todo `contact_id`/`opportunity_id`/`candidate_id`/`vacancy_id` recibido se revalida server-side contra el `workspace_id` de la conversación actual antes de ejecutar — si no pertenece a ese workspace, la tool falla y se registra en `audit_log` como evento de seguridad, no como error silencioso.
4. **El modelo nunca ve system prompt ni definiciones de tools de otro workspace/módulo** — el contexto se construye exclusivamente con datos del propio workspace/conversación (ya garantizado por RLS en las queries que arman el contexto).

## Tools (herramientas activables)

Formato: tool calling estilo OpenAI/OpenRouter (`type:"function"`, `name`, `description`, `parameters` JSON Schema — ver [08-integrations.md](08-integrations.md)). Cada tool tiene una fila en `tools` (`json_schema` + `handler_key`) y un handler en `src/lib/ai/tools/<handler_key>.ts` que ejecuta la acción real contra el núcleo (nunca contra el proveedor externo directamente — pasa por el adapter correspondiente).

Ejemplos de tools iniciales: `search_contact`, `query_crm_context`, `create_opportunity`, `check_agenda_availability`, `create_appointment`, `run_automation`, y (módulo ATS) `score_candidate`, `extract_resume_data`. Un prompt solo puede invocar las tools listadas en `agent_tools` para su fila de `ai_prompts` — activar/desactivar tools por agente es parte de la configuración, no del código.

**Contrato obligatorio de todo tool handler** ([12-security-audit.md](12-security-audit.md) #10), reforzado en el núcleo de IA (no responsabilidad de cada tool individual):

1. Validar `arguments` contra el `json_schema` de la tool — rechazar si no matchea antes de ejecutar cualquier lógica.
2. Re-validar que todo id referenciado pertenece al `workspace_id` de la conversación actual (independiente de lo que el modelo haya "recordado").
3. Para tools con efecto secundario (crear/modificar datos), aceptar un `idempotency_key` y verificar que esa acción no se ejecutó ya para esa clave — evita duplicados ante reintentos del flujo IA o del job de buffer.
4. Registrar la invocación en `tool_calls` ([02-database.md](02-database.md)) — argumentos, resultado, estado y latencia, para trazabilidad técnica del Tool Router ([13-agent-engine.md](13-agent-engine.md)), distinta de la auditoría de negocio en `audit_log`.

## Límites y costo (preflight, [12-security-audit.md](12-security-audit.md) #11)

Registrar el uso en `usage_events` es facturación retroactiva, no una protección. Antes de cada llamada a OpenRouter, se suma el `cost_usd` de `usage_events` del período vigente para el workspace contra `workspace_quotas.ai_monthly_budget_usd` ([02-database.md](02-database.md)); si se excede, no se llama al modelo — la conversación se marca `pending_human` (ver abajo) en vez de generar costo sin techo. El mismo mecanismo de cuota se reutiliza para limitar tool-calls/mensajes-IA por minuto (`workspace_quotas.ai_requests_per_minute`), evitando construir un segundo sistema de límites en paralelo.

## Degradación por fallo o cuota ([12-security-audit.md](12-security-audit.md) #15)

El estado `pending_human` de `conversations.status` (ver Handoff, abajo) no es solo para escalamiento por contenido de la conversación — es también el mecanismo de **degradación ante fallo de proveedor o cuota excedida**: si OpenRouter agota su cadena de fallback de modelos y además los reintentos propios, o si el chequeo de cuota preflight rechaza la llamada, la conversación pasa a `pending_human` en vez de quedar sin ninguna respuesta. Reusa el mecanismo de handoff existente en vez de introducir un estado "degradado" paralelo.

## Handoff humano

Estados de `conversations.mode`: `human | ai | hybrid`, y de `conversations.status`: `open | pending_human | closed`.

Reglas de escalamiento (evaluadas tras cada respuesta de IA, y como re-evaluación del Decision Engine — [13-agent-engine.md](13-agent-engine.md) — cuando la señal viene de dentro del propio turno del Agent Runtime):
- **Automático por señal explícita**: la IA invoca una tool `request_human_handoff` (ella misma decide, según el prompt, cuándo pedirlo — p. ej. el contacto pide hablar con una persona, o detecta frustración). Esta tool no ejecuta el handoff directamente — pasa por el Tool Router, que re-invoca al Decision Engine con la señal recibida.
- **Automático por límite**: N turnos sin avanzar de etapa/objetivo, o confianza baja reportada por el modelo.
- **Manual**: un agente humano toma la conversación en cualquier momento (`mode → human`), lo que **suspende** las respuestas automáticas inmediatamente, incluso si ya había un flush de buffer en curso (el job de flush revalida `mode` justo antes de invocar la IA).
- **Transferencia**: reasignar `assigned_user_id` sin cambiar `mode`.
- Al escalar, `status → pending_human` y se notifica (Realtime + notificación) al responsable asignado o a la cola del equipo.
- Un agente puede devolver la conversación a IA (`mode → ai`, `status → open`) manualmente.

## Modo Setter (especialización del módulo CRM)

Un `ai_prompts` con `module_key='crm'` y un conjunto de tools orientado a: calificación (preguntas de descubrimiento), y agendamiento (`check_agenda_availability` + `create_appointment`). No es un motor distinto — es una configuración de prompt + tools sobre el mismo motor. Detalle de negocio en [06-crm.md](06-crm.md).

## Preclasificación IA (especialización del módulo ATS)

Un `ai_prompts` con `module_key='ats'` orientado a extraer datos de CV (`extract_resume_data` sobre el adjunto en `candidate_applications`) y puntuar al candidato (`score_candidate`) contra los requisitos de la vacante, escribiendo el resultado en `evaluations` o en `candidate_applications.status`. Detalle en [07-ats.md](07-ats.md).
