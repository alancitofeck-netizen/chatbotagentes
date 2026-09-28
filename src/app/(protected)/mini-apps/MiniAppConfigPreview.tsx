"use client";

import { generateMiniAppPalette } from "@/lib/miniApps/paletteEngine";

/** Vista previa "en vivo" de Configuración — no es un render real de la
 * plantilla (son 12 HTML/JS distintos, cada uno con su propio motor;
 * renderizarlos en miniatura reactivo a cada tecla es un proyecto en sí
 * mismo) sino un marco de celular genérico que refleja nombre/logo/colores
 * a medida que se editan, reutilizando el mismo motor de paleta que ya usa
 * MiniAppPalettePreview. Se actualiza solo desde el estado local del
 * formulario — no depende de guardar primero. */
export function MiniAppConfigPreview({
  name,
  logoUrl,
  primaryColor,
  secondaryColor,
  welcomeTitle,
}: {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  welcomeTitle: string;
}) {
  const palette = generateMiniAppPalette(primaryColor, secondaryColor);

  return (
    <div className="sticky top-4 flex flex-col gap-2">
      <p className="text-xs font-medium tracking-wide text-neutral-400 uppercase">Vista previa</p>
      <div className="rounded-[28px] border-4 border-neutral-900 bg-neutral-900 p-2 shadow-[var(--elevation-lg)]">
        <div className="flex flex-col gap-4 rounded-[20px] p-5" style={{ background: palette.light.backgroundPage }}>
          <div className="flex items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo externo (Storage), no un asset estático de next/image
              <img src={logoUrl} alt="" className="size-7 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ background: palette.light.buttonPrimaryBg }}>
                {name.charAt(0).toUpperCase() || "?"}
              </div>
            )}
            <span className="truncate text-[11px] font-medium" style={{ color: palette.light.titleColor }}>
              {name || "Tu mini app"}
            </span>
          </div>
          <p className="text-base leading-snug font-semibold" style={{ color: palette.light.titleColor }}>
            {welcomeTitle || "¿Cuánto podés ahorrar?"}
          </p>
          <div className="rounded-xl p-3" style={{ background: palette.light.backgroundSurface }}>
            <div className="mb-2 h-2 w-2/3 rounded-full bg-neutral-300" />
            <div className="h-8 rounded-lg border border-neutral-200 bg-white" />
          </div>
          <button
            type="button"
            disabled
            className="rounded-full py-2.5 text-center text-sm font-semibold text-white"
            style={{ background: palette.light.buttonPrimaryBg }}
          >
            Continuar
          </button>
        </div>
      </div>
      <p className="text-center text-[11px] text-neutral-400">Se actualiza al editar — no es el render exacto de la app real.</p>
    </div>
  );
}
