# 11 — UI/UX

> **Nota**: este documento propone la *estructura de información* (qué layout, qué columnas, qué vistas) — la identidad visual (color, tipografía, spacing, componentes) ya tiene sistema definido en [14-design-system.md](14-design-system.md) y debe leerse junto con este documento. La estructura de abajo sigue siendo una propuesta a validar con wireframes reales, no una decisión cerrada.

## Layout general

Navegación lateral condicionada por módulos activos del workspace ([03-modules.md](03-modules.md)):

```
┌───────────┬─────────────────────────────────────────────┐
│  Sidebar   │  Inbox (siempre visible)                     │
│  - Inbox    │  ┌─────────────┬───────────────┬───────────┐ │
│  - CRM*     │  │ Lista de     │ Hilo de        │ Panel     │ │
│  - ATS*     │  │ conversac.   │ mensajes       │ contextual│ │
│  - Config   │  │ (buscar,     │ (WhatsApp-like,│ (contacto,│ │
│             │  │ filtros,     │ notas internas,│ CRM/ATS,  │ │
│             │  │ etiquetas)   │ adjuntos)      │ tools IA) │ │
│             │  └─────────────┴───────────────┴───────────┘ │
└───────────┴─────────────────────────────────────────────┘
  * solo si workspace_modules.<key>.enabled
```

Inspirado en WhatsApp Web (3 columnas), consistente con el requisito de producto ([00-product.md](00-product.md)).

## Panel contextual (columna derecha del inbox)

Cambia según qué módulos estén activos y a qué esté asociado el contacto de la conversación abierta:
- Datos del contacto (siempre).
- Si CRM activo y el contacto tiene oportunidad: tarjeta de oportunidad/etapa de pipeline con acción rápida de mover etapa.
- Si ATS activo y el contacto es candidato: tarjeta de postulación/vacante, etapa de reclutamiento, acceso a CV y evaluaciones.
- Estado del modo de conversación (`human/ai/hybrid`) con control para escalar/regresar a IA ([05-ai-engine.md](05-ai-engine.md)).

## Vista CRM (`/crm`)

Tablero kanban por pipeline (columnas = `pipeline_stages`, tarjetas = `opportunities`), reutilizando el mismo componente de tablero que ATS ([03-modules.md](03-modules.md)). Vista de lista de contactos con filtros por etapa/etiqueta/responsable.

## Vista ATS (`/ats`)

- Lista de vacantes (con conteo de candidatos por etapa).
- Tablero kanban por vacante (mismo componente que CRM, parametrizado por `pipeline_id` de esa vacante).
- Ficha de candidato: datos de contacto + CV + evaluaciones + historial de conversación WhatsApp embebido (mismo hilo del inbox núcleo).
- Dashboard de RR. HH.: métricas de [07-ats.md](07-ats.md) (time-to-hire, conversión de embudo, origen de candidatos) en tarjetas/gráficos simples.

## Prompt Builder y configuración de Tools (`/settings/ai`)

Editor de prompt de sistema con preview de variables disponibles, lista de versiones (activar/archivar), botón "probar" que corre el prompt en sandbox contra un mensaje de ejemplo sin tocar datos reales ([05-ai-engine.md](05-ai-engine.md)). Lista de tools con toggle de activación por prompt.

## Sistema de diseño

Ver [14-design-system.md](14-design-system.md) para tokens (color, tipografía, spacing, radius, elevación, grid, animación) e inventario de componentes con su anatomía — implementados como CSS custom properties en [src/app/globals.css](../../src/app/globals.css) (Tailwind v4 `@theme`). Sin librería de componentes de terceros decidida — los primitivos (`Button`, `Input`, `Card`, etc.) se construyen a medida sobre esos tokens en la primera iteración de implementación de la Fase 1 (inbox), ya que es la primera superficie visual real del producto.

## Pendientes explícitos

- No hay wireframes de alta fidelidad ni el archivo de logo real de Growth Link — la paleta de [14-design-system.md](14-design-system.md) es una interpretación del brief verbal, a re-validar contra el logo cuando exista. Este documento y el de diseño no deben tratarse como especificación visual final e inmutable, solo como el sistema y la estructura de información a implementar y refinar.
