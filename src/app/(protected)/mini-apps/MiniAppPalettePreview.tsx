"use client";

import { generateMiniAppPalette } from "@/lib/miniApps/paletteEngine";

const SWATCHES: { key: keyof ReturnType<typeof generateMiniAppPalette>["light"]; label: string }[] = [
  { key: "backgroundPage", label: "Fondo" },
  { key: "backgroundSurface", label: "Tarjeta" },
  { key: "buttonPrimaryBg", label: "Botón" },
  { key: "buttonPrimaryHover", label: "Botón hover" },
  { key: "titleColor", label: "Título" },
  { key: "iconColor", label: "Ícono" },
  { key: "chartSeriesPrimary", label: "Gráfico 1" },
  { key: "chartSeriesSecondary", label: "Gráfico 2" },
];

/** Zero-decision visual confirmation of what the two brand colors actually
 * produce — the owner picks primary/secundario, this just shows the result;
 * it is deliberately not another set of knobs (see paletteEngine.ts's doc
 * comment on the "no design decisions" requirement). Shared between
 * ConfiguracionTab.tsx and NewMiniAppWizard.tsx. */
export function MiniAppPalettePreview({ primaryColor, secondaryColor }: { primaryColor: string; secondaryColor: string }) {
  const palette = generateMiniAppPalette(primaryColor, secondaryColor);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Vista previa generada</p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {SWATCHES.map((s) => (
          <div key={s.key} className="flex flex-col items-center gap-1">
            <div
              className="size-9 rounded-full border border-border-default shadow-[var(--elevation-xs)]"
              style={{ background: palette.light[s.key] }}
              aria-hidden="true"
            />
            <span className="text-center text-[10px] leading-tight text-neutral-500">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
