/** Dataset por defecto para "Diagnóstico Financiero - Retiro" — clon del
 * mismo patrón que diagnosticoDefaults.ts (única fuente de verdad, usada
 * tanto por queries.ts como por el wizard), pero con un shape de preguntas
 * distinto: cada opción puntúa en 1+ de las 4 áreas fijas a la vez (no un
 * solo `w` escalar aplicado al área de la pregunta), y el perfil de
 * resultado se resuelve por umbrales en vez de un array de rangos.
 *
 * Dos piezas quedan aquí como funciones puras (no hardcodeadas ni en el
 * motor server-side ni en el JS del template) porque ambos las necesitan
 * calcular igual, siempre a partir de las preguntas/opciones *actuales*:
 * - computeAreaMax: los puntajes por opción son editables desde el wizard,
 *   así que el máximo posible por área NUNCA puede ser una constante — si
 *   lo fuera, editar un puntaje dejaría el % de esa área matemáticamente
 *   inconsistente con el resto. Se recalcula sumando, por cada pregunta, el
 *   mayor puntaje que cualquiera de sus opciones ofrece para esa área.
 */

export type DiagnosticoRetiroArea = "retiro" | "ahorro" | "fiscal" | "proteccion";

// Orden fijo — coincide con el orden visual de las filas de desglose del
// HTML original (retiro/ahorro/protección/fiscal), reusado por el motor
// server-side y por LeadDetailDrawer para que el orden nunca diverja.
export const DIAGNOSTICO_RETIRO_AREAS: DiagnosticoRetiroArea[] = ["retiro", "ahorro", "proteccion", "fiscal"];

export interface DiagnosticoRetiroOption {
  label: string;
  points: Record<DiagnosticoRetiroArea, number>;
  /** Solo la usa la pregunta de "objetivo" (por defecto, la última) — el
   * resto la deja en "". Uno de DIAGNOSTICO_RETIRO_THEME_KEYS para que
   * resuelva contra themePool; cualquier otro valor simplemente no agrega
   * un mensaje de tema al resultado (ver getRecommendations en el motor). */
  theme: string;
}

export interface DiagnosticoRetiroQuestion {
  text: string;
  options: DiagnosticoRetiroOption[];
}

/** Perfil de resultado — reemplaza el if/else literal del HTML original.
 * Exactamente 3 (bajo/medio/alto), seleccionados por dos umbrales sobre el
 * score global 0-100 (ver DiagnosticoRetiroConfig.umbral1/umbral2). Único
 * punto donde la lógica cambia de FORMA respecto del original, no solo de
 * dónde lee los datos. */
export interface DiagnosticoRetiroPerfil {
  name: string;
  headline: string;
  desc: string;
}

export type DiagnosticoRetiroTier = "low" | "mid" | "high";
export type DiagnosticoRetiroRecoPool = Record<`${DiagnosticoRetiroArea}_${DiagnosticoRetiroTier}`, string>;

export type DiagnosticoRetiroThemeKey = "mantener" | "patrimonio" | "fiscal" | "liquidez";
export const DIAGNOSTICO_RETIRO_THEME_KEYS: DiagnosticoRetiroThemeKey[] = ["mantener", "patrimonio", "fiscal", "liquidez"];
export type DiagnosticoRetiroThemePool = Record<DiagnosticoRetiroThemeKey, string>;

export interface DiagnosticoRetiroAsesor {
  nombre: string;
  marca: string;
  lema: string;
  /** Solo dígitos, formato internacional, sin "+" (igual que el resto de
   * los campos de WhatsApp en mini-apps). */
  whatsapp: string;
  webhookUrl: string;
}

export interface DiagnosticoRetiroReferido {
  prefijoCodigo: string;
}

export interface DiagnosticoRetiroProducto {
  nombre: string;
  aseguradora: string;
  topeDeducible: string;
}

export interface DiagnosticoRetiroTextos {
  heroPregunta: string;
  heroSub: string;
  disclaimer: string;
  /** Texto del checkbox de consentimiento (LFPDPPP) en la pantalla de
   * captura — lo que el plan original llama "texto legal". */
  consentLabel: string;
}

export const DEFAULT_DIAGNOSTICO_RETIRO_ASESOR: DiagnosticoRetiroAsesor = {
  nombre: "",
  marca: "",
  lema: "Estrategia · Protección · Crecimiento",
  whatsapp: "",
  webhookUrl: "",
};

export const DEFAULT_DIAGNOSTICO_RETIRO_REFERIDO: DiagnosticoRetiroReferido = {
  prefijoCodigo: "REF",
};

// Nombre/aseguradora/tope quedan vacíos por defecto — a diferencia del
// hook/subtítulo (copy genérica reutilizable por cualquier asesor), estos
// tres campos identifican un producto y una aseguradora real específicos;
// dejarlos con un valor de ejemplo haría que cada mini app nueva saliera
// publicada mencionando la marca de otro asesor.
export const DEFAULT_DIAGNOSTICO_RETIRO_PRODUCTO: DiagnosticoRetiroProducto = {
  nombre: "",
  aseguradora: "",
  topeDeducible: "",
};

export const DEFAULT_DIAGNOSTICO_RETIRO_TEXTOS: DiagnosticoRetiroTextos = {
  heroPregunta: "¿Tu dinero de hoy te va a alcanzar cuando dejes de trabajar?",
  heroSub: "Responde 8 preguntas rápidas y descubre en qué punto estás de tu retiro — y qué puedes optimizar hoy.",
  disclaimer: "Diagnóstico orientativo; no sustituye una asesoría personalizada.",
  consentLabel:
    "Acepto que usen mis datos para darme seguimiento sobre este diagnóstico, conforme al Aviso de Privacidad (LFPDPPP). Mis datos no se compartirán con terceros.",
};

export const DEFAULT_DIAGNOSTICO_RETIRO_AREA_LABELS: Record<DiagnosticoRetiroArea, string> = {
  retiro: "Retiro",
  ahorro: "Ahorro",
  proteccion: "Protección",
  fiscal: "Fiscal",
};

function opt(label: string, points: Partial<Record<DiagnosticoRetiroArea, number>>, theme = ""): DiagnosticoRetiroOption {
  return {
    label,
    points: { retiro: 0, ahorro: 0, fiscal: 0, proteccion: 0, ...points },
    theme,
  };
}

export const DEFAULT_DIAGNOSTICO_RETIRO_QUESTIONS: DiagnosticoRetiroQuestion[] = [
  {
    text: "¿En qué rango de edad estás?",
    options: [
      opt("18 a 30 años", { retiro: 25 }),
      opt("31 a 40 años", { retiro: 19 }),
      opt("41 a 50 años", { retiro: 11 }),
      opt("51 años o más", { retiro: 4 }),
    ],
  },
  {
    text: "¿Cuál es tu ingreso mensual promedio antes de impuestos?",
    options: [
      opt("Menos de $15,000 pesos", { ahorro: 4, fiscal: 4 }),
      opt("Entre $15,000 y $35,000 pesos", { ahorro: 12, fiscal: 12 }),
      opt("Entre $35,000 y $70,000 pesos", { ahorro: 19, fiscal: 19 }),
      opt("Más de $70,000 pesos", { ahorro: 25, fiscal: 25 }),
    ],
  },
  {
    text: "Además de tu AFORE obligatoria, ¿ya tienes un plan de retiro propio?",
    options: [
      opt("No, solo tengo lo que aporta mi patrón al IMSS/ISSSTE", { retiro: 2, fiscal: 2, proteccion: 2 }),
      opt("Ahorro por mi cuenta de vez en cuando, sin un plan fijo", { retiro: 10, fiscal: 8, proteccion: 8 }),
      opt("Tengo un plan privado, pero no sé si es suficiente", { retiro: 17, fiscal: 16, proteccion: 16 }),
      opt("Tengo un plan privado sólido y lo reviso cada año", { retiro: 25, fiscal: 25, proteccion: 25 }),
    ],
  },
  {
    text: "¿Cuánto puedes destinar hoy a tu retiro cada mes?",
    options: [
      opt("Nada, mis gastos absorben todo mi ingreso", { ahorro: 2 }),
      opt("Entre $500 y $2,000 pesos al mes", { ahorro: 10 }),
      opt("Entre $2,000 y $8,000 pesos al mes", { ahorro: 18 }),
      opt("Más de $8,000 pesos al mes", { ahorro: 25 }),
    ],
  },
  {
    text: "¿Cuántos años te faltan para retirarte?",
    options: [
      opt("Menos de 10 años", { retiro: 6 }),
      opt("Entre 10 y 20 años", { retiro: 14 }),
      opt("Entre 20 y 30 años", { retiro: 21 }),
      opt("Más de 30 años", { retiro: 25 }),
    ],
  },
  {
    text: "Si algo imprevisto pasara (enfermedad grave, invalidez, fallecimiento), ¿qué tan protegido está hoy tu plan de retiro?",
    options: [
      opt("Nada protegido, no tengo ningún seguro", { proteccion: 2 }),
      opt("Tengo alguna cobertura básica, por ejemplo del trabajo", { proteccion: 11 }),
      opt("Tengo un seguro propio, pero no lo he revisado en años", { proteccion: 18 }),
      opt("Tengo cobertura sólida y actualizada", { proteccion: 25 }),
    ],
  },
  {
    text: "Si tu ahorro pudiera crecer más a cambio de fluctuar en el corto plazo, ¿qué tan cómodo te sentirías?",
    options: [
      opt("Nada cómodo, prefiero certeza total aunque rinda menos", { ahorro: 12 }),
      opt("Algo incómodo, prefiero un balance entre seguridad y crecimiento", { ahorro: 19 }),
      opt("Cómodo, priorizo el crecimiento a largo plazo", { ahorro: 25 }),
      opt("No estoy seguro, necesito que me orienten", { ahorro: 14 }),
    ],
  },
  {
    text: "¿Cuál es tu objetivo principal con tu retiro?",
    options: [
      opt("Mantener mi nivel de vida cuando deje de trabajar", {}, "mantener"),
      opt("Dejar un patrimonio protegido para mi familia", {}, "patrimonio"),
      opt("Pagar menos impuestos aprovechando las deducciones fiscales", {}, "fiscal"),
      opt("Tener liquidez disponible para proyectos personales", {}, "liquidez"),
    ],
  },
];

export const DEFAULT_DIAGNOSTICO_RETIRO_UMBRAL_1 = 40;
export const DEFAULT_DIAGNOSTICO_RETIRO_UMBRAL_2 = 70;

export const DEFAULT_DIAGNOSTICO_RETIRO_PERFILES: DiagnosticoRetiroPerfil[] = [
  {
    name: "Constructor inicial",
    headline: "Estás en el punto de partida",
    desc: "Es un buen momento para empezar: mientras antes arranques, más tiempo tiene tu dinero para crecer.",
  },
  {
    name: "En camino",
    headline: "Vas construyendo, pero hay huecos por cerrar",
    desc: "Ya tienes bases, pero todavía hay espacio para fortalecer tu plan antes de que el tiempo juegue en tu contra.",
  },
  {
    name: "Optimizable",
    headline: "Tienes buenas bases — ahora toca optimizar",
    desc: "Tu situación es sólida. En esta etapa, cada ajuste fino (fiscal, de protección, de eficiencia) tiene un impacto real en el resultado final.",
  },
];

export const DEFAULT_DIAGNOSTICO_RETIRO_RECO_POOL: DiagnosticoRetiroRecoPool = {
  retiro_low:
    "Todavía no tienes un plan de retiro formal más allá de tu AFORE. Empezar hoy con un plan de retiro personal (PPR), aunque sea con una aportación modesta, te da años extra de crecimiento a tu favor.",
  retiro_mid:
    "Ya diste el primer paso, pero conviene revisar si tu plan actual realmente alcanza para el estilo de vida que quieres al retirarte. Vale la pena hacer una proyección con cifras reales.",
  retiro_high:
    "Tu plan de retiro está bien encaminado. En esta etapa, el foco pasa de “empezar” a “optimizar”: revisar comisiones, diversificación y que sigas aprovechando el tiempo que te queda.",
  ahorro_low:
    "Hoy es difícil destinar dinero al retiro porque el ingreso se va en gastos del día a día. Antes de pensar en el monto, conviene ordenar el flujo mensual para encontrar un margen, aunque sea pequeño, que puedas volver constante.",
  ahorro_mid:
    "Tienes capacidad de ahorro, pero probablemente no está sistematizada. Automatizar una aportación fija mensual a tu plan de retiro evita que ese margen se diluya en gastos imprevistos.",
  ahorro_high:
    "Tu capacidad de ahorro es sólida. El siguiente paso es asegurarte de que ese ahorro esté en el vehículo correcto: no solo guardado, sino creciendo con eficiencia fiscal.",
  fiscal_low:
    "Probablemente no estás aprovechando la deducibilidad fiscal del Art. 151 de la LISR para planes de retiro personales — hay un tope anual que se puede deducir de tu declaración. Es un beneficio que hoy se está quedando sobre la mesa.",
  fiscal_mid:
    "Ya aprovechas algo del beneficio fiscal disponible, pero probablemente no el máximo. Revisar tu aportación anual contra el tope deducible puede representar ahorro fiscal adicional sin cambiar tu plan.",
  fiscal_high:
    "Ya tienes instrumentos que generan beneficio fiscal. Vale la pena confirmar que estás aportando el máximo deducible cada año, para no dejar beneficio sin usar.",
  proteccion_low:
    "Hoy tu plan de retiro no está protegido: si algo imprevisto pasara, ese plan podría quedar interrumpido. Un plan con componente de protección blinda tu meta incluso si tú no puedes seguir aportando.",
  proteccion_mid:
    "Tienes algo de cobertura, pero conviene revisar si sigue vigente y si realmente protege tu plan de retiro, no solo tu ingreso del día a día.",
  proteccion_high:
    "Tu cobertura de protección está sólida. Solo confirma que esté alineada con tu plan de retiro actual, no con tu situación de hace unos años.",
};

export const DEFAULT_DIAGNOSTICO_RETIRO_THEME_POOL: DiagnosticoRetiroThemePool = {
  mantener:
    "Como tu prioridad es mantener tu nivel de vida al retirarte, el número que más importa es cuánto necesitas mensualmente, no solo cuánto ahorras. Vale la pena calcular esa cifra en concreto con un asesor.",
  patrimonio:
    "Ya que tu objetivo es dejar un patrimonio protegido para tu familia, un plan con componente de seguro de vida es especialmente relevante: además de crecer, protege ese patrimonio desde el primer día.",
  fiscal:
    "Tu prioridad es pagar menos impuestos, así que el Art. 151 LISR es tu mejor aliado: cada peso que aportas a un plan de retiro personal certificado se puede deducir de tu declaración anual.",
  liquidez:
    "Como buscas mantener liquidez para proyectos personales, conviene estructurar tu plan en más de un instrumento: uno con disponibilidad y otro enfocado 100% en el largo plazo.",
};

/** Máximo posible por área a partir de las preguntas/opciones ACTUALES —
 * nunca una constante. Para cada pregunta, toma el mayor puntaje que
 * cualquiera de sus opciones ofrece en esa área (0 si ninguna puntúa ahí,
 * como la pregunta de objetivo) y lo suma al total del área. Usada tanto
 * por diagnosticoRetiroEngine.ts (server, autoritativo) como, reescrita a
 * mano en JS vanilla, por diagnosticoRetiroTemplate.ts (cliente) — mismo
 * motivo que computeDiagnosticoScore: el cliente es intencionalmente JS
 * plano, no puede importar este módulo. */
export function computeAreaMax(questions: DiagnosticoRetiroQuestion[]): Record<DiagnosticoRetiroArea, number> {
  const max: Record<DiagnosticoRetiroArea, number> = { retiro: 0, ahorro: 0, fiscal: 0, proteccion: 0 };
  questions.forEach((q) => {
    DIAGNOSTICO_RETIRO_AREAS.forEach((area) => {
      const best = q.options.reduce((m, o) => Math.max(m, o.points[area] ?? 0), 0);
      max[area] += best;
    });
  });
  return max;
}
