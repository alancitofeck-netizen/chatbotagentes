-- Agrega la plantilla "Kit de Emergencia Financiera Familiar"
-- (kit_emergencia_financiera_familiar) — nueva, no reemplaza ninguna
-- existente.
alter table public.mini_apps drop constraint if exists mini_apps_template_key_check;
alter table public.mini_apps add constraint mini_apps_template_key_check
  check (template_key in (
    'simulador_retiro', 'calculadora_brecha_retiro', 'app_vinculada', 'diagnostico_financiero',
    'diagnostico_financiero_retiro', 'diagnostico_solidez_financiera', 'calculadora_capacidad_ingresos',
    'calculadora_meta_universitaria', 'kit_emergencia_financiera_familiar'
  ));
