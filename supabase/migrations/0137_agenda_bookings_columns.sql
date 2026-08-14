-- Sistema de Agendas (citas) — extiende bookings de forma aditiva, sin
-- tocar su CHECK de status/attended ni su RLS (ver plan): status/attended
-- siguen alimentando /calendar y el push a Google Calendar exactamente
-- igual que hoy. estado_cita es un vocabulario NUEVO y separado, propio del
-- flujo setter→asesor (nulo = cita genérica de /calendar, no participa).
alter table public.bookings add column if not exists setter_id uuid references public.workspace_members (id) on delete set null;
alter table public.bookings add column if not exists source text check (source is null or source in ('manual', 'google_sheets'));
alter table public.bookings add column if not exists estado_cita text check (
  estado_cita is null or estado_cita in ('agendada', 'confirmada', 'realizada', 'no_show', 'cancelada', 'venta')
);

create index if not exists bookings_setter_idx on public.bookings (setter_id) where setter_id is not null;
