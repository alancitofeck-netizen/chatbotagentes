"use client";

import { useEffect, useState } from "react";
import { CalendarDays, HandCoins, PieChart, Receipt, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Fab } from "@/components/ui/Fab";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "@/components/toast/toast";
import { useAutoStartTour } from "@/components/onboarding/useAutoStartTour";
import { getFinanceDataAction } from "@/lib/finance/actions";
import { financeStatus, isoDate, type FinanceItem, type FinanceSettings, type FinanceType } from "@/lib/finance/model";
import { CalendarioView, CobrosView, GastosView, ResumenView } from "./FinanceViews";
import { FinanceEntrySheet } from "./FinanceEntrySheet";
import { FinanceActionsSheet } from "./FinanceActionsSheet";
import { FinanceSettingsSheet } from "./FinanceSettingsSheet";
import { CollectionDetailDrawer } from "./CollectionDetailDrawer";
import { CollectionAutomationsSheet } from "./CollectionAutomationsSheet";

type Tab = "gastos" | "cal" | "cobros" | "res";
const TABS: { id: Tab; label: string; icon: typeof Receipt }[] = [
  { id: "gastos", label: "Gastos", icon: Receipt },
  { id: "cal", label: "Calendario", icon: CalendarDays },
  { id: "cobros", label: "Cobros", icon: HandCoins },
  { id: "res", label: "Resumen", icon: PieChart },
];

interface ShellProps {
  initialItems: FinanceItem[];
  initialSettings: FinanceSettings;
  /** ?payment=<id> — los links de notificaciones/automatizaciones de Cobranza abren ese cobro. */
  initialPaymentId: string | null;
}

/** "Hoy" se calcula en el navegador (no en el servidor, que está en UTC): de noche en México el
 * servidor ya está en el día siguiente y marcaría cobros como vencidos antes de tiempo. */
export function FinanzasShell(props: ShellProps) {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    Promise.resolve().then(() => setToday(isoDate(new Date())));
  }, []);
  if (!today)
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  return <FinanzasApp {...props} today={today} />;
}

function FinanzasApp({ initialItems, initialSettings, initialPaymentId, today }: ShellProps & { today: string }) {
  useAutoStartTour("collections-intro");
  const [items, setItems] = useState(initialItems);
  const [settings, setSettings] = useState(initialSettings);
  const [tab, setTab] = useState<Tab>(initialPaymentId ? "cobros" : "gastos");
  const [selectedDay, setSelectedDay] = useState(today);
  const [actionKey, setActionKey] = useState<string | null>(initialPaymentId ? `policy:${initialPaymentId}` : null);
  const [form, setForm] = useState<{ item: FinanceItem | null; type: FinanceType; n: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [automationsOpen, setAutomationsOpen] = useState(false);
  const [policyDetailId, setPolicyDetailId] = useState<string | null>(null);

  const actionItem = actionKey ? (items.find((i) => i.key === actionKey) ?? null) : null;
  const lateCount = items.filter((i) => i.type === "in" && financeStatus(i, today) === "late").length;

  async function refresh() {
    try {
      const data = await getFinanceDataAction();
      setItems(data.items);
      setSettings(data.settings);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar.");
    }
  }

  function openForm(item: FinanceItem | null, type: FinanceType) {
    setActionKey(null);
    setForm((f) => ({ item, type, n: (f?.n ?? 0) + 1 }));
  }

  const viewProps = { items, today, settings, onOpen: (i: FinanceItem) => setActionKey(i.key) };
  const newType: FinanceType = tab === "cobros" ? "in" : "out";

  return (
    <div className="px-4 pb-28 sm:px-6 lg:px-8 md:pb-10">
      <div className="sticky top-0 z-10 -mx-4 mb-5 flex items-center gap-2 border-b border-border-default bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <nav role="tablist" aria-label="Finanzas" data-tour="finance.tabs" className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                setTab(id);
                window.scrollTo(0, 0);
              }}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                tab === id ? "bg-accent-50 text-accent-600" : "text-neutral-500 hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <Icon className="hidden size-[18px] sm:block" aria-hidden="true" />
              {label}
              {id === "cobros" && lateCount > 0 && <em className="rounded-full bg-error-bg px-1.5 text-[11px] not-italic text-error">{lateCount}</em>}
            </button>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          data-tour="finance.currency"
          aria-label={`Moneda de los totales: ${settings.baseCurrency}. Cambiar moneda y tipo de cambio`}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border-default bg-surface-1 px-2.5 py-2 text-xs font-semibold hover:border-accent-500"
        >
          <Settings2 className="size-4 text-neutral-500" aria-hidden="true" />
          {settings.baseCurrency}
        </button>
        <div className="hidden shrink-0 gap-2 md:flex" data-tour="finance.new">
          <button type="button" onClick={() => openForm(null, "out")} className="rounded-xl bg-[#c2410c] px-3.5 py-2 text-sm font-bold text-white hover:opacity-90 dark:bg-[#f08a4b]">
            ＋ Nuevo gasto
          </button>
          <button type="button" onClick={() => openForm(null, "in")} className="rounded-xl bg-success px-3.5 py-2 text-sm font-bold text-white hover:opacity-90">
            ＋ Nuevo cobro
          </button>
        </div>
      </div>

      {tab === "gastos" && <GastosView {...viewProps} />}
      {tab === "cal" && <CalendarioView {...viewProps} selected={selectedDay} onSelect={setSelectedDay} />}
      {tab === "cobros" && <CobrosView {...viewProps} onOpenAutomations={() => setAutomationsOpen(true)} />}
      {tab === "res" && <ResumenView {...viewProps} />}

      <Fab aria-label={newType === "in" ? "Nuevo cobro" : "Nuevo gasto"} onClick={() => openForm(null, newType)} />

      <FinanceActionsSheet
        item={actionItem}
        onClose={() => setActionKey(null)}
        onEdit={(item) => openForm(item, item.type)}
        onOpenPolicyDetail={(id) => {
          setActionKey(null);
          setPolicyDetailId(id);
        }}
        onChanged={(message) => {
          toast.success(message);
          setActionKey(null);
          refresh();
        }}
      />
      {form && (
        <FinanceEntrySheet
          key={form.n}
          item={form.item}
          initialType={form.type}
          initialDate={tab === "cal" ? selectedDay : today}
          onClose={() => setForm(null)}
          onSaved={(message) => {
            toast.success(message);
            setForm(null);
            refresh();
          }}
        />
      )}
      {settingsOpen && (
        <FinanceSettingsSheet
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSaved={(s) => {
            setSettings(s);
            setSettingsOpen(false);
            toast.success("Moneda actualizada");
          }}
        />
      )}
      <CollectionDetailDrawer paymentId={policyDetailId} onClose={() => setPolicyDetailId(null)} onChanged={refresh} />
      <CollectionAutomationsSheet open={automationsOpen} onClose={() => setAutomationsOpen(false)} />
    </div>
  );
}
