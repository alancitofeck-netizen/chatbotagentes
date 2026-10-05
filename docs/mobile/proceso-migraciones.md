# Proceso de migraciones (desde 2026-10-05)

Regla: las migraciones de base de datos se agregan **solo como archivo** en `supabase/migrations/`, se prueban en el branch `qa-mobile` (sincronizado con `mobile-paridad`) y llegan a producción **por merge** a `main`.

No se aplican migraciones a producción con el MCP de Supabase (`apply_migration`) ni con SQL de escritura directo. Las lecturas (`list_migrations`, `execute_sql` de solo lectura) sí están permitidas.

## Por qué

El registro de producción (`supabase_migrations.schema_migrations`) tenía 112 filas con versiones de timestamp (`20260707042058`…), porque algunas migraciones se aplicaron con el MCP y recibieron ese formato. Los archivos locales usan prefijos `0001`…`0188`. La CLI no podía relacionar ambos, y un `db push` habría intentado volver a ejecutar las 186 migraciones sobre producción.

## Repair aplicado (2026-10-05)

1. Backup: `docs/mobile/schema_migrations_backup.sql` (versión, nombre y md5 de los statements de las 112 filas).
2. Datos de las migraciones sin correspondencia por nombre: se verificó en producción que existen las herramientas (`tools`), los buckets de Storage y el admin de plataforma que esas migraciones insertan.
3. Dry-run previo: `Remote migration versions not found in local migrations directory` (el error que se quería reparar).
4. Repair:
   - `supabase migration repair --status applied` sobre las 186 versiones locales.
   - `supabase migration repair --status reverted` sobre los 112 timestamps del registro.
5. Verificación: `supabase db push --dry-run` -> `{"upToDate":true,"migrations":[]}`. El registro quedó con 186 filas, todas locales.

Limitación: el repair marca como aplicadas las 186 versiones con base en la verificación de esquema y de datos descrita arriba (tablas, funciones, políticas, extensiones, cron y una muestra de datos), no con una comparación de cada statement contra el registro original.

## Flujo de una migración nueva

1. Crear el archivo `supabase/migrations/NNNN_descripcion.sql` con el siguiente número libre.
2. Probar en el branch `qa-mobile`: se aplica desde cero junto con el seed versionado.
3. Revisar la salida de `supabase db push --dry-run` contra el branch.
4. Mergear a `main` (con aprobación). Al mergear, el panel de Supabase despliega las pendientes a producción.

Si una migración ya aplicada necesita un cambio, se escribe otra migración; no se edita la aplicada, salvo para agregar guardas que no cambian lo que ya hizo en producción (como el guard de `0182`).

## Cambios de esta ronda en el repo

- `0182_seed_sujey_content_calendar.sql`: guard para no insertar si el workspace no existe. En producción no cambia nada, porque la migración ya estaba aplicada.
