-- Agenda/Operación/KPIs del módulo Clientes necesitan "Fuente" (canal de la
-- cita: LinkedIn/Referido/Meta Ads) y "Campaña" (etiqueta de audiencia,
-- propia de cada asesor) para el funnel/distribución de fuentes de la
-- referencia visual — confirmado que NO existe ningún campo así hoy (ni acá
-- ni en contacts), y el usuario eligió agregar los campos reales + carga
-- manual en vez de mostrar solo lo que ya había. Arrancan vacíos: se cargan
-- a mano desde la pestaña Agenda, cita por cita, no hay integración con
-- LinkedIn/Meta Ads.
alter table public.bookings add column if not exists fuente text
  check (fuente is null or fuente in ('linkedin', 'referido', 'meta_ads', 'otro'));

-- Texto libre (como contacts.source) — los nombres de campaña son propios
-- de cada asesor (ej. "Abogados", "Empresarios"), no un catálogo fijo.
alter table public.bookings add column if not exists campana text;

-- Resultado cualitativo del lead en esa cita — distinto de bookings.status/
-- attended (que ya cubren Show/No-show/Cancelada/Reagendada).
alter table public.bookings add column if not exists resultado text
  check (resultado is null or resultado in ('interesado', 'calificado', 'sin_respuesta', 'no_interesado'));
