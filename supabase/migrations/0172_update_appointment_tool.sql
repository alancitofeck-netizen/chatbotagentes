-- Habilita "Agente de Citas" de verdad en el Constructor de Agentes IA
-- (/agentes-ia/nuevo) — create_appointment ya existe pero no hay forma de
-- que el agente reprograme o cancele una cita ya creada. Mismo patrón
-- exacto que 0167_referrals_ai_agent.sql (catálogo global de tools, un solo
-- insert). "Confirmar cita" no necesita tool propia: bookings.status no
-- tiene un estado "confirmada" distinto de "scheduled", así que confirmar
-- es conversación natural del agente, no una mutación — no se fabrica un
-- estado que no existe.
insert into public.tools (key, name, description, handler_key, json_schema) values (
  'update_appointment',
  'Reprogramar o cancelar cita',
  'Reprograma o cancela la cita agendada más reciente del contacto actual.',
  'update_appointment',
  '{
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "enum": ["reschedule", "cancel"],
        "description": "reschedule para cambiar el horario, cancel para cancelar la cita."
      },
      "new_start_time": {
        "type": "string",
        "description": "Nuevo horario en formato ISO 8601 — obligatorio si action es reschedule."
      }
    },
    "required": ["action"]
  }'::jsonb
)
on conflict (key) do nothing;
