/** Config por defecto para "Calculadora de Capacidad de Generar Ingresos" —
 * los campos de `BRAND_CONFIG` del HTML original que sirvió de base a este
 * tipo de Mini App. Única fuente de verdad, importada tanto por queries.ts
 * (relleno de defaults si `config` viene vacío/incompleto) como por
 * NewMiniAppWizard.tsx (estado inicial del formulario) — mismo patrón que
 * diagnosticoSolidezDefaults.ts. Arranca en blanco (no con los placeholders
 * "NOMBRE DEL ASESOR"/"52XXXXXXXXXX" del archivo original) para que cada
 * asesor lo complete con lo suyo. */

export interface CalculadoraIngresosBrand {
  advisorName: string;
  companyName: string;
  whatsapp: string;
  calendly: string;
  logoURL: string;
  webhookURL: string;
}

export const DEFAULT_CALCULADORA_INGRESOS_BRAND: CalculadoraIngresosBrand = {
  advisorName: "",
  companyName: "",
  whatsapp: "",
  calendly: "",
  logoURL: "",
  webhookURL: "",
};

/** Espejo exacto de `computeResult()` en calculadoraIngresosTemplate.ts —
 * misma aritmética (proyección nominal + valor presente descontado) — pero
 * a partir de los inputs crudos que manda el cliente (edad/edadRetiro/
 * ingreso/growth/discount), nunca de los totales que el propio navegador ya
 * había calculado, así el resultado guardado nunca depende de un total que
 * el visitante pudo haber alterado antes de enviarlo. Devuelve `null` si
 * los inputs no pasan las mismas validaciones que ya aplica el formulario
 * del lado del cliente (edad 18-75, edad de retiro mayor y ≤80, ingreso>0). */
export interface CalculadoraIngresosInputs {
  edad: number;
  edadRetiro: number;
  ingresoMensual: number;
  growthPct: number;
  discountPct: number;
}

export interface CalculadoraIngresosResult {
  n: number;
  nominalTotal: number;
  pvTotal: number;
  nominal5: number;
  nominal10: number;
}

export function computeCalculadoraIngresosResult(inputs: CalculadoraIngresosInputs): CalculadoraIngresosResult | null {
  const { edad, edadRetiro, ingresoMensual, growthPct, discountPct } = inputs;
  if (!Number.isFinite(edad) || edad < 18 || edad > 75) return null;
  if (!Number.isFinite(edadRetiro) || edadRetiro <= edad || edadRetiro > 80) return null;
  if (!Number.isFinite(ingresoMensual) || ingresoMensual <= 0) return null;

  const g = (Number.isFinite(growthPct) ? growthPct : 3) / 100;
  const d = (Number.isFinite(discountPct) ? discountPct : 5) / 100;
  const n = edadRetiro - edad;

  let nominalTotal = 0;
  let pvTotal = 0;
  let nominal5 = 0;
  let nominal10 = 0;
  for (let y = 0; y < n; y++) {
    const annual = ingresoMensual * 12 * Math.pow(1 + g, y);
    nominalTotal += annual;
    pvTotal += annual / Math.pow(1 + d, y + 1);
    if (y < 5) nominal5 += annual;
    if (y < 10) nominal10 += annual;
  }

  return { n, nominalTotal, pvTotal, nominal5, nominal10 };
}
