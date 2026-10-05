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

## Opciones para que un branch no pueda llamar a producción (revisión 2026-10-05)

Criterio pedido: un branch no debe poder llamar a producción aunque alguien cargue el Vault.

**Opción A: secret de Vault `environment=production`.** La migración programa los jobs sólo si ese secret existe.
- Pros: simple; no cambia los jobs en sí.
- Contras: **no cumple el criterio**. Quien carga el Vault en un branch puede cargar también ese secret. El guard depende del contenido del Vault.

**Opción B: URL base desde un secret `app_base_url`.** Los jobs leen la URL del Vault.
- Pros: un branch sin el secret no llama a ningún lado; sirve para más entornos.
- Contras: **tampoco cumple el criterio**: cargar el Vault con la URL de producción reactiva los jobs. Además exige reescribir todas las migraciones de cron.

**Opción C (propuesta): setting de base de datos por entorno, fuera del Vault y fuera de las migraciones.**
1. En producción, un operador ejecuta una vez `alter database postgres set app.environment = 'production'`. Es una configuración de la base, no un dato: un branch es una base nueva y no hereda ese setting.
2. Las migraciones de cron programan los jobs sólo si `current_setting('app.environment', true) = 'production'`. Un branch no lo tiene, así que no programa ninguno, aunque alguien cargue el Vault.
3. Las migraciones de cron nunca tocan ese setting; sólo lo leen.
- Pros: cumple el criterio en el uso normal. Cargar el Vault no alcanza. Es una decisión explícita que hay que tomar a propósito en la base.
- Contras: no es una barrera criptográfica: quien tenga rol `postgres` en el branch puede ejecutar el mismo `alter database`. Lo declaro así: el guard evita el riesgo accidental y el de cargar el Vault, no a un operador malintencionado.
- Acción en producción: requiere tu aprobación (el `alter database` es una escritura en producción).

Ninguna opción depende de algo que se pueda copiar con los datos. Si necesitás una garantía criptográfica, la alternativa es que los endpoints de producción rechacen cualquier request que no provenga de su propio pg_cron, lo cual no es posible con pg_net.

Recomendación: C, junto con no copiar secrets de producción a ningún branch.

## Opción C bis: tabla de configuración en lugar de `app.environment` (2026-10-05)

**Motivo del cambio:** `alter database postgres set app.environment = 'production'` falló en producción con `ERROR: 42501: permission denied to set parameter app.environment`. El rol `postgres` de Supabase no es superusuario y no puede definir ese parámetro.

**Qué cambia:** las 19 llamadas a `cron.schedule` de 16 migraciones programan el job sólo si existe la fila `('environment', 'production')` en `private.app_config`. La tabla la crea la migración `0190_private_app_config.sql` (esquema `private`, no expuesto por la API, sin grants a `anon` ni `authenticated`, RLS activo sin policies, sin filas). La fila de producción **no** la inserta la migración: la carga un operador a mano.

**Efecto:**
- Producción: las migraciones de cron ya están aplicadas y no vuelven a correr. Los 13 jobs no cambian. La fila sólo importa para migraciones que se ejecuten de nuevo.
- Un branch: la tabla queda vacía, así que no se programa ningún job de cron de las migraciones.

**SQL para ejecutar en el SQL editor de producción (lo ejecuta el operador, no el asistente):**

```sql
create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_config (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);

revoke all on table private.app_config from public, anon, authenticated;
alter table private.app_config enable row level security;

insert into private.app_config (key, value)
values ('environment', 'production')
on conflict (key) do nothing;
```

**Verificación esperada en producción después de ejecutarlo:** `select key, value from private.app_config;` devuelve `environment | production`, y `select count(*) from cron.job;` sigue dando 13.

**Verificación en `qa-mobile`:** tras la sincronización que aplica `0190`, `private.app_config` existe y está vacía, y ninguno de los 9 jobs que llamaban a producción está programado (se desprogramaron antes). Los 4 jobs de notificaciones que quedaron en el branch son locales a su base y no llaman a producción.

**Límite declarado:** el gate evita el riesgo accidental y el de cargar el Vault. No es una barrera frente a un operador con rol `postgres` en el branch, que podría insertar la misma fila.
