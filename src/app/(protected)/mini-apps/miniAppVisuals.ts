import { PieChart, Calculator, Link2, TrendingUp, ShieldCheck, Layout, Presentation, FileText, Sparkles, Landmark, type LucideIcon } from "lucide-react";
import type { MiniAppListItem, MiniAppTemplateKey } from "@/lib/miniApps/queries";
import type { LinkedAppIconKey } from "@/lib/miniApps/linkedAppOptions";

/** Tailwind necesita ver las clases completas como literales en el código
 * fuente para incluirlas en el build (no arma clases dinámicas del tipo
 * `bg-${hue}-500`) — por eso cada tono va como un bloque de 3 clases ya
 * armadas, no como un string de color suelto para interpolar. */
interface HueClasses {
  tintBg: string;
  tintText: string;
  bar: string;
}

const HUES = {
  violet: { tintBg: "bg-violet-500/15", tintText: "text-violet-600", bar: "bg-violet-500" },
  blue: { tintBg: "bg-blue-500/15", tintText: "text-blue-600", bar: "bg-blue-500" },
  pink: { tintBg: "bg-pink-500/15", tintText: "text-pink-600", bar: "bg-pink-500" },
  orange: { tintBg: "bg-orange-500/15", tintText: "text-orange-600", bar: "bg-orange-500" },
  emerald: { tintBg: "bg-emerald-500/15", tintText: "text-emerald-600", bar: "bg-emerald-500" },
  cyan: { tintBg: "bg-cyan-500/15", tintText: "text-cyan-600", bar: "bg-cyan-500" },
} satisfies Record<string, HueClasses>;

type Hue = keyof typeof HUES;

const TEMPLATE_VISUAL: Record<MiniAppTemplateKey, { icon: LucideIcon; hue: Hue }> = {
  simulador_retiro: { icon: PieChart, hue: "blue" },
  calculadora_brecha_retiro: { icon: Calculator, hue: "pink" },
  app_vinculada: { icon: Link2, hue: "violet" },
  diagnostico_financiero: { icon: TrendingUp, hue: "cyan" },
  diagnostico_financiero_retiro: { icon: ShieldCheck, hue: "violet" },
  diagnostico_solidez_financiera: { icon: Landmark, hue: "orange" },
};

/** Para "App Vinculada": el ícono real que el usuario eligió al vincularla
 * (ver linkedAppOptions.ts) — cada ícono lleva su propio tono, así distintas
 * apps vinculadas no quedan todas iguales, sin inventar un color que no
 * viene de ningún dato real. Mismo set de íconos que ya usa la landing
 * pública (LinkedAppLanding.tsx). */
const LINKED_APP_ICON_VISUAL: Record<LinkedAppIconKey, { icon: LucideIcon; hue: Hue }> = {
  Link2: { icon: Link2, hue: "violet" },
  Layout: { icon: Layout, hue: "blue" },
  Calculator: { icon: Calculator, hue: "pink" },
  Presentation: { icon: Presentation, hue: "orange" },
  FileText: { icon: FileText, hue: "emerald" },
  Sparkles: { icon: Sparkles, hue: "cyan" },
};

export interface MiniAppVisual {
  icon: LucideIcon;
  tintBg: string;
  tintText: string;
  bar: string;
}

export function miniAppVisual(app: Pick<MiniAppListItem, "templateKey" | "linkedAppIcon">): MiniAppVisual {
  const linked = app.templateKey === "app_vinculada" && app.linkedAppIcon ? LINKED_APP_ICON_VISUAL[app.linkedAppIcon] : null;
  const { icon, hue } = linked ?? TEMPLATE_VISUAL[app.templateKey];
  const classes = HUES[hue];
  return { icon, tintBg: classes.tintBg, tintText: classes.tintText, bar: classes.bar };
}
