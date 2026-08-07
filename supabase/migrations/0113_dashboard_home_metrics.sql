-- Rediseño del home del Dashboard — dos columnas nuevas para que "Se
-- presentaron" (% de asistencia) y "Tiempo promedio de cierre" sean datos
-- reales en vez de fabricados (ver el chequeo explícito con el usuario):
-- ninguna de las dos se puede calcular hoy con lo que ya existe.

-- null = todavía sin marcar (la mayoría de las reuniones pasadas, hoy);
-- true/false = alguien marcó si el contacto asistió o no. Deliberadamente
-- NO se reusa bookings.status ('scheduled'/'rescheduled'/'cancelled'/
-- 'completed') — ese campo no distingue "se realizó" de "el contacto no
-- vino", y nada lo escribe hoy salvo la cancelación manual.
alter table public.bookings add column if not exists attended boolean;

-- Se completa solo la primera vez que una oportunidad entra a una etapa
-- is_won=true (moveOpportunityCard, src/lib/crm/actions.ts) — nunca se
-- pisa si ya tenía valor, así un vaivén de etapas no lo corre. Arranca en
-- null para todo lo ya cerrado antes de esta migración a propósito: no hay
-- forma honesta de reconstruir esa fecha retroactivamente (no existe un
-- registro histórico confiable de cuándo pasó a "Ganado"), así que
-- "Tiempo promedio de cierre" solo promedia cierres de acá en adelante.
alter table public.opportunities add column if not exists closed_at timestamptz;
