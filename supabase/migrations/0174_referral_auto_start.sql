-- "Iniciar conversación automáticamente ni bien se cargan los referidos"
-- — pedido explícito. Dos columnas aditivas:

-- 1. Toggle por agente, default false (mismo criterio seguro ya usado en
-- whatsapp_referrals_only/referral_followup_mode: se prende a propósito,
-- nunca por defecto para todo el mundo).
alter table public.ai_agents add column if not exists auto_start_conversations boolean not null default false;

-- 2. Idempotencia: el shim del Meeting OS de Asesorías autoguarda cada
-- ~400ms, así que asesoria_referrals se upsertea muchas veces para el
-- mismo referido mientras el asesor completa la reunión. Sin esta marca,
-- cada autoguardado dispararía un intento de auto-inicio de nuevo. Se
-- marca ANTES de generar/enviar el mensaje (no después) — si el proceso
-- se interrumpe a mitad de camino, nunca se reintenta un duplicado; en el
-- peor caso el referido queda con status='nuevo' para iniciarlo a mano.
alter table public.asesoria_referrals add column if not exists conversation_started_at timestamptz;
