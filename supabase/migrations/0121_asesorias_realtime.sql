-- Suma asesorias/asesoria_referrals a la publicación de Realtime — las
-- pantallas de Asesorías (/asesorias, /asesorias/presentacion,
-- /asesorias/referidos) muestran KPIs/estadísticas derivadas ("Última
-- actividad", conteo de Referidos) que antes solo se recalculaban al
-- navegar; con esto un componente cliente (RealtimeRefresh.tsx) puede
-- suscribirse a cambios y refrescar la página sola, sin polling. Mismo
-- mecanismo que ya usa conversations (0003_inbox.sql, primer uso de
-- Realtime en el proyecto).
alter publication supabase_realtime add table public.asesorias;
alter publication supabase_realtime add table public.asesoria_referrals;
