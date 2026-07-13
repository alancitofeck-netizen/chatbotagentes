# 14 — Sistema de diseño (identidad visual)

> Define el **sistema visual completo** (tokens, tipografía, spacing, radius, elevación, grid, animación, estados, e inventario de componentes con su anatomía). **No implementa pantallas ni componentes de React todavía** — eso es el siguiente paso, una vez este sistema esté validado. Los tokens de color/tipografía/radius/elevación ya están implementados como CSS custom properties en [src/app/globals.css](../../src/app/globals.css) (Tailwind v4 `@theme`), listos para usarse en componentes futuros vía clases utilitarias (`bg-primary-600`, `rounded-lg`, `shadow-sm`, etc.).

> **⚠️ Supuesto a validar**: no existe ningún archivo de logo de Growth Link en el repositorio (`public/` solo tiene los íconos por defecto de Next.js). La paleta de abajo es una interpretación fiel del brief verbal (azul profundo primario, azul brillante secundario, grises modernos, semánticos discretos) — debe cotejarse contra el logo real en cuanto exista el archivo, y ajustarse si el logo implica tonos distintos.

> **Actualización de estilo (referencia visual del usuario)**: el usuario compartió dos capturas de referencia (una landing de CRM con hero oscuro y tarjetas flotantes; un dashboard con radios grandes, tarjetas suaves y una tarjeta de contraste oscuro) pidiendo explícitamente el **estilo/forma**, no el color. Esto **reconcilia y reemplaza** la dirección original de "muy pocas sombras / bordes por encima de sombra" (§1, §6 más abajo) por un lenguaje de **tarjetas flotantes con sombra suave y radios más grandes** — sigue siendo minimalista y premium (nunca skeuomorphic/neumórfico), solo con más profundidad y curvatura que el flat-Linear puro descrito inicialmente.
>
> **Actualización de color (2026-07-09)**: la nota anterior fijaba "el color no cambia, solo la forma". El usuario volvió con una tercera referencia (dashboard SaaS con sidebar negro de íconos circulares, KPI cards con mini-gráfico) pidiendo explícitamente adoptar **violeta `#6C63FF`** como nuevo color de acción, reemplazando el azul brillante — esta vez el color sí cambia, a pedido explícito. `primary` (el azul profundo de navegación) no cambia — el sidebar oscuro de la referencia ya se logra con `neutral-950`, no con un tono "primary" nuevo. Ver §2 actualizado abajo y `src/app/globals.css` para los valores reales.

## 1. Principios

La interfaz debe transmitir tecnología, IA, profesionalismo, SaaS enterprise, simplicidad, rapidez y confianza — sin ser colorida ni sobrecargada. Referencias de comportamiento (no de apariencia literal): Intercom, Linear, Notion, Stripe Dashboard, Vercel Dashboard, Missive.

Reglas no negociables derivadas del brief:
- Mucho espacio en blanco — ningún componente debe sentirse denso por defecto (excepción: tablas de datos, donde la densidad es funcional).
- **Tarjetas flotantes con sombra suave** (actualizado por referencia visual, ver nota arriba) — las superficies principales (cards, KPIs, paneles) se despegan del fondo con `shadow-sm`/radios grandes, no solo con borde; los dropdowns/modales siguen usando sombra más marcada (`shadow-md`/`shadow-lg`) como antes.
- Radios generosos (12–28px en superficies, `radius-full` en pills/badges/search) — nunca angulosos.
- Jerarquía visual por tipografía y espaciado ante todo, reforzada por profundidad (sombra/radio) — el color se reserva para estado (éxito/warning/error), foco, una sola acción primaria por vista, y **como máximo una "tarjeta de contraste" oscura por vista** para dar énfasis a un dato clave (ver §10, patrón nuevo).
- Una sola familia tipográfica (Geist) para toda la interfaz — sin mezclar fuentes decorativas.

## 2. Color

Dos azules con roles distintos y deliberadamente no intercambiables:

- **Primary (azul profundo)** — color de marca heredado, hoy usado sobre todo en avatares y la variante de contraste de `Card`; el sidebar oscuro ya no depende de este tono (ver Sidebar más abajo, ahora `neutral-950`). Transmite autoridad/confianza. **No se usa para botones de acción**.
- **Accent (violeta `#6C63FF`)** — color de acción, usado exclusivamente para: botón primario, links, checkbox/radio marcado, focus ring, barra de progreso, elementos interactivos que piden click. Es el único color "vivo" de la interfaz. Reemplaza al azul brillante original (ver nota de 2026-07-09 arriba).

```
Primary  50  #F2F5FC   100 #E3E9F7   200 #C3D0EE   300 #9AB0E0   400 #6D8AD0
         500 #4A6BB8   600 #34519A   700 #253D7A   800 #182B5C   900 #101D42   950 #0A122C

Accent   50  #F1F0FF   100 #E4E2FF   200 #CBC7FF   300 #ADA5FF   400 #8D82FF
         500 #6C63FF   600 #574DDE   700 #453DB3   800 #363089   900 #2B2870

Neutral  0 #FFFFFF  50 #F8F9FB  100 #F0F2F5  200 #E4E7EC  300 #D0D5DD  400 #98A2B3
         500 #667085  600 #475467  700 #344054  800 #1D2939  900 #101828  950 #0B0F19
```

Semánticos — **deliberadamente apagados**, nunca el rojo/verde/ámbar saturado por defecto de un framework:

| Uso | Fondo (tint) | Color | Fuerte (texto/ícono sobre fondo claro) |
|---|---|---|---|
| Success | `#ECF9F2` | `#2E9563` | `#1E7A4C` |
| Warning | `#FBF2E3` | `#B7791F` | `#92600F` |
| Error | `#FCEEEE` | `#C1484F` | `#9C363D` |

**Reglas de uso**:
1. Nunca más de un color de acción visible a la vez por vista (un botón `accent` primario, el resto son `neutral`/ghost/outline).
2. Los semánticos solo aparecen en badges de estado, mensajes de validación y alertas — nunca como color de fondo de un componente grande.
3. En modo oscuro, `primary`/`accent` se leen sobre fondos oscuros (`neutral-950`/`900`) — no se invierte su escala, se usan los mismos tonos 400–500 (más claros, mejor contraste) en vez de 600–700.

## 3. Tipografía

Familia única: **Geist** (UI, ya cargada vía `next/font/google` en [src/app/layout.tsx](../../src/app/layout.tsx)) + **Geist Mono** reservada para datos tabulares, IDs, timestamps, montos y bloques de código/JSON (prompts, payloads de webhook en vistas de debug).

| Token | Tamaño/interlineado | Peso | Uso |
|---|---|---|---|
| `display` | 28/36 | Semibold (600) | Encabezado de página, portadas de settings |
| `h1` | 22/30 | Semibold | Título de sección principal |
| `h2` | 18/26 | Semibold | Subsección, título de card grande |
| `h3` | 15/22 | Medium (500) | Título de card, cabecera de tabla agrupada |
| `body-lg` | 15/24 | Regular | Texto de lectura larga (descripciones, prompts) |
| `body` | 14/20 | Regular | Texto de UI por defecto — botones, inputs, tablas, nav |
| `body-sm` | 13/18 | Regular | Metadatos, texto secundario |
| `caption` | 12/16 | Regular | Timestamps, contadores, labels de forms, ayuda contextual |
| `mono` | 13/20 | Regular (Geist Mono) | IDs, teléfonos, montos, código |

Reglas: `tracking: -0.02em` en `display`/`h1`/`h2` (look más ajustado tipo Linear/Vercel), interlineado normal en el resto. Nunca usar `font-bold` (700) en UI — el semibold (600) ya es el peso más fuerte permitido, mantiene el tono "premium, no gritado".

## 4. Spacing

Se usa la escala por defecto de Tailwind (base 4px: `1`=4px, `2`=8px, `3`=12px, `4`=16px…) — no se redefine, para no crear un segundo sistema de espaciado paralelo al de Tailwind. Semántica de uso:

| Contexto | Valor |
|---|---|
| Padding interno de botón/input (vertical) | 8px (`py-2`) |
| Padding interno de card | 16–24px (`p-4`/`p-6`) |
| Gap entre elementos de una lista (mensajes, filas de tabla compactas) | 8–12px |
| Gap entre secciones de una página | 32px |
| Margen de página (desktop ≥1280px) | 32px |
| Margen de página (tablet 768–1279px) | 24px |

## 5. Radius

**Actualizado por referencia visual** (ver nota al inicio del documento) — escala más generosa que la propuesta inicial, para lograr el look de tarjetas suaves/flotantes de las referencias:

| Token | Valor | Uso |
|---|---|---|
| `radius-xs` | 6px | Checkboxes, badges pequeños |
| `radius-sm` | 8px | Inputs, botones pequeños |
| `radius-md` | 12px | Botones (default), dropdowns, cards pequeñas |
| `radius-lg` | 20px | Cards principales (KPI, contenedores de sección) — el radio "por defecto" de una superficie flotante |
| `radius-xl` | 28px | Superficies grandes (hero de dashboard, tarjeta de perfil con imagen, empty states ilustrados) |
| `radius-full` | 9999px | Avatares, badges, **search bar** y botones tipo pill (patrón visto en la referencia: barra de búsqueda y navegación como pill completo, no solo badges) |

## 6. Elevación (sombras)

**Actualizado por referencia visual** (ver nota al inicio del documento): la dirección original ("muy pocas sombras, borde como recurso principal") se reemplaza por un lenguaje de **tarjetas flotantes con sombra suave y de blur amplio** — inspirado en las referencias (tarjetas de estadísticas flotando sobre el hero oscuro; KPI cards con sombra suave sobre fondo cálido). Sigue siendo restrained/premium: sombras de opacidad baja y blur grande (nunca sombras duras/cortas tipo Material Design), nunca más de `shadow-lg` salvo modales.

| Token | Uso |
|---|---|
| `shadow-xs` | Elementos casi planos (filas de tabla, chips inline) |
| `shadow-sm` | **Default de Card** — toda card/KPI/panel flota con esta sombra por defecto, ya no es opcional |
| `shadow-md` | Hover de card interactiva, dropdowns, tooltips, menús contextuales |
| `shadow-lg` | Modales, diálogos, drawers, y la "tarjeta de contraste" oscura (§10) |

`surface-1/2/3` y `border-default`/`border-strong` se mantienen como recurso *complementario* (especialmente en dark mode, donde la sombra por sí sola no se percibe bien sobre fondos oscuros) — pero ya no son el único mecanismo de separación de capas: la sombra vuelve a ser una herramienta de uso frecuente, no de último recurso.

## 7. Grid y layout

- Contenedor máximo: 1440px, con gutter de 32px (desktop) / 24px (tablet).
- Grid de dashboard: 12 columnas; KPI cards ocupan 3 columnas (4 por fila) en desktop, gráficos grandes ocupan 6–12 columnas.
- App shell: rail de navegación de íconos (64px) como **dock flotante** (margen propio, no pegado al borde del viewport, íconos circulares — patrón de la referencia) + panel secundario expandible (240px) + contenido principal fluido.
- Inbox (3 columnas, ver §11): lista de conversaciones 320px fija, hilo fluido (mínimo 480px), panel contextual derecho 340px fijo, colapsable por debajo de 1280px.

## 8. Animación

Rápida y precisa — nunca "juguetona" (sin bounce/elastic/spring):

| Token | Valor | Uso |
|---|---|---|
| `duration-fast` | 120ms | Hover, cambios de color/opacidad |
| `duration-base` | 180ms | Apertura de dropdown/popover, cambio de tab |
| `duration-slow` | 240ms | Entrada de modal/drawer |
| `ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entradas (algo aparece) |
| `ease-in` | `cubic-bezier(0.7, 0, 0.84, 0)` | Salidas (algo desaparece) |

Regla: cualquier animación >300ms se considera un error de diseño salvo transiciones de página completas. Los skeletons usan un shimmer sutil entre `neutral-100` y `neutral-200` (light) / `neutral-800` y `neutral-900` (dark), nunca un spinner como estado de carga por defecto de contenido (los spinners quedan solo para acciones puntuales de botón).

## 9. Estados

Reglas consistentes aplicables a todo componente interactivo:

- **Hover**: cambio de fondo de un paso en la escala neutral (`surface-2 → surface-3`) o `accent-500 → accent-600` en botones — nunca sombra como único indicador de hover.
- **Focus-visible**: anillo de 2px `accent-500` con 2px de offset — idéntico en todos los componentes interactivos (botones, inputs, filas seleccionables), nunca se suprime el outline sin reemplazo.
- **Disabled**: opacidad 40%, `cursor: not-allowed`, sin cambios de color adicionales.
- **Loading**: skeleton (contenido) o spinner inline de 14–16px (dentro de botón, reemplaza el label sin mover el layout).
- **Error**: borde `error` + texto `error-strong` de ayuda debajo del campo — nunca solo color, siempre acompañado de texto (accesibilidad).
- **Empty**: ilustración lineal simple (no ilustraciones coloridas de stock) + título `h3` + texto `body-sm` + acción primaria opcional.
- **Selected** (fila de tabla, item de lista, tab activo): fondo `accent-50` (light) / `primary-900` (dark) + borde o indicador lateral `accent-500`.

## 10. Inventario de componentes (anatomía y estados — sin implementar aún)

Agrupados por familia. Todos comparten los tokens de arriba; ninguno introduce color o radius fuera de la escala definida.

**Primitivos**
- **Button**: variantes `primary` (accent-500, un solo por vista), `secondary` (borde neutral, fondo transparente), `ghost` (sin borde, fondo en hover), `destructive` (error). Tamaños `sm`/`md`/`lg`. Estados: default/hover/active/focus/disabled/loading.
- **Input / Textarea**: borde `neutral-300`, focus `accent-500` + ring, error `error`. Label siempre visible arriba (nunca solo placeholder).
- **Select / Dropdown**: mismo tratamiento visual que Input cerrado; panel abierto usa `shadow-md` + `radius-md`, opciones con hover `surface-2`.
- **Badge**: `radius-full`, tamaño `caption`, variantes neutral/success/warning/error/accent — para estados (`open`, `pending_human`, `closed`, etiquetas de pipeline).
- **Tabs**: subrayado `accent-500` de 2px para el tab activo, sin fondo — patrón Linear/Notion, no "pill tabs".

**Layout**
- **Sidebar**: dock flotante de íconos circulares, permanente (64px de ancho total, con margen propio — no pegado al borde, `radius-xl`, `shadow-md`, fondo `neutral-950`) — **actualizado 2026-07-09**: ya no tiene estado expandible con texto (la referencia visual nunca muestra labels en el rail); el label solo aparece como `title` nativo en hover. Logo arriba, `UserMenu` (avatar + dropdown de cuenta) al pie. Ítem activo: fondo blanco sólido + ícono en `neutral-950`; inactivo: ícono `neutral-400`, hover `neutral-800`.
- **Navbar**: altura fija 56px. Búsqueda como **pill completo** (`radius-full`, ícono + placeholder, fondo `surface-2`) en vez de input rectangular — patrón de la referencia. Sin borde/sombra propios (vive sobre el fondo de la página).
- **Breadcrumbs**: `body-sm`, separador `/` en `neutral-400`, último ítem en `foreground` (resto en `neutral-500`).
- **Card**: `surface-1`, `radius-lg`, `shadow-sm` por defecto (ver §6 — ya no es opcional), borde `border-default` opcional/sutil (la sombra ya provee la separación). Header con `h3` + acciones a la derecha. **Variante de contraste**: fondo `neutral-950`/`primary-950` + texto `neutral-50`, `shadow-lg` — para destacar un único dato clave por vista (ej. meta semanal, KPI hero), nunca más de una por pantalla.
- **Table**: fila `body`/`mono` (según columna), header `caption` uppercase `neutral-500`, hover de fila `surface-2`, sin líneas verticales (solo horizontales `border-default`) — patrón Linear/Notion, sin cambios por la referencia visual (las tablas siguen siendo planas por legibilidad de datos).

**Feedback**
- **Toast**: esquina inferior derecha, `surface-1` + `shadow-md` + `radius-md`, ícono semántico a la izquierda, auto-dismiss 4s salvo error.
- **Dialog / Modal**: overlay `neutral-950` a 40% opacidad, panel centrado `radius-lg` + `shadow-lg`, máximo 2 acciones en el footer (primaria + cancelar). **Regla del brief**: nada de ventanas flotantes para flujos frecuentes del Inbox — los modales se reservan para confirmaciones destructivas y formularios cortos, todo lo demás vive en el panel contextual o en un drawer inline.
- **Empty State**: ver §9.
- **Loading State / Skeleton**: ver §8.

**Datos**
- **Charts**: paleta restringida a `accent-500`/`primary-500`/`neutral-400` + semánticos solo si el gráfico es de estado (éxito/error) — nunca una paleta arcoíris categórica. **Actualizado por referencia visual**: barras/áreas usan un **relleno con gradiente sutil** (`accent-500` → transparente, o `primary-500` → `accent-300`) en vez de color plano — más suave, look "premium data-viz" en vez de bloques sólidos. Tooltips sobre el gráfico: card pequeña `radius-md` + `shadow-md`, nunca un tooltip nativo del navegador.
- **KPI Card**: número grande (`display` o `h1` en `mono`), label `caption` arriba, delta (↑/↓) en `success`/`error` pequeño al lado. **Patrón nuevo (referencia visual)**: badge pequeño (`radius-full`, `caption`) en la esquina superior derecha de la card para un dato secundario (ej. "72%" de cumplimiento, período), separado del número principal.
- **Timeline**: dos variantes, no una sola —
  - **Activity Timeline** (bitácora/auditoría): línea vertical `border-default`, punto `accent-500` (evento actual) o `neutral-300` (pasado), contenido en `body-sm`. Uso: historial de auditoría, actividad de contacto/candidato.
  - **Schedule / Agenda grid** (patrón nuevo, referencia visual): grilla semanal (columnas = días), eventos como chips `radius-full`/`radius-md` de color por tipo, evento "en curso" destacado con fondo de contraste + avatares apilados de los participantes. Uso: agenda de citas/entrevistas ([04-inbox.md](04-inbox.md), [07-ats.md](07-ats.md) — entrevistas).
- **Avatar stack**: círculos superpuestos con anillo `surface-1` de 2px entre cada uno, máximo 3–4 visibles + contador `+N` — usado en Schedule (participantes) y listas de contactos con múltiples responsables.

**Dominio (Inbox / CRM / ATS)**
- **Inbox components**: item de lista de conversación (avatar + nombre + preview `body-sm` truncado + timestamp `caption` + badge de estado), burbuja de mensaje (entrante `surface-2`, saliente `accent-50`, nunca colores saturados tipo "verde WhatsApp"), composer con acciones inline (adjuntar, plantilla, IA/humano toggle).
- **CRM components**: tarjeta de oportunidad en kanban (título `h3`, valor en `mono`, avatar de responsable, badge de etapa), fila de contacto en tabla.
- **ATS components**: tarjeta de candidato en kanban (nombre, vacante, badge de etapa, score de IA si existe como badge `accent`), fila de vacante con contador de candidatos por etapa.

## 11. Inbox — layout de 3 columnas

```
┌───────────┬─────────────┬───────────────────────┬───────────────┐
│  Rail      │  Lista de   │  Conversación abierta  │  Panel         │
│  (64px)    │  conversac. │  (fluida, min 480px)   │  contextual    │
│            │  (320px)    │                        │  (340px)       │
└───────────┴─────────────┴───────────────────────┴───────────────┘
```

Sin ventanas flotantes para lo frecuente: escalar a humano, ver contexto de CRM/ATS, agregar nota o adjunto — todo vive en el panel contextual derecho (con tabs internas si hace falta) o inline en el hilo, nunca en un modal. Modales solo para: confirmar una acción destructiva, o un formulario que necesita foco exclusivo de pantalla completa (poco frecuente).

## 12. Dashboard

Grid de 12 columnas: fila de KPI cards (3 columnas c/u, `radius-lg` + `shadow-sm` + badge de esquina, §10) → gráficos (6 columnas c/u, 2 por fila, relleno con gradiente) → actividad reciente + estado de agentes IA (mitad y mitad) → resumen de módulos activos (CRM/ATS, cada uno una card con su propio mini-KPI). Como máximo **una card de contraste oscuro** por dashboard para el dato más importante de la vista (ej. progreso hacia una meta) — nunca más de una, para que siga leyéndose minimalista y no "parcheado".

## 13. Modo oscuro

Mismos nombres de token, valores distintos (ver `globals.css`) — nunca una segunda hoja de estilos paralela. Reglas: `primary`/`accent` usan sus tonos 400–500 en vez de 600–700 para mantener contraste sobre fondo oscuro; separación de capas vía `surface-1/2/3` + borde, no sombra; el `data-theme` attribute permite forzar claro/oscuro (mecanismo ya en `globals.css`) para cuando exista un toggle manual — hoy responde solo a preferencia de sistema.

## 14. Responsive

Desktop-first, en este orden de prioridad:

1. **Desktop (≥1280px)**: experiencia completa — Inbox de 3 columnas, dashboards de 12 columnas, sidebar expandida.
2. **Tablet (768–1279px)**: sidebar colapsa a rail de íconos, panel contextual del Inbox se vuelve un drawer que se abre bajo demanda (no ocupa columna fija), dashboards pasan a 2 columnas.
3. **Mobile (<768px)**: **solo administración básica** (ajustes, revisar una notificación, aprobar algo puntual) — el Inbox completo, CRM y ATS no se optimizan para mobile en esta fase; se documenta como decisión consciente, no como omisión.

## Próximos pasos (fuera de alcance de este documento)

Este documento define el sistema; no construye componentes de React ni pantallas. El siguiente paso natural (a validar con el usuario antes de iniciar) sería: (1) confirmar esta paleta contra el logo real de Growth Link, (2) construir los primitivos (`Button`, `Input`, `Badge`, `Card`, `Tabs`) como componentes reutilizables en `src/components/ui/`, y (3) recién después construir las pantallas de Inbox/CRM/ATS sobre esos primitivos.
