/** Texto de una póliza de vida ficticia para "Probar con una póliza de ejemplo"
 * (Extracción de pólizas con IA). Pasa por la misma IA que un PDF real
 * (extractPolicyDataWithAI), así la prueba muestra el resultado de verdad; solo
 * se saltea la lectura del PDF. Todos los datos son inventados: aseguradora,
 * personas, RFC, teléfonos y montos no corresponden a nadie real. La fecha de
 * fin de vigencia está algo borrosa a propósito, para que se vea cómo la IA
 * marca en amarillo un dato que conviene revisar. */
export const SAMPLE_POLICY_TEXT = `
SEGUROS ALBORADA S.A. DE C.V.
Póliza de Seguro de Vida Individual — "Vida Plena Temporal 20"
CARÁTULA DE PÓLIZA

Número de póliza: VP-2026-0048213
Fecha de emisión: 03/03/2026
Inicio de vigencia: 15/03/2026 a las 12:00 hrs
Fin de vigencia: 15/03/20?6 a las 12:00 hrs  (plazo contratado: 20 años)

DATOS DEL CONTRATANTE Y ASEGURADO TITULAR
Nombre: María Fernanda López Ruiz
RFC: LORM880412AB3
Domicilio: Av. de los Fresnos 214, Int. 3, Col. Jardines del Valle, C.P. 45138, Zapopan, Jalisco
Teléfono: 33 1234 5678
Correo electrónico: mafer.lopez.ejemplo@correo.com

PLAN Y COBERTURAS
Plan: Vida Plena Temporal 20 — Seguro de vida
Suma asegurada básica por fallecimiento: $1,500,000.00 MXN
Cobertura                                   Suma asegurada
Fallecimiento (básica)                      $1,500,000.00 MXN
Muerte accidental (BIT)                     $1,500,000.00 MXN
Invalidez total y permanente (BIPA)         $750,000.00 MXN
Gastos funerarios                           $50,000.00 MXN

PRIMAS
Forma de pago: Mensual, con cargo automático a tarjeta
Prima mensual: $1,280.00 MXN (incluye recargo por pago fraccionado)
Prima anual equivalente: $15,360.00 MXN
Deducible: No aplica

BENEFICIARIOS
Nombre                          Parentesco      Porcentaje
José Antonio López Ruiz         Hermano         50%
Elena Ruiz Martínez             Madre           50%

AGENTE
Clave de agente: 0731 — Agente de seguros autorizado

Este documento es un ejemplo con datos ficticios, creado para probar la herramienta.
No tiene validez como contrato de seguro.
`;
