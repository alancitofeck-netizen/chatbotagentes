-- Estado compartido de una mini app alojada ("Vincular App", hostingMode "upload").
-- Pedido: los calendarios de contenido de Sujey y Luis (cuenta de adripuc) tienen que guardar lo que
-- el equipo marca (ej. "Publicado") desde su link público. Esas páginas corren en un iframe sandbox
-- sin allow-same-origin (LinkedAppLanding.tsx): no tienen localStorage ni otra forma de persistir,
-- así que el estado tiene que vivir en el servidor.
--
-- Justificación contra 02-database.md: no existe nada reutilizable para esto — mini_app_leads guarda
-- envíos de visitantes (uno por persona), no un documento único editable; meterlo en mini_apps.config
-- mezclaría configuración con datos y no permite control de concurrencia. Tabla mínima: un JSON por
-- mini app + número de versión (rev) para aplicar cambios sin pisar los de otra persona
-- (update ... where rev = <leída>). Solo se habilita por mini app con config.sharedState = true.
-- Acceso únicamente vía service role desde /api/public/mini-apps/[slug]/shared-state (RLS sin
-- políticas = cerrado para anon/authenticated).

create table public.mini_app_shared_state (
  mini_app_id uuid primary key references public.mini_apps (id) on delete cascade,
  state jsonb not null,
  rev int not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.mini_app_shared_state enable row level security;
