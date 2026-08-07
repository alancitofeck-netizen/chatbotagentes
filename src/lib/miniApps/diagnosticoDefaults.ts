/** Dataset por defecto para "Diagnóstico Interactivo Financiero" — las 7
 * preguntas/opciones/pesos y los 4 niveles calcados 1:1 del HTML original
 * que sirvió de base a este tipo de Mini App. Única fuente de verdad,
 * importada tanto por queries.ts (relleno de defaults si `config` viene
 * vacío/incompleto) como por NewMiniAppWizard.tsx (estado inicial del
 * formulario) — así el wizard arranca mostrando exactamente el diagnóstico
 * original, editable desde ahí en adelante. */

export interface DiagnosticoOption {
  t: string;
  w: number;
}

export interface DiagnosticoQuestion {
  text: string;
  area: string;
  options: DiagnosticoOption[];
}

export interface DiagnosticoLevel {
  min: number;
  max: number;
  name: string;
  color: string;
  bg: string;
  lead: string;
  reco: string;
}

export interface DiagnosticoAgente {
  nombre: string;
  marca: string;
  rol: string;
  badge: string;
  titulo: string;
  subtitulo: string;
  whatsapp: string;
  ctaUrl: string;
  webhookUrl: string;
  time: string;
}

export const DEFAULT_DIAGNOSTICO_AGENTE: DiagnosticoAgente = {
  nombre: "",
  marca: "",
  rol: "Asesoría Financiera",
  badge: "Diagnóstico interactivo",
  titulo: "¿Cuántos meses de gastos realmente necesitas ahorrar para estar seguro?",
  subtitulo: "Descubre si tu fondo de emergencia es suficiente y cómo proteger tu estabilidad financiera.",
  whatsapp: "",
  ctaUrl: "",
  webhookUrl: "",
  time: "~3 min",
};

export const DEFAULT_DIAGNOSTICO_QUESTIONS: DiagnosticoQuestion[] = [
  {
    text: "¿Cuál es tu situación laboral actual?",
    area: "Estabilidad de ingresos",
    options: [
      { t: "Desempleado o buscando trabajo actualmente", w: 0 },
      { t: "Empleado con contrato temporal o por proyecto", w: 1 },
      { t: "Empleado de confianza con contrato indefinido", w: 2 },
      { t: "Profesional independiente o empresario consolidado", w: 3 },
    ],
  },
  {
    text: "¿Tienes dependientes económicos (hijos, padres, hermanos) bajo tu responsabilidad?",
    area: "Nivel de protección",
    options: [
      { t: "Sí, tengo 3 o más dependientes que mantener", w: 0 },
      { t: "Sí, tengo entre 1 y 2 dependientes", w: 1 },
      { t: "No tengo dependientes pero tengo compromisos familiares", w: 2 },
      { t: "No tengo dependientes ni compromisos económicos familiares", w: 3 },
    ],
  },
  {
    text: "¿Cuál es tu ingreso mensual promedio antes de impuestos?",
    area: "Estabilidad de ingresos",
    options: [
      { t: "Menor a $10,000 al mes", w: 0 },
      { t: "Entre $10,000 y $25,000 al mes", w: 1 },
      { t: "Entre $25,000 y $60,000 al mes", w: 2 },
      { t: "Mayor a $60,000 al mes", w: 3 },
    ],
  },
  {
    text: "¿Tienes acceso a servicios de salud además del sistema público?",
    area: "Nivel de protección",
    options: [
      { t: "Solo tengo derecho al sistema público, sin póliza privada", w: 0 },
      { t: "Sistema público pero con algunos gastos médicos no cubiertos", w: 1 },
      { t: "Cuento con seguro médico privado complementario", w: 2 },
      { t: "Tengo cobertura integral con seguros privados especializados", w: 3 },
    ],
  },
  {
    text: "¿Cuál es tu capacidad actual de ahorrar mensualmente del ingreso disponible?",
    area: "Ahorro y hábitos",
    options: [
      { t: "No puedo ahorrar, mis gastos igualan o superan mis ingresos", w: 0 },
      { t: "Logro ahorrar entre $500 y $2,000 al mes", w: 1 },
      { t: "Puedo ahorrar entre $2,000 y $8,000 al mes", w: 2 },
      { t: "Consigo ahorrar más de $8,000 cada mes", w: 3 },
    ],
  },
  {
    text: "¿Cuántos meses de gastos tienes ahorrados en fondo de emergencia?",
    area: "Ahorro y hábitos",
    options: [
      { t: "No tengo fondo de emergencia o tengo menos de 1 mes", w: 0 },
      { t: "Tengo entre 1 y 2 meses de gastos ahorrados", w: 1 },
      { t: "Tengo entre 3 y 5 meses de gastos ahorrados", w: 2 },
      { t: "Tengo 6 meses o más de gastos en fondo de emergencia", w: 3 },
    ],
  },
  {
    text: "¿Tienes deudas activas (créditos, tarjetas, hipoteca)?",
    area: "Manejo de deuda",
    options: [
      { t: "Sí, múltiples deudas con cuotas altas (más del 40% de ingresos)", w: 0 },
      { t: "Sí, tengo deudas pero las cuotas son menos del 40% de mis ingresos", w: 1 },
      { t: "Tengo deudas muy pequeñas o estoy en proceso de liquidarlas", w: 2 },
      { t: "No tengo deudas activas, estoy completamente libre de obligaciones", w: 3 },
    ],
  },
];

export const DEFAULT_DIAGNOSTICO_LEVELS: DiagnosticoLevel[] = [
  {
    min: 0,
    max: 39,
    name: "Vulnerable",
    color: "#d9534f",
    bg: "#fdeceb",
    lead: "Tu economía está expuesta: un imprevisto podría desestabilizar tus finanzas y las de tu familia. La buena noticia es que con un plan claro esto cambia rápido.",
    reco: "Prioridad #1: construir un fondo de emergencia y asegurar una protección básica antes que cualquier inversión. Empezar hoy marca la diferencia entre reaccionar y estar preparado.",
  },
  {
    min: 40,
    max: 64,
    name: "En construcción",
    color: "#e0a63c",
    bg: "#fbf3e2",
    lead: "Vas por buen camino, pero hay huecos importantes que dejan tu patrimonio a medias. Con ajustes puntuales puedes pasar de 'aguantar' a 'estar blindado'.",
    reco: "Prioridad: cerrar las brechas de protección y fortalecer tu ahorro para que un evento inesperado no borre tu progreso. Estás a pocos pasos de una base sólida.",
  },
  {
    min: 65,
    max: 84,
    name: "Sólido",
    color: "#2f8a63",
    bg: "#e7f4ee",
    lead: "Tienes una base financiera saludable y hábitos que la mayoría no logra. Ahora el foco es optimizar y hacer crecer lo que ya construiste.",
    reco: "Prioridad: revisar que tu protección esté a la altura de tu patrimonio y diseñar una estrategia de crecimiento e inversión a largo plazo.",
  },
  {
    min: 85,
    max: 100,
    name: "Blindado",
    color: "#1f5c46",
    bg: "#e2efe9",
    lead: "Tu salud financiera es excelente: ingresos estables, protección sólida y hábitos de ahorro consistentes. Estás en el grupo que planifica en lugar de improvisar.",
    reco: "Prioridad: estrategias avanzadas de crecimiento patrimonial, optimización fiscal y planificación de legado para maximizar lo que ya tienes.",
  },
];
