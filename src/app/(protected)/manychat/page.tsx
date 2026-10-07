import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ModuleDisabledState } from "@/components/layout/ModuleDisabledState";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getWorkspaceModuleStatus } from "@/lib/settings/queries";
import { getManychatSheetLink } from "@/lib/manychat/sheetLink";
import { fetchSheetRows, SheetError } from "@/lib/manychat/sheetSource";
import { channelBreakdown, contentRanking, funnel, normalizeRows, ratio, STAGES, type NormalizedSheet, type StageId } from "@/lib/manychat/leads";
import { ContentRanking } from "./ContentRanking";
import { SheetLinkForm } from "./SheetLinkForm";
import { fmtInt, fmtPct } from "./format";

export const metadata: Metadata = { title: "ManyChat — Growth Link" };

/** Colores de cada etapa. Se leen bien en claro y en oscuro. */
const STAGE_COLOR: Record<StageId, string> = {
  nuevo: "#c9e6ec",
  contactado: "#8fcfdb",
  calificado: "#13a9bd",
  cita: "#6fdae8",
  cliente: "#3dd68c",
};

async function loadSheet(sheetUrl: string | null): Promise<{ sheet: NormalizedSheet | null; error: string | null }> {
  if (!sheetUrl) return { sheet: null, error: null };
  try {
    return { sheet: normalizeRows(await fetchSheetRows(sheetUrl)), error: null };
  } catch (err) {
    return { sheet: null, error: err instanceof SheetError ? err.message : "No se pudo leer la hoja." };
  }
}

/** Tablero de ManyChat dentro de la app: los datos vienen de la hoja del workspace
 * y se calculan en el servidor. Sin iframe. */
export default async function ManychatPage() {
  const { workspaceId, role } = await requireActiveWorkspace();
  const moduleStatus = await getWorkspaceModuleStatus(workspaceId);
  if (!moduleStatus.some((m) => m.moduleKey === "manychat" && m.enabled)) {
    return <ModuleDisabledState moduleName="ManyChat" />;
  }

  const sheetUrl = await getManychatSheetLink(workspaceId);
  const { sheet, error } = await loadSheet(sheetUrl);
  const canEdit = role === "owner" || role === "admin";

  return (
    <div className="flex flex-col gap-5 py-4 sm:py-6 lg:py-8">
      <div className="px-4 sm:px-6 lg:px-8">
        <PageHeader
          icon={MessageCircle}
          title="ManyChat"
          description="Leads que llegan desde Instagram y WhatsApp, y en qué etapa están."
          actions={
            <Link href="/manychat/completo" className="text-[13px] font-medium text-accent-700 hover:underline">
              Tablero completo
            </Link>
          }
        />
      </div>

      <div className="flex flex-col gap-5 px-4 sm:px-6 lg:px-8">
        {!sheetUrl && (
          <Panel title="Conectá tu hoja de ManyChat">
            <p className="text-sm text-neutral-600">Pegá el link de la hoja donde ManyChat guarda tus leads. Lo guarda tu workspace, así lo ve todo el equipo.</p>
            {canEdit ? <SheetLinkForm currentUrl={null} /> : <p className="text-sm text-neutral-500">Pedile al owner o a un admin que conecte la hoja.</p>}
          </Panel>
        )}

        {sheetUrl && error && (
          <Panel title="No pudimos leer la hoja">
            <p className="text-sm text-error-strong">{error}</p>
            {canEdit && <SheetLinkForm currentUrl={sheetUrl} />}
          </Panel>
        )}

        {sheet && sheet.leads.length === 0 && (
          <Panel title="Todavía no hay leads">
            <p className="text-sm text-neutral-600">La hoja no tiene filas con fecha válida. Cuando ManyChat cargue leads, aparecen acá.</p>
          </Panel>
        )}

        {sheet && sheet.leads.length > 0 && <Dashboard sheet={sheet} sheetUrl={sheetUrl} canEdit={canEdit} />}
      </div>
    </div>
  );
}

function Dashboard({ sheet, sheetUrl, canEdit }: { sheet: NormalizedSheet; sheetUrl: string | null; canEdit: boolean }) {
  const leads = sheet.leads;
  const total = leads.length;
  const clientes = leads.filter((l) => l.etapa === "cliente").length;
  const citas = leads.filter((l) => ["cita", "cliente"].includes(l.etapa)).length;
  const steps = funnel(leads, sheet.hasCitas);
  const channels = channelBreakdown(leads);
  const content = contentRanking(leads, sheet.hasCitas);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Leads" value={fmtInt(total)} />
        {sheet.hasCitas && <Kpi label="En cita o cliente" value={fmtInt(citas)} />}
        <Kpi label="Clientes" value={fmtInt(clientes)} />
        <Kpi label="Conversión" value={fmtPct(ratio(clientes, total))} />
      </div>

      <Panel title="Embudo" subtitle="Hasta qué etapa llegaron los leads.">
        <ol className="flex flex-col gap-4">
          {steps.map((step) => (
            <li key={step.id} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-foreground">{step.label}</p>
                {step.na ? (
                  <p className="text-[11px] text-neutral-500">Sin datos de citas</p>
                ) : step.passRate !== null ? (
                  <p className="text-[11px] font-semibold text-accent-700">{fmtPct(step.passRate)} pasa</p>
                ) : null}
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                <i className="block h-full rounded-full" style={{ width: `${step.na ? 0 : step.share}%`, backgroundColor: STAGE_COLOR[step.id] }} />
              </div>
              <span className="w-10 text-right font-display text-[18px] font-semibold tabular-nums text-foreground">{step.na ? "—" : fmtInt(step.count)}</span>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="Etapa por canal" subtitle="En qué etapa están hoy los leads de cada canal.">
        <ul className="flex flex-col gap-4">
          {channels.map((c) => {
            const stagesShown = STAGES.filter((s) => s.id !== "cita" || sheet.hasCitas);
            return (
              <li key={c.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: c.color }} aria-hidden="true" />
                    {c.nombre}
                  </span>
                  <span className="text-[12px] text-neutral-500 tabular-nums">
                    {fmtInt(c.leads)} leads{c.clientes > 0 ? `, ${fmtInt(c.clientes)} ${c.clientes === 1 ? "cliente" : "clientes"}` : ""}
                  </span>
                </div>
                <div className="flex h-3 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={stagesShown.map((s) => `${s.label}: ${c.porEtapa[s.id]}`).join(", ")}>
                  {stagesShown.map((s) => (
                    <i key={s.id} className="block h-full" style={{ width: `${ratio(c.porEtapa[s.id], c.leads)}%`, backgroundColor: STAGE_COLOR[s.id] }} />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-neutral-600">
          {STAGES.filter((s) => s.id !== "cita" || sheet.hasCitas).map((s) => (
            <span key={s.id} className="flex items-center gap-1.5">
              <i className="size-2.5 rounded-sm" style={{ backgroundColor: STAGE_COLOR[s.id] }} aria-hidden="true" />
              {s.label}
            </span>
          ))}
        </div>
      </Panel>

      <ContentRanking rows={content} hasCitas={sheet.hasCitas} />

      <footer className="flex flex-col items-center gap-2 pb-4 text-center text-[12px] text-neutral-500">
        <p>
          Datos de tu hoja de ManyChat{sheet.skipped > 0 ? ` · ${fmtInt(sheet.skipped)} filas sin fecha se omitieron` : ""}.
        </p>
        {canEdit && sheetUrl && (
          <details className="w-full max-w-md text-left">
            <summary className="cursor-pointer text-accent-700 hover:underline">Cambiar la hoja</summary>
            <div className="mt-3">
              <SheetLinkForm currentUrl={sheetUrl} />
            </div>
          </details>
        )}
      </footer>
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-default bg-surface-1 p-4">
      <p className="text-[12px] text-neutral-500">{label}</p>
      <p className="mt-1 font-display text-[26px] leading-none font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border-default bg-surface-1 p-5">
      <div>
        <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-foreground">{title}</h2>
        {subtitle && <p className="mt-1 text-[13px] text-neutral-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
