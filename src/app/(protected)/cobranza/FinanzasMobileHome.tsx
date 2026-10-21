"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ThemeToggle } from "@/lib/theme/ThemeToggle";
import { getFinanzasMovimientosAction } from "@/lib/finanzas/actions";
import type { FinanzasMovimiento } from "@/lib/finanzas/queries";
import type { FinanzasTipo } from "@/lib/finanzas/constants";
import { GastosView, CobrosView, ResumenView } from "./FinanzasMobileViews";
import { CalendarioView } from "./FinanzasMobileCalendarView";
import { FinanzasMobileForm } from "./FinanzasMobileForm";
import { FinanzasMobileActionsSheet } from "./FinanzasMobileActionsSheet";

type Tab = "gastos" | "cal" | "cobros" | "res";
const TAB_LABEL: Record<Tab, string> = { gastos: "Gastos", cal: "Calendario", cobros: "Cobros", res: "Resumen" };
const TABS: { key: Tab; icon: string }[] = [
  { key: "gastos", icon: "🧾" },
  { key: "cal", icon: "📅" },
];
const TABS_RIGHT: { key: Tab; icon: string }[] = [
  { key: "cobros", icon: "💰" },
  { key: "res", icon: "📊" },
];

/** Versión mobile de Finanzas — 4 pestañas propias (Gastos/Calendario/Cobros/
 * Resumen) con navegación inferior + FAB, distinta de la de escritorio
 * (FinanzasShell, 2 pestañas). Las 4 vistas quedan siempre montadas (solo se
 * ocultan con `hidden`) para no perder su estado — filtros, mes, día
 * elegido — al cambiar de pestaña, igual criterio que el prototipo de
 * referencia. Un solo fetch de todos los movimientos del workspace; cada
 * vista recalcula sus propios números en el cliente. */
export function FinanzasMobileHome() {
  const [items, setItems] = useState<FinanzasMovimiento[] | null>(null);
  const [tab, setTab] = useState<Tab>("gastos");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<FinanzasMovimiento | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formTipo, setFormTipo] = useState<FinanzasTipo>("out");
  const [editing, setEditing] = useState<FinanzasMovimiento | null>(null);

  const load = useCallback(() => {
    getFinanzasMovimientosAction()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);
  useEffect(() => {
    load();
  }, [load, refreshKey]);

  function handleChanged() {
    setRefreshKey((k) => k + 1);
  }
  function openCreate() {
    setEditing(null);
    setFormTipo(tab === "cobros" ? "in" : "out");
    setFormOpen(true);
  }
  function openEdit(m: FinanzasMovimiento) {
    setSelected(null);
    setEditing(m);
    setFormTipo(m.tipo);
    setFormOpen(true);
  }

  return (
    <div className="md:hidden">
      <div className="mx-auto max-w-[480px] px-4" style={{ paddingBottom: "calc(96px + env(safe-area-inset-bottom))" }}>
        <header className="flex items-center gap-2.5 pt-[calc(12px+env(safe-area-inset-top))] pb-2.5">
          <div className="flex size-[38px] items-center justify-center rounded-[11px] bg-[#0f1f24] font-bold text-white dark:bg-neutral-100 dark:text-neutral-900">$</div>
          <div className="flex-1">
            <h1 className="m-0 text-[20px] font-semibold text-foreground">Finanzas</h1>
            <small className="block text-[11px] font-medium text-neutral-500">{TAB_LABEL[tab]}</small>
          </div>
          <ThemeToggle />
        </header>

        {items === null ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Cargando…
          </div>
        ) : (
          <>
            <div className={tab === "gastos" ? "" : "hidden"}>
              <GastosView items={items} onSelect={setSelected} />
            </div>
            <div className={tab === "cal" ? "" : "hidden"}>
              <CalendarioView items={items} onSelect={setSelected} />
            </div>
            <div className={tab === "cobros" ? "" : "hidden"}>
              <CobrosView items={items} onSelect={setSelected} />
            </div>
            <div className={tab === "res" ? "" : "hidden"}>
              <ResumenView items={items} onSelect={setSelected} />
            </div>
          </>
        )}
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-[8] border-t border-border-default bg-surface-1 px-2 pt-1.5"
        style={{ paddingBottom: "calc(6px + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto grid max-w-[480px] grid-cols-[1fr_1fr_72px_1fr_1fr] items-center">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-semibold ${tab === t.key ? "text-accent-600" : "text-neutral-500"}`}
            >
              <span className="text-[20px] leading-none">{t.icon}</span>
              {TAB_LABEL[t.key]}
            </button>
          ))}
          <button
            type="button"
            onClick={openCreate}
            aria-label="Nuevo movimiento"
            className="mx-auto -mt-6 flex size-[58px] items-center justify-center rounded-full bg-accent-600 text-[28px] text-[var(--on-accent)] shadow-[var(--elevation-md)]"
          >
            ＋
          </button>
          {TABS_RIGHT.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-semibold ${tab === t.key ? "text-accent-600" : "text-neutral-500"}`}
            >
              <span className="text-[20px] leading-none">{t.icon}</span>
              {TAB_LABEL[t.key]}
            </button>
          ))}
        </div>
      </nav>

      {selected && <FinanzasMobileActionsSheet item={selected} onClose={() => setSelected(null)} onEdit={openEdit} onChanged={handleChanged} />}
      {formOpen && (
        <FinanzasMobileForm
          key={editing?.id ?? `new-${formTipo}`}
          movimiento={editing}
          defaultTipo={formTipo}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            handleChanged();
            setFormOpen(false);
          }}
        />
      )}
    </div>
  );
}
