# 03 — Módulos del sistema

## Por qué modular

Requisito explícito del producto: cada funcionalidad vertical (CRM, ATS, futuras) debe poder **activarse o desactivarse por workspace**, sin que eso implique arquitecturas paralelas. La solución es: un núcleo único de datos/servicios, y módulos que son "vistas + reglas" sobre ese núcleo, gateados por una tabla de activación.

## Mecanismo de activación

Tabla `workspace_modules` ([02-database.md](02-database.md)): `(workspace_id, module_key, enabled, config jsonb)`. `module_key` hoy es `'crm' | 'ats'`; añadir un módulo futuro es una fila nueva de catálogo, no una migración estructural.

**Enforcement en tres capas** (ninguna es suficiente por sí sola):

1. **Servidor (obligatorio)** — todo Route Handler / Server Action de un módulo verifica `workspace_modules.enabled` antes de leer/escribir. Se centraliza en un helper `assertModuleEnabled(workspaceId, 'ats')` en `src/lib/core/modules.ts`, usado como guard al inicio de cada acción del módulo.
2. **RLS (defensa en profundidad)** — las tablas específicas de un módulo (p. ej. `vacancies`, `candidates`) incluyen en su policy de SELECT/INSERT una subconsulta a `workspace_modules` además de la membresía de workspace, de modo que aunque un bug de servidor omita el check, la base de datos no devuelve/acepta datos de un módulo desactivado.
3. **UI** — la navegación (`src/app/(dashboard)/layout.tsx`) solo renderiza los enlaces a `/crm` o `/ats` si el módulo está activo para el workspace actual; es UX, no seguridad.

## Estructura de módulo (convención)

Cada módulo vive en dos lugares que deben mantenerse en paralelo:

```
src/lib/modules/<module_key>/    # dominio: queries, mutaciones, reglas específicas
src/app/(dashboard)/<module_key>/ # rutas/UI específicas
```

Un módulo **no** define su propia tabla de contactos, conversaciones, pipeline, agenda, notas o adjuntos — consume las del núcleo (`src/lib/core/`). Un módulo sí puede definir sus propias tablas para conceptos que no existen en el núcleo (p. ej. `vacancies`, `evaluations` en ATS).

## Módulo Core (siempre activo, no es "desactivable")

Workspaces, membresía/roles, auth, contactos, conversaciones/mensajes, buffer, pipeline genérico, calendario/bookings, notas, adjuntos, prompts/tools IA, integraciones, auditoría. Vive en `src/lib/core/` y `src/lib/ai/`. Documentado en [01-architecture.md](01-architecture.md), [04-inbox.md](04-inbox.md), [05-ai-engine.md](05-ai-engine.md).

## Módulo CRM

`module_key = 'crm'`. Añade: oportunidades sobre el pipeline genérico, Modo Setter (especialización del motor IA), sincronización con HighLevel. Detalle en [06-crm.md](06-crm.md).

## Módulo ATS

`module_key = 'ats'`. Añade: vacantes (cada una dueña de una instancia de pipeline genérico), candidatos (extensión 1:1 de `contacts`), entrevistas (sobre `bookings`), evaluaciones, IA de preclasificación (especialización del motor IA), reportes/dashboard de RR. HH. Detalle en [07-ats.md](07-ats.md).

## Regla de extensión

Antes de crear una tabla, componente o servicio "de módulo", verificar si el núcleo ya resuelve el caso genérico (pipeline, notas, adjuntos, agenda, motor IA). Si sí, extenderlo con datos/columnas específicas del módulo, no duplicar la mecánica. Ejemplo aplicado: el pipeline de reclutamiento del ATS **no** es un tablero kanban nuevo — es una fila en `pipelines` con `module_key='ats'` usando el mismo motor que las oportunidades del CRM.
