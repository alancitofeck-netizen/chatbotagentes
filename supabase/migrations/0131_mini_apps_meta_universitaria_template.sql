-- Reemplaza la plantilla "Calculadora de Capacidad de Generar Ingresos"
-- (calculadora_capacidad_ingresos, agregada en 0130) por "Calculadora de
-- Meta Universitaria" (calculadora_meta_universitaria) en el CÓDIGO — decisión
-- explícita del usuario, aceptando que la instancia ya creada por Diego
-- Tinoco (mini_apps.id 656fdd68-0c4a-4863-8b1a-c34e0ab3b46f) deja de tener
-- página pública funcional. Su fila y sus leads NO se borran acá, así que
-- 'calculadora_capacidad_ingresos' se deja en el constraint como valor
-- huérfano/deprecado (nada en el código la reconoce más) — mismo criterio
-- que 'advisory_sessions' quedó huérfana en workspace_modules_module_key_check
-- (0116) al renombrarse Asesoría Guiada → Asesorías, para no romper filas
-- ya existentes.
alter table public.mini_apps drop constraint if exists mini_apps_template_key_check;
alter table public.mini_apps add constraint mini_apps_template_key_check
  check (template_key in (
    'simulador_retiro', 'calculadora_brecha_retiro', 'app_vinculada', 'diagnostico_financiero',
    'diagnostico_financiero_retiro', 'diagnostico_solidez_financiera', 'calculadora_capacidad_ingresos',
    'calculadora_meta_universitaria'
  ));
