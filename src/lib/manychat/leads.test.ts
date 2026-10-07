import { describe, expect, it } from "vitest";
import { channelBreakdown, computeKpis, contentRanking, detectChannel, detectStage, funnel, leadsBetween, normalizeRows, parseDate, periodWindows } from "./leads";

const row = (overrides: Record<string, string>) => ({
  Fecha: "2026-10-01",
  Canal: "Instagram Reels",
  Etapa: "Nuevo",
  Contenido: "3 errores con tus impuestos",
  ...overrides,
});

describe("detectChannel", () => {
  it("reconoce canales por alias", () => {
    expect(detectChannel("Instagram Reels")).toBe("reel");
    expect(detectChannel("WhatsApp")).toBe("whatsapp");
    expect(detectChannel("")).toBe("otros");
  });

  it("sin canal explícito, mira las pistas", () => {
    expect(detectChannel("", "", "Anuncio: seguro de vida", "", "")).toBe("meta_ads");
  });
});

describe("detectStage", () => {
  it("ordena las etapas por lo más avanzado que aparezca", () => {
    expect(detectStage("Cliente")).toBe("cliente");
    expect(detectStage("Cita agendada")).toBe("cita");
    expect(detectStage("Calificado")).toBe("calificado");
    expect(detectStage("Seguimiento")).toBe("contactado");
    expect(detectStage("")).toBe("nuevo");
  });
});

describe("parseDate", () => {
  it("fecha sin hora es medianoche local", () => {
    expect(parseDate("2026-10-01")).toBe(new Date(2026, 9, 1).getTime());
  });

  it("acepta formato día/mes/año", () => {
    expect(parseDate("01/10/2026")).toBe(new Date(2026, 9, 1).getTime());
  });

  it("valor vacío o inválido no tiene fecha", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("no es fecha")).toBeNull();
  });
});

describe("normalizeRows", () => {
  it("cuenta filas sin fecha aparte", () => {
    const sheet = normalizeRows([row({}), row({ Fecha: "" })]);
    expect(sheet.leads).toHaveLength(1);
    expect(sheet.skipped).toBe(1);
  });

  it("sin columna de etapa, todos quedan como nuevos", () => {
    const sheet = normalizeRows([{ Fecha: "2026-10-01", Canal: "WhatsApp" }]);
    expect(sheet.hasStages).toBe(false);
    expect(sheet.leads[0].etapa).toBe("nuevo");
  });
});

describe("funnel", () => {
  const leads = normalizeRows([
    row({ Etapa: "Nuevo" }),
    row({ Etapa: "Contactado" }),
    row({ Etapa: "Calificado" }),
    row({ Etapa: "Cita" }),
  ]).leads;

  it("cuenta acumulado: cada etapa incluye a las más avanzadas", () => {
    const steps = funnel(leads, true);
    expect(steps.map((s) => s.count)).toEqual([4, 3, 2, 1, 0]);
  });

  it("calcula el porcentaje que pasa de una etapa a la siguiente", () => {
    const steps = funnel(leads, true);
    expect(steps[1].passRate).toBe(75);
    expect(steps[2].passRate).toBeCloseTo(66.67, 1);
  });

  it("sin datos de citas, la etapa Cita queda como no disponible", () => {
    const steps = funnel(leads, false);
    expect(steps[3].na).toBe(true);
  });
});

describe("channelBreakdown y contentRanking", () => {
  const leads = normalizeRows([
    row({ Etapa: "Cita" }),
    row({ Etapa: "Nuevo" }),
    row({ Canal: "WhatsApp", Contenido: "Botón en la bio", Etapa: "Cliente", Valor: "100" }),
  ]).leads;

  it("agrupa por canal y ordena por cantidad", () => {
    const channels = channelBreakdown(leads);
    expect(channels[0].id).toBe("reel");
    expect(channels[0].leads).toBe(2);
    expect(channels[1].clientes).toBe(1);
  });

  it("el % que pasa a cita incluye a los clientes", () => {
    const ranking = contentRanking(leads, true);
    const reel = ranking.find((r) => r.canal === "reel")!;
    expect(reel.pasaCita).toBe(50);
    const wa = ranking.find((r) => r.canal === "whatsapp")!;
    expect(wa.clientes).toBe(1);
  });
});

describe("datos de contacto de la hoja", () => {
  it("guarda nombre, teléfono, usuario y nota cuando la hoja los trae", () => {
    const [lead] = normalizeRows([row({ Nombre: "Camila Ortega", Telefono: "+54 9 11 5555 0142", Usuario: "@cami", Notas: "Quiere retirarse a los 58" })]).leads;
    expect(lead.nombre).toBe("Camila Ortega");
    expect(lead.telefono).toBe("+54 9 11 5555 0142");
    expect(lead.usuario).toBe("@cami");
    expect(lead.nota).toBe("Quiere retirarse a los 58");
  });

  it("sin nombre ni usuario, el lead queda como 'Sin nombre'", () => {
    const [lead] = normalizeRows([row({})]).leads;
    expect(lead.nombre).toBe("Sin nombre");
  });
});

describe("período y KPIs", () => {
  const now = new Date(2026, 9, 30).getTime();
  const day = (n: number) => new Date(2026, 9, 30 - n).toISOString().slice(0, 10);
  const leads = normalizeRows([
    row({ Fecha: day(2), Etapa: "Cliente", Valor: "1200" }),
    row({ Fecha: day(5), Etapa: "Calificado" }),
    row({ Fecha: day(40), Etapa: "Cita" }),
    row({ Fecha: day(100), Etapa: "Nuevo" }),
  ]);

  it("la ventana de 30 días y la anterior no se pisan", () => {
    const { from, prevFrom } = periodWindows("30", now);
    expect(leadsBetween(leads.leads, from, now + 1)).toHaveLength(2);
    expect(leadsBetween(leads.leads, prevFrom, from!)).toHaveLength(1);
  });

  it("'Todo' no tiene límite ni comparación", () => {
    const { from, prevFrom } = periodWindows("all", now);
    expect(from).toBeNull();
    expect(prevFrom).toBeNull();
    expect(leadsBetween(leads.leads, from, now + 1)).toHaveLength(4);
  });

  it("calcula los indicadores, con ingresos solo de clientes", () => {
    const k = computeKpis(leads.leads.slice(0, 2), leads.hasCitas);
    expect(k).toMatchObject({ leads: 2, calificados: 2, clientes: 1, conversion: 50, ingresos: 1200 });
  });

  it("sin datos de citas, el indicador de citas es nulo", () => {
    const sinCitas = normalizeRows([row({ Etapa: "Nuevo" })]);
    expect(computeKpis(sinCitas.leads, sinCitas.hasCitas).citas).toBeNull();
  });
});
