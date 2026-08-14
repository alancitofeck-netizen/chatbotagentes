/** Config por defecto para "Top Apps, de ingresos y gastos" (Control
 * Financiero — Presupuesto Base Cero) — los campos del objeto `CONFIG` del
 * HTML original que sirvió de base a este tipo de Mini App. Única fuente de
 * verdad, importada tanto por queries.ts (relleno de defaults si `config`
 * viene vacío/incompleto) como por NewMiniAppWizard.tsx (estado inicial del
 * formulario) — mismo patrón que los demás `*Defaults.ts`.
 *
 * A diferencia de TODOS los demás templates de Mini Apps de este proyecto,
 * este archivo NO exporta ninguna función de saneamiento/recómputo de lead
 * — porque el archivo original no tiene ninguna superficie de captura de
 * leads: no hay gate, no hay campos de nombre/WhatsApp/email, no hay
 * `buildLead()` ni `sendLeadToCRM()`. Su propio comentario de cabecera lo
 * declara como principio de diseño ("PRIVACIDAD: todos los datos viven SOLO
 * en el navegador (localStorage). Nada se envía a ningún servidor.") — el
 * presupuesto y las transacciones que carga la persona nunca salen de su
 * dispositivo, ni siquiera de forma agregada/saneada (a diferencia de Kit
 * Emergencia o Test de Preparación, que sí mandan un resultado agregado).
 * Integrar esto agregando un gate o un campo de contacto sería modificar la
 * lógica/el propósito del archivo original, exactamente lo que esta
 * integración nunca hace — así que esta Mini App vive en el CRM como una
 * herramienta de valor sin generar `mini_app_leads` nunca (su pestaña
 * "Leads" queda siempre vacía; solo las visitas se cuentan, igual que en
 * cualquier otro template). */

export interface ControlFinancieroBrand {
  advisorName: string;
  title: string;
  subtitle: string;
  logoURL: string;
  colorMarca: string;
  monedaDefault: string;
  anio: number;
}

export const DEFAULT_CONTROL_FINANCIERO_BRAND: ControlFinancieroBrand = {
  advisorName: "",
  title: "Control Financiero 2026",
  subtitle: "Presupuesto Base Cero",
  logoURL: "",
  colorMarca: "",
  monedaDefault: "$",
  anio: 2026,
};
