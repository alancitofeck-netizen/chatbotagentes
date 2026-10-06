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

## Verificación de efectos de las migraciones sin correspondencia (2026-10-05)

Las migraciones sin entrada con el mismo nombre en el registro original, que escriben datos a nivel de sentencia (no dentro de funciones). Verificadas en producción en sólo lectura:

| Migración | Escritura | Efecto en producción |
|---|---|---|
| 0007 | insert tools | Presente: 8 claves de tools (las de 0007 y 0167). |
| 0022 | update tools.json_schema | Presente: 4 tools con json_schema no nulo. |
| 0024 | insert ai_agents, update ai_prompts, agent_tools | Presente: 3 agentes; 0 prompts y 0 agent_tools sin agente. |
| 0039 | insert platform_admins | Presente (el admin de plataforma existe). Ver guard en el repo. |
| 0049, 0052, 0056, 0067, 0102, 0158 | insert storage.buckets | Presentes: avatars, whatsapp-web-sessions, cartera_imports, task-group-covers, presentation-assets, whatsapp-media. |
| 0065, 0066, 0102, 0103, 0116, 0124, 0167 | insert workspace_modules (backfill) | Presente en la mayoría de los workspaces. Faltan en 1-5 workspaces (los creados después del backfill se aprovisionan desde la app). **0124** insertó la clave `clientes`, renombrada a `asesores` por 0129; `asesores` existe en producción. |
| 0142 | delete appointment_sheet_rows; update appointment_sheet_connections | Tablas renombradas por 0145 y datos re-sincronizados: el efecto transitorio no es verificable. |
| 0029, 0030, 0034, 0036, 0057, 0059, 0141, 0168 (cron) | cron.schedule / unschedule | Presentes los 13 jobs de producción con sus schedules. `sync-appointment-sheets` (0141) ausente, desprogramado por 0145. |

## Numeración de las migraciones

- 186 versiones reparadas corresponden a los 186 archivos locales (0001–0188 con 2 huecos: 0048 y 0164; sin duplicados). Con 0189, el repo tiene 187 archivos.
- Los huecos son archivos que nunca existieron en el repo, no archivos borrados por el repair.
- **Hallazgo:** el registro original tenía además 6 entradas sin archivo local: `0012b`, `0012c` y `0050b`–`0050e` (fixes aplicados directamente con sufijo). El repair las marcó como `reverted` y el backup guardó sólo su md5, no el texto. Los efectos siguen en producción (por ejemplo `upsert_whatsapp_integration`, `provision_whatsapp_web_session`), pero el repo no tiene su SQL. Recuperarlo implica exportar las definiciones actuales de esas funciones y revisarlas antes de commitear.

## Regla para operaciones que borran filas del registro (2026-10-05)

Antes de ejecutar `supabase migration repair --status reverted` (que borra filas de `supabase_migrations.schema_migrations`), hay que **guardar el texto completo de los statements** de cada fila afectada, no sólo su md5. El md5 permite verificar, pero no restaurar: en el repair original se perdieron así los statements de `0012b`, `0012c` y `0050b`–`0050e`, que no tienen archivo en el repo. El backup debe incluir `version`, `name` y `statements` completos (por ejemplo con `string_agg` a un archivo versionado, o con `pg_dump` si hay Docker disponible), y el archivo se commitea antes de ejecutar el repair.

## Módulos de workspace: faltantes y causa (2026-10-05, sólo lectura en producción)

Los backfills de `workspace_modules` (0065, 0066, 0102, 0103, 0116, 0124, 0167) se aplicaron a los workspaces que existían en su momento. Los workspaces creados después no reciben los módulos que el backfill agregó, porque `src/lib/auth/provision-workspace.ts` asigna una lista fija de 14 módulos que quedó desactualizada.

- **Workspaces creados antes de cada backfill** (7-jul a 24-jul): tienen todos los módulos.
- **Creados después** (4-ago a 3-oct): faltan `presentations`, `referrals`, `advisory_sessions` y `asesores`, según el caso.
- **Impacto:** `asesores` controla la entrada de Asesores en el sidebar, y `presentations` la de Presentaciones. Un workspace nuevo no ve esas entradas. El acceso directo por URL no cambia.
- **Workspaces afectados:** Polizas Cal (4-ago), Verify Test Emergencia ×2 (12-ago), leonardomaganah (12-sep), Workspace de qa-mobile (3-oct), y pjaikc (7-ago, sólo `presentations`).

Fix propuesto (no aplicado, requiere decisión de producto):
1. Actualizar la lista de `provision-workspace.ts` para incluir `asesores`, `presentations`, `referrals` y `advisory_sessions`.
2. Backfill para los workspaces existentes que faltan: habilitar esos módulos. Es una decisión de producto, porque cambia lo que ve un tenant que ya existe. Mismo criterio que usaron los backfills anteriores.

## Permisos EXECUTE de funciones de public: evaluación inicial (2026-10-05, antes de los grants manuales)

Producción tiene 39 funciones propias de `public`. Las ejecutables por `anon` o `PUBLIC` son 13. Evaluación:

| Función | anon/public | Uso en la app | Evaluación |
|---|---|---|---|
| get_user_id_by_email(text) | anon, public | Sólo service_role (otp-service.ts) | Enumeración de cuentas. **Cerrada** (0191). |
| provision_whatsapp_web_session(uuid,uuid) | anon | Server action con sesión de usuario | No la necesita anon. **Cerrada** (0191). |
| classroom_user_names(uuid[]) | anon, public | Classroom, con sesión | No verifica membresía: devuelve nombre o email de cualquier usuario. **Alta**. Recomendado: revocar y agregar chequeo. |
| notifications_check_* (4) | anon, authenticated | Sólo pg_cron (postgres) | Cualquiera dispara notificaciones para todos los workspaces. **Media-alta**. Recomendado: revocar anon y authenticated. |
| workspace_member_names(uuid) | anon, public | Muchas consultas con sesión | Verifica membresía (anon recibe vacío). Grant innecesario. **Baja**. |
| am_i_platform_admin(), touch_last_active(uuid) | anon, public | Middleware y sesión con sesión | Sin datos sensibles (anon recibe false / no-op). **Baja**. |
| current_user_agency_role(), agency_workspace_id(), workspace_has_platform_admin_member(uuid) | anon | Roles con sesión | Revelan rol o id de la agencia a anon. **Baja-media**. |

Esta tabla es la evaluación previa. El estado actual está en la sección siguiente.

## Módulos de workspace: fix aplicado

La provisión y los ajustes ya leen `src/lib/modules/catalog.ts`. Los workspaces afectados no dependen del plan: todos son `Free`, y ningún código habilita módulos según `plan`.

Clasificación de los 6 afectados (lectura en producción):
- **Prueba, sin uso:** Polizas Cal 3aqlj2 (0 miembros, 0 contactos), Verify Test Emergencia ×2 (owner, 0 contactos). No requieren backfill.
- **QA:** Workspace de qa-mobile (3-oct, usado para pruebas).
- **Tenants reales, activos:** Workspace de pjaikc (agente, 7 contactos, última actividad 18-sep: falta sólo presentations) y Workspace de leonardomaganah (agente, activo al 3-oct: faltan asesores, presentations, advisory_sessions, referrals).

El backfill para los dos tenants reales queda como decisión de producto.

## Backfill de módulos de workspace (2026-10-05, ejecutado por el usuario en producción)

Alcance: sólo `presentations` y `asesores` según el catálogo (`src/lib/modules/catalog.ts`). **`advisory_sessions` y `referrals` quedaron fuera del catálogo y del backfill:**
- `advisory_sessions`: clave legacy obsoleta. Ningún código la lee.
- `referrals`: es una clave de tipo de agente de IA, no un módulo de workspace.

Se identifica el workspace por `workspace_id`, no por nombre. La primera versión del SQL usaba el nombre y el usuario la ejecutó: insertó `presentations` en pjaikc, y `presentations`, `asesores`, `advisory_sessions` y `referrals` en leonardomaganah (2026-10-05 02:22:30 UTC). Después el usuario quitó `advisory_sessions` y `referrals` de leonardomaganah. La segunda versión, por id, no insertó nada.

Estado verificado en producción con lectura (2026-10-05):
- Workspace de leonardomaganah: incluye `asesores` y `presentations`. No tiene `advisory_sessions` ni `referrals`.
- Workspace de pjaikc: incluye `presentations`. Además tiene `advisory_sessions` y `referrals`, que ya estaban antes del backfill y no se tocaron.

## Estado real de permisos EXECUTE (2026-10-05, verificado en producción y qa-mobile)

Qué se aplicó y cómo:
- **Producción:** los grants de las 39 funciones propias de `public` se aplicaron a mano (no se corrió 0191 completa). Sin `anon` ni `PUBLIC` en ninguna función: la consulta de exposición devuelve 0 filas.
- **Default privileges de `postgres` en `public`:** en producción siguen dando `anon` a las funciones nuevas (`anon=X/postgres`). Lo cierra la parte `alter default privileges` de 0191, que queda para el merge.
- **qa-mobile:** 0191 registrada en `supabase_migrations.schema_migrations`. Sin `anon` ni `PUBLIC`. Default privileges sin `anon`.

Comparación rama contra producción:
- Mismas 39 funciones. Hash normalizado de privilegios (roles ordenados): `3051aeea10ac175f69ff68ca0eac9770` en ambos lados. El hash del texto de ACL difiere sólo por el orden de las entradas.
- `classroom_user_names`: mismo cuerpo SQL. Producción tiene fin de línea CRLF y la rama LF; no cambia el comportamiento.

Idempotencia de 0191: se ejecutó completa sobre la rama, que ya tiene 0191 aplicada, dentro de una transacción con `ROLLBACK`. Corre sin errores y no altera los grants.

Pendiente: aplicar 0191 en producción (vía el merge). Recién ahí se cierran los default privileges para funciones nuevas.
