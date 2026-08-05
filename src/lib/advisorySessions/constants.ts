import { HeartPulse, Shield, Car, Home, Briefcase, PiggyBank, Wallet, Plane, PawPrint, type LucideIcon } from "lucide-react";

/** Client-safe constants — mismo motivo que policies/constants.ts: algunos
 * componentes cliente necesitan estos valores en runtime, no solo tipos, y
 * un import de valor real desde un módulo "server-only" rompe el build. */

export const ADVISORY_STEPS = [
  { key: "perfil", label: "Perfil del cliente" },
  { key: "descubrimiento", label: "Descubrimiento" },
  { key: "ramo", label: "Ramo" },
  { key: "analisis_ia", label: "Análisis IA" },
  { key: "resumen", label: "Resumen" },
] as const;

export type AdvisoryStep = (typeof ADVISORY_STEPS)[number]["key"];

export const ADVISORY_STATUSES = ["en_progreso", "completada", "archivada"] as const;
export type AdvisoryStatus = (typeof ADVISORY_STATUSES)[number];

export interface BranchDescriptor {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const ADVISORY_BRANCHES: BranchDescriptor[] = [
  { key: "gmm", label: "GMM", description: "Gastos Médicos Mayores", icon: HeartPulse },
  { key: "vida", label: "Vida", description: "Seguro de vida", icon: Shield },
  { key: "autos", label: "Autos", description: "Seguro vehicular", icon: Car },
  { key: "hogar", label: "Hogar", description: "Seguro de vivienda", icon: Home },
  { key: "empresarial", label: "Empresarial", description: "Seguros para negocios", icon: Briefcase },
  { key: "retiro", label: "Retiro", description: "Planes de retiro", icon: PiggyBank },
  { key: "ahorro", label: "Ahorro", description: "Productos de ahorro e inversión", icon: Wallet },
  { key: "viaje", label: "Viaje", description: "Seguro de viaje", icon: Plane },
  { key: "mascotas", label: "Mascotas", description: "Seguro para mascotas", icon: PawPrint },
];

export type QuestionFieldType = "text" | "textarea" | "number" | "date" | "select" | "boolean";

export interface QuestionField {
  key: string;
  label: string;
  type: QuestionFieldType;
  options?: string[];
  placeholder?: string;
}

export const PROFILE_FIELDS: QuestionField[] = [
  { key: "nombre", label: "Nombre", type: "text" },
  { key: "edad", label: "Edad", type: "number" },
  { key: "fechaNacimiento", label: "Fecha de nacimiento", type: "date" },
  { key: "estadoCivil", label: "Estado civil", type: "select", options: ["Soltero/a", "Casado/a", "Divorciado/a", "Viudo/a", "Unión libre"] },
  { key: "profesion", label: "Profesión", type: "text" },
  { key: "empresa", label: "Empresa", type: "text" },
  { key: "ingresos", label: "Ingresos mensuales", type: "number" },
  { key: "dependientes", label: "Dependientes", type: "number" },
  { key: "ciudad", label: "Ciudad", type: "text" },
  { key: "telefono", label: "Teléfono", type: "text" },
  { key: "email", label: "Email", type: "text" },
  { key: "rfc", label: "RFC", type: "text" },
  { key: "curp", label: "CURP", type: "text" },
];

export const DISCOVERY_FIELDS: QuestionField[] = [
  { key: "objetivoFinanciero", label: "¿Cuál es tu principal objetivo financiero?", type: "textarea" },
  { key: "yaTieneSeguros", label: "¿Ya tienes seguros?", type: "boolean" },
  { key: "cualesSeguros", label: "¿Cuáles?", type: "text" },
  { key: "quePreocupa", label: "¿Qué te preocupa?", type: "textarea" },
  { key: "enfermedades", label: "¿Has tenido enfermedades?", type: "textarea" },
  { key: "viaja", label: "¿Viajas frecuentemente?", type: "boolean" },
  { key: "inversiones", label: "¿Tienes inversiones?", type: "boolean" },
  { key: "creditoHipotecario", label: "¿Tienes crédito hipotecario?", type: "boolean" },
  { key: "hijos", label: "¿Tienes hijos?", type: "boolean" },
  { key: "quienDepende", label: "¿Quién depende económicamente de ti?", type: "text" },
];

/** Preguntas completas para GMM/Vida/Autos (pedidas explícitamente con
 * detalle) — los otros 6 ramos quedan con un set más chico en esta Fase 1,
 * ampliable después sin cambios de esquema (branch_answers es jsonb). */
export const BRANCH_QUESTIONS: Record<string, QuestionField[]> = {
  gmm: [
    { key: "hospitalDeseado", label: "Hospital deseado", type: "text" },
    { key: "sumaAsegurada", label: "Suma asegurada", type: "number" },
    { key: "coberturaInternacional", label: "Cobertura internacional", type: "boolean" },
    { key: "copago", label: "Copago", type: "text" },
    { key: "deducible", label: "Deducible", type: "text" },
    { key: "maternidad", label: "Maternidad", type: "boolean" },
    { key: "dentales", label: "Dentales", type: "boolean" },
  ],
  vida: [
    { key: "montoDeseado", label: "Monto deseado", type: "number" },
    { key: "beneficiarios", label: "Beneficiarios", type: "textarea" },
    { key: "hipoteca", label: "¿Tiene hipoteca a cubrir?", type: "boolean" },
    { key: "dependientes", label: "Dependientes a proteger", type: "number" },
  ],
  autos: [
    { key: "marca", label: "Marca", type: "text" },
    { key: "modelo", label: "Modelo", type: "text" },
    { key: "anio", label: "Año", type: "number" },
    { key: "uso", label: "Uso", type: "select", options: ["Particular", "Comercial"] },
    { key: "conductorPrincipal", label: "Conductor principal", type: "text" },
  ],
  hogar: [
    { key: "direccion", label: "Dirección", type: "text" },
    { key: "valorPropiedad", label: "Valor de la propiedad", type: "number" },
    { key: "tipoPropiedad", label: "Tipo de propiedad", type: "select", options: ["Casa", "Departamento", "Otro"] },
  ],
  empresarial: [
    { key: "nombreEmpresa", label: "Nombre de la empresa", type: "text" },
    { key: "numEmpleados", label: "N° de empleados", type: "number" },
    { key: "giro", label: "Giro del negocio", type: "text" },
  ],
  retiro: [
    { key: "edadRetiroDeseada", label: "Edad de retiro deseada", type: "number" },
    { key: "ahorroMensualDeseado", label: "Ahorro mensual deseado", type: "number" },
  ],
  ahorro: [
    { key: "montoObjetivo", label: "Monto objetivo", type: "number" },
    { key: "plazoAnios", label: "Plazo (años)", type: "number" },
  ],
  viaje: [
    { key: "destino", label: "Destino", type: "text" },
    { key: "fechaViaje", label: "Fecha de viaje", type: "date" },
  ],
  mascotas: [
    { key: "tipoMascota", label: "Tipo de mascota", type: "text" },
    { key: "edadMascota", label: "Edad de la mascota", type: "number" },
  ],
};
