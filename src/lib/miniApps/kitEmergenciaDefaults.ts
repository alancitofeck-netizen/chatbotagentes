/** Config por defecto para "Kit de Emergencia Financiera Familiar" — los
 * campos del objeto `CONFIG` del HTML original que sirvió de base a este
 * tipo de Mini App. Única fuente de verdad, importada tanto por queries.ts
 * (relleno de defaults si `config` viene vacío/incompleto) como por
 * NewMiniAppWizard.tsx (estado inicial del formulario) — mismo patrón que
 * metaUniversitariaDefaults.ts/diagnosticoSolidezDefaults.ts. Arranca en
 * blanco (no con los datos de ejemplo "Diego Tinoco" del archivo original)
 * para que cada asesor lo complete con lo suyo. */

export interface KitEmergenciaBrand {
  advisorName: string;
  title: string;
  whatsapp: string;
  email: string;
  photoURL: string;
  logoURL: string;
  colorMarca: string;
  calendlyURL: string;
  privacyURL: string;
  webhookURL: string;
}

export const DEFAULT_KIT_EMERGENCIA_BRAND: KitEmergenciaBrand = {
  advisorName: "",
  title: "Asesor financiero",
  whatsapp: "",
  email: "",
  photoURL: "",
  logoURL: "",
  colorMarca: "",
  calendlyURL: "",
  privacyURL: "",
  webhookURL: "",
};

/** Las 6 categorías que `buildLead()` puede reportar como completadas —
 * ver `cats` dentro de esa función en el archivo original. */
const KIT_EMERGENCIA_CATEGORIES = ["familia", "seguros", "patrimonio", "deudas", "documentos", "contactos"] as const;
export type KitEmergenciaCategory = (typeof KIT_EMERGENCIA_CATEGORIES)[number];

/** Las 6 claves que `buildLead().conteos` puede traer. */
const KIT_EMERGENCIA_COUNT_KEYS = ["familiares", "seguros", "activos", "deudas", "documentos", "contactos"] as const;

export interface KitEmergenciaLeadInput {
  scorePreparacion: unknown;
  categoriasCompletadas: unknown;
  conteos: unknown;
}

export interface KitEmergenciaSanitizedLead {
  scorePreparacion: number;
  categoriasCompletadas: KitEmergenciaCategory[];
  conteos: Record<string, number>;
}

/** A diferencia de los demás Mini Apps tipo calculadora de este proyecto
 * (Diagnóstico de Solidez, Meta Universitaria), acá NO hay un recómputo
 * server-side "autoritativo" del score posible: el archivo original está
 * diseñado a propósito para que el detalle financiero de la familia
 * (familiares, seguros, activos, deudas, documentos, contactos — todo el
 * contenido real) NUNCA salga del navegador, viva solo en localStorage (ver
 * el propio comentario de privacidad del archivo). El lead que llega al CRM
 * trae únicamente `scorePreparacion` (ya calculado en el cliente),
 * `categoriasCompletadas` (nombres de categoría, sin contenido) y `conteos`
 * (cantidades, sin contenido) — no hay manera de recalcular el score exacto
 * server-side sin pedirle al archivo que mande el detalle, que es
 * exactamente lo que su diseño evita. Intentar "recomputar" con datos
 * parciales produciría un número DISTINTO, no uno más confiable.
 *
 * Lo que sí hace esta función es sanear/acotar lo que llega, para que un
 * payload manipulado no pueda inyectar valores fuera de rango: clampea
 * `scorePreparacion` a 0-100, filtra `categoriasCompletadas` a la lista
 * real de categorías, y fuerza `conteos` a enteros no negativos. */
export function sanitizeKitEmergenciaLead(input: KitEmergenciaLeadInput): KitEmergenciaSanitizedLead {
  const rawScore = typeof input.scorePreparacion === "number" ? input.scorePreparacion : Number(input.scorePreparacion);
  const scorePreparacion = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 0;

  const rawCategorias = Array.isArray(input.categoriasCompletadas) ? input.categoriasCompletadas : [];
  const categoriasCompletadas = rawCategorias.filter((c): c is KitEmergenciaCategory =>
    (KIT_EMERGENCIA_CATEGORIES as readonly string[]).includes(c as string),
  );

  const rawConteos = (input.conteos && typeof input.conteos === "object" ? (input.conteos as Record<string, unknown>) : {}) ?? {};
  const conteos: Record<string, number> = {};
  for (const key of KIT_EMERGENCIA_COUNT_KEYS) {
    const n = typeof rawConteos[key] === "number" ? rawConteos[key] : Number(rawConteos[key]);
    conteos[key] = Number.isFinite(n) && n >= 0 ? Math.round(n as number) : 0;
  }

  return { scorePreparacion, categoriasCompletadas, conteos };
}
