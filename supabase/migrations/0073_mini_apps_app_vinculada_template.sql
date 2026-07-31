-- Registra la tercera plantilla de Mini Apps ("App Vinculada" — botón
-- "Vincular App", Fase 1: conectar una app HTML externa por URL) en el CHECK
-- de template_key — mismo patrón drop/re-add que
-- 0064_calculadora_brecha_retiro_template.sql.

alter table public.mini_apps drop constraint if exists mini_apps_template_key_check;
alter table public.mini_apps add constraint mini_apps_template_key_check
  check (template_key in ('simulador_retiro', 'calculadora_brecha_retiro', 'app_vinculada'));
