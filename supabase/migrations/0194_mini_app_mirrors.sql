-- Mini Apps espejo: la misma Mini App visible en dos workspaces, con la misma
-- URL pública, y cada lead entrando a los dos.
--
-- Cada workspace sigue teniendo sus PROPIAS filas (mini_apps, mini_app_leads,
-- contacts, insurance_prospects, visitas, eventos): el espejo es una fila más
-- de mini_apps en el otro workspace, con `mirror_of` apuntando a la original.
-- Así no cambia ninguna RLS ni ninguna consulta por workspace — lo único
-- nuevo es que la ingesta (ingest.ts) y los contadores públicos (visit/track)
-- copian cada escritura a los espejos de la Mini App.
--
-- El espejo usa el MISMO slug que la original, así ambas cuentas muestran la
-- misma URL. Por eso el unique de slug pasa a aplicar solo a las originales
-- (mirror_of is null); toda resolución pública por slug filtra
-- `mirror_of is null`, así que una URL siempre resuelve a una sola fila.

alter table public.mini_apps
  add column if not exists mirror_of uuid references public.mini_apps (id) on delete restrict;

alter table public.mini_apps
  add constraint mini_apps_mirror_not_self check (mirror_of is null or mirror_of <> id);

alter table public.mini_apps drop constraint if exists mini_apps_slug_key;
create unique index if not exists mini_apps_slug_key on public.mini_apps (slug) where mirror_of is null;

create index if not exists mini_apps_mirror_of_idx on public.mini_apps (mirror_of) where mirror_of is not null;
