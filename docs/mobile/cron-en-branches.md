# Cron jobs de las migraciones y branches de QA

## Riesgo

Los jobs de pg_cron de las migraciones (`0029`, `0030`, `0034`, `0036`, `0057`, `0059`, `0084`, `0094`, `0101`, `0109`, `0141`, `0145`, `0150`, `0151`, `0168`) llaman con `net.http_get` / `net.http_post` a una URL **fija de producción**: `https://chatbotagentes.vercel.app/api/cron/...`. El Bearer sale de Vault (`decrypted_secret`).

Un branch de Supabase aplica las mismas migraciones, así que programa los mismos jobs en su propia base. Hoy el Vault del branch no tiene los secretos, y el job falla sin efectos. El riesgo aparece si alguien copia el `CRON_SECRET` al Vault del branch para probar: entonces los jobs de WhatsApp (flush cada 15 s), sincronización de calendarios y sheets, y automatizaciones de pólizas y cobranza **pegarían a producción** y generarían efectos reales.

## Estado al 2026-10-05

- Producción tiene 13 jobs activos (pg_cron 1.6.4). 9 apuntan a `chatbotagentes.vercel.app`; 4 llaman a funciones de la propia base (notificaciones).
- Ninguna migración usa claves escritas en el código: los secretos viven en Vault.
- Schedules: todos válidos después del fix de `0034` (`'*/3 * * * *'`). El resto ya usaba sintaxis cron o `N seconds`.

## Propuesta (no aplicada; requiere aprobación)

Opción A (recomendada, mínima): un marcador de entorno que sólo existe en producción.
1. Crear un secret de Vault `environment` con valor `production`, cargado a mano en producción (escritura: requiere tu aprobación).
2. En una migración nueva, envolver los `cron.schedule` en un bloque que sólo programa si ese secret existe. En un branch el secret no existe, así que no se programa ningún job.
3. Regla operativa: nunca copiar `CRON_SECRET` ni otros secrets de producción a un branch. Los secrets de QA se crean aparte.

Opción B (más robusta, más trabajo): la URL base sale de un secret `app_base_url` y los jobs la leen en vez de tener la URL fija. Un branch sin ese secret no llama a ningún lado. Requiere tocar todas las migraciones de cron.

En los dos casos: `0034` y las demás ya aplicadas en producción no se modifican; el guard afecta sólo a los branches.

## Lo que no cambia

- `vault`, `pg_net`, `vector` y la publicación `supabase_realtime` existen por defecto en un branch de Supabase; no requieren cambios.

## Estado del branch qa-mobile (2026-10-05)

- Verificado con la CLI apuntando al branch (directorio temporal enlazado a `evoanshcejupacdtruev`; el enlace del repo a producción no se tocó). Confirmado que la consulta llegó al branch: `auth.users` = 0 (producción tiene usuarios).
- Vault del branch: vacío. Ningún secret copiado.
- Antes: 13 jobs, 9 llamaban a `chatbotagentes.vercel.app` con Bearer de Vault.
- Acción en el branch (no en producción): desprogramados los 9 jobs que llaman a producción: flush-conversation-buffers, sync-kpi-sheets, sync-google-calendar, process-cartera-imports, policy-automations-check, collection-automations-check, run-automations-check, sync-advisor-sheets, referral-followups-check.
- Quedan 4 jobs de notificaciones (`notifications-*`), que llaman a funciones locales de la base y no salen del branch.
- Reprogramar cualquiera de los 9 en el branch requiere resolver la opción A o B de arriba.
