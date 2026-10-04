import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PolicyTable } from "@/app/(protected)/polizas/PolicyTable";
import { CollectionsTable } from "@/app/(protected)/cobranza/CollectionsTable";
import { OpportunityTable } from "@/app/(protected)/crm/OpportunityTable";
import { TaskTableView } from "@/app/(protected)/tasks/views/TaskTableView";
import { AgendaSetterPerformanceTable } from "@/app/(protected)/asesores/agendas/AgendaSetterPerformanceTable";
import { PerformanceRankingTable } from "@/app/(protected)/asesores/performance/PerformanceRankingTable";

// Cada tabla con datos ya filtrados renderiza dos vistas: la tabla (solo md+)
// y una lista de tarjetas (solo debajo de md). Estos tests fijan que ambas
// existan con el contenido esperado, sin depender de un workspace con datos.

const noop = () => {};

describe("PolicyTable (mobile + desktop)", () => {
  const policy = {
    id: "p1",
    policyNumber: "POL-1",
    contactName: "Ana Pérez",
    contactPhone: "+5215500000001",
    contactEmail: null,
    company: "Aseguradora X",
    product: "Vida plus",
    insuranceType: "vida",
    premium: 1200,
    premiumCurrency: "MXN",
    paymentFrequency: "anual",
    startDate: "2026-01-01",
    endDate: "2026-02-01",
    status: "pendiente",
    ownerName: "Luis",
  };
  const props = { onOpen: noop, onOpenDocuments: noop, onEdit: noop, onDuplicate: noop, onCancel: noop };

  it("renderiza tarjeta mobile y tabla desktop con la misma póliza", () => {
    const html = renderToStaticMarkup(createElement(PolicyTable, { policies: [policy as never], ...props }));
    expect(html).toContain("md:hidden");
    expect(html).toContain("hidden overflow-x-auto");
    expect(html).toContain("<table");
    expect(html).toContain("Ana Pérez");
    expect(html).toContain("Vence");
  });

  it("sin pólizas muestra el estado vacío y no renderiza listas", () => {
    const html = renderToStaticMarkup(createElement(PolicyTable, { policies: [], ...props }));
    expect(html).not.toContain("<table");
    expect(html).toContain("Sin resultados");
  });
});

describe("CollectionsTable (mobile + desktop)", () => {
  const item = {
    id: "c1",
    contactName: "Beto",
    contactPhone: "+5215500000002",
    company: "Aseguradora Y",
    policyNumber: "POL-9",
    amount: 500,
    currency: "MXN",
    dueDate: "2026-03-01",
    status: "pendiente",
    ownerName: null,
  };

  it("usa acciones compartidas en ambas vistas", () => {
    const html = renderToStaticMarkup(
      createElement(CollectionsTable, { items: [item as never], onOpen: noop, onRegisterPayment: noop, onReschedule: noop, onCancel: noop }),
    );
    expect(html).toContain("md:hidden");
    expect(html).toContain("<table");
    expect(html).toContain("Sin asignar");
  });
});

describe("OpportunityTable (mobile + desktop)", () => {
  it("renderiza lista mobile con botones de 44px y la tabla desktop", () => {
    const card = {
      id: "o1",
      contactName: "Carla",
      contactAvatarUrl: null,
      title: "Oportunidad 1",
      value: 900,
      currency: "MXN",
      priority: "high",
      probability: 50,
      stageId: "s1",
      ownerName: "Ana",
      ownerAvatarUrl: null,
      source: "web",
      company: null,
      tags: [],
      lastContactAt: null,
    };
    const html = renderToStaticMarkup(
      createElement(OpportunityTable, {
        cards: [card as never],
        stages: [{ id: "s1", name: "Contactado" } as never],
        selectionMode: false,
        selectedIds: new Set<string>(),
        onToggleSelect: noop,
        onOpen: noop,
        onEdit: noop,
        onDelete: noop,
      }),
    );
    expect(html).toContain("md:hidden");
    expect(html).toContain("size-11");
    expect(html).toContain("<table");
    expect(html).toContain('aria-label="Eliminar"');
  });
});

describe("TaskTableView (mobile + desktop)", () => {
  it("renderiza lista mobile y tabla desktop", () => {
    const task = {
      id: "t1",
      title: "Llamar a Ana",
      status: "pending",
      priority: "medium",
      dueAt: null,
      assignedTo: null,
      relatedLabel: null,
      checklistDone: 0,
      checklistTotal: 0,
      commentCount: 0,
      attachmentCount: 0,
      updatedAt: new Date().toISOString(),
    };
    const html = renderToStaticMarkup(
      createElement(TaskTableView, { tasks: [task as never], selectionMode: false, selectedIds: new Set<string>(), onToggleSelect: noop, onOpen: noop }),
    );
    expect(html).toContain("md:hidden");
    expect(html).toContain("Llamar a Ana");
    expect(html).toContain("<table");
  });
});

describe("AgendaSetterPerformanceTable (mobile + desktop)", () => {
  it("calcula el show rate en la tarjeta mobile", () => {
    const row = { setterId: "s1", setterName: "Mía", citas: 4, confirmadas: 3, realizadas: 1, ventas: 1, noShow: 1 };
    const html = renderToStaticMarkup(createElement(AgendaSetterPerformanceTable, { rows: [row as never] }));
    expect(html).toContain("50% show");
    expect(html).toContain("<table");
  });
});

describe("PerformanceRankingTable (mobile + desktop)", () => {
  it("muestra el checkbox de comparar en la tarjeta mobile", () => {
    const row = {
      setterId: "s1",
      setterName: "Mía",
      advisorName: "Ana",
      totals: { conexion: 1, conexionesAceptadas: 1, respuestasPrimerMensaje: 1, calificadas: 1 },
      acceptanceRate: 10,
      responseRate: 20,
      conversationRate: 30,
      bookingRate: 40,
      conversionRate: 50,
      agendas: 2,
      status: "bueno",
    };
    const html = renderToStaticMarkup(
      createElement(PerformanceRankingTable, { rows: [row as never], compareIds: [], onToggleCompare: noop, onSelect: noop }),
    );
    expect(html).toContain('aria-label="Comparar a Mía"');
    expect(html).toContain("md:hidden");
    expect(html).toContain("<table");
  });
});
