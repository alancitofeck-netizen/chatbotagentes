-- Fills in real json_schema for the tools that get a real handler this pass
-- (src/lib/ai/tools/<handler_key>.ts, Fase 5) and seeds the one tool named in
-- docs/blueprint/05-ai-engine.md's Handoff section that wasn't part of the
-- original 8 seeded rows (0007_ai_prompts.sql): `request_human_handoff`.
--
-- `score_candidate`/`extract_resume_data` are deliberately left with
-- json_schema='{}' and no handler — confirmed blocker this round (no
-- `attachments` table, no CV upload flow in the ATS UI yet).

update public.tools set json_schema = '{
  "type": "object",
  "properties": {
    "name": {"type": "string", "description": "Nombre o parte del nombre del contacto a buscar."},
    "phone": {"type": "string", "description": "Teléfono del contacto, si se conoce."},
    "company": {"type": "string", "description": "Empresa del contacto, si se conoce."}
  }
}'::jsonb
where key = 'search_contact';

update public.tools set json_schema = '{
  "type": "object",
  "properties": {
    "contact_id": {"type": "string", "description": "Id del contacto actual de la conversación."}
  },
  "required": ["contact_id"]
}'::jsonb
where key = 'query_crm_context';

update public.tools set json_schema = '{
  "type": "object",
  "properties": {
    "contact_id": {"type": "string", "description": "Id del contacto para el que se crea la oportunidad."},
    "title": {"type": "string", "description": "Título de la oportunidad."},
    "value": {"type": "number", "description": "Valor estimado de la oportunidad."},
    "currency": {"type": "string", "description": "Moneda (ISO 4217), por defecto USD."}
  },
  "required": ["contact_id", "title"]
}'::jsonb
where key = 'create_opportunity';

update public.tools set json_schema = '{
  "type": "object",
  "properties": {
    "date": {"type": "string", "description": "Fecha a consultar, formato YYYY-MM-DD."},
    "duration_minutes": {"type": "integer", "description": "Duración deseada en minutos, por defecto 30."}
  },
  "required": ["date"]
}'::jsonb
where key = 'check_agenda_availability';

update public.tools set json_schema = '{
  "type": "object",
  "properties": {
    "contact_id": {"type": "string", "description": "Id del contacto con quien se agenda la reunión."},
    "start_time": {"type": "string", "description": "Fecha y hora de inicio, ISO 8601."},
    "duration_minutes": {"type": "integer", "description": "Duración en minutos, por defecto 30."},
    "subject": {"type": "string", "description": "Asunto/título de la reunión."}
  },
  "required": ["contact_id", "start_time"]
}'::jsonb
where key = 'create_appointment';

update public.tools set json_schema = '{
  "type": "object",
  "properties": {
    "automation_id": {"type": "string", "description": "Id de la automatización a ejecutar."}
  },
  "required": ["automation_id"]
}'::jsonb
where key = 'run_automation';

insert into public.tools (key, name, description, handler_key, json_schema) values
  (
    'request_human_handoff',
    'Solicitar handoff a humano',
    'Pide que un agente humano tome la conversación (el contacto lo pidió, o detectaste que la IA no puede continuar).',
    'request_human_handoff',
    '{
      "type": "object",
      "properties": {
        "reason": {"type": "string", "description": "Motivo breve del handoff."}
      },
      "required": ["reason"]
    }'::jsonb
  )
on conflict (key) do nothing;
