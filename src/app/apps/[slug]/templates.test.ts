import { describe, expect, it } from "vitest";
import * as ahorroFiscal from "./ahorroFiscalTemplate";
import * as contentCalendar from "./contentCalendarTemplate";
import * as controlFinanciero from "./controlFinancieroTemplate";
import * as diagnosticoRetiroIa from "./diagnosticoRetiroIaTemplate";
import * as diagnosticoRetiro from "./diagnosticoRetiroTemplate";
import * as diagnosticoSalud from "./diagnosticoSaludTemplate";
import * as diagnosticoSolidez from "./diagnosticoSolidezTemplate";
import * as diagnostico from "./diagnosticoTemplate";
import * as kitEmergencia from "./kitEmergenciaTemplate";
import * as metaUniversitaria from "./metaUniversitariaTemplate";
import * as testEmergencia from "./testEmergenciaTemplate";

/** El JS de cada plantilla vive dentro de un template literal de TypeScript: un `\"`, `\n` o `\D`
 * escrito como en un .js suelto se "come" la barra y rompe el script entero en el navegador (la
 * página carga pero ningún botón responde). Esto lo detecta antes de deployar. */
const modules = {
  ahorroFiscal,
  contentCalendar,
  controlFinanciero,
  diagnosticoRetiroIa,
  diagnosticoRetiro,
  diagnosticoSalud,
  diagnosticoSolidez,
  diagnostico,
  kitEmergencia,
  metaUniversitaria,
  testEmergencia,
};

const scripts = Object.entries(modules).flatMap(([mod, exports]) =>
  Object.entries(exports)
    .filter(([name, value]) => name.endsWith("_JS") && typeof value === "string")
    .map(([name, value]) => [`${mod}.${name}`, value as string] as const),
);

describe("JS de las plantillas de mini apps", () => {
  it("encuentra los scripts", () => {
    expect(scripts.length).toBeGreaterThanOrEqual(Object.keys(modules).length);
  });

  it.each(scripts)("%s es JavaScript válido", (_name, code) => {
    expect(() => new Function(code)).not.toThrow();
  });
});
