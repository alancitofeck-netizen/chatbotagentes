"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/toast/toast";
import type { KpiSetterSheetInfo } from "@/lib/kpis/queries";
import {
  createKpiSetterAction,
  removeKpiSetterAction,
  setKpiSetterSheetAction,
  unlinkKpiSetterSheetAction,
  syncKpisNowAction,
  getKpiSetterSheetsAction,
} from "@/lib/kpis/actions";

/**
 * "Un archivo por setter" (confirmed with the user — their real sheet has no
 * Setter/Semana column, each setter just has their own file). This list is
 * where an admin manages that roster: add a setter, paste their sheet link,
 * see per-setter sync status. Lives inside the Google Sheets card in
 * IntegrationsSection.tsx rather than a second connect flow inside the CRM
 * KPIs tab (that tab only ever reads; this screen is where it's configured).
 */
export function KpiSettersManager({ canManage, accountConnected }: { canManage: boolean; accountConnected: boolean }) {
  const router = useRouter();
  const [setters, setSetters] = useState<KpiSetterSheetInfo[] | null>(null);
  const [newSetterName, setNewSetterName] = useState("");
  const [editingSetterId, setEditingSetterId] = useState<string | null>(null);
  const [sheetInput, setSheetInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isSyncingAll, startSyncTransition] = useTransition();

  function refetch() {
    getKpiSetterSheetsAction().then(setSetters);
  }

  useEffect(() => {
    refetch();
  }, []);

  function handleCreateSetter() {
    if (!newSetterName.trim()) {
      toast.error("Ingresá el nombre del setter.");
      return;
    }
    startTransition(async () => {
      try {
        await createKpiSetterAction(newSetterName);
        setNewSetterName("");
        toast.success("Setter agregado.");
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo crear el setter.");
      }
    });
  }

  function handleRemoveSetter(setter: KpiSetterSheetInfo) {
    if (!window.confirm(`¿Eliminar a "${setter.displayName}"? Esto también borra su historial de KPIs.`)) return;
    startTransition(async () => {
      try {
        await removeKpiSetterAction(setter.id);
        toast.success("Setter eliminado.");
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
      }
    });
  }

  function handleSaveSheet(setterId: string) {
    if (!sheetInput.trim()) {
      toast.error("Pegá el link o ID de la hoja.");
      return;
    }
    startTransition(async () => {
      try {
        await setKpiSetterSheetAction(setterId, { spreadsheetInput: sheetInput });
        toast.success("Hoja conectada.");
        setEditingSetterId(null);
        setSheetInput("");
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo conectar la hoja.");
      }
    });
  }

  function handleUnlinkSheet(setter: KpiSetterSheetInfo) {
    if (!window.confirm(`¿Desconectar la hoja de "${setter.displayName}"?`)) return;
    startTransition(async () => {
      try {
        await unlinkKpiSetterSheetAction(setter.id);
        toast.success("Hoja desconectada.");
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo desconectar.");
      }
    });
  }

  function handleSyncAll() {
    startSyncTransition(async () => {
      try {
        const result = await syncKpisNowAction();
        if (result.ok) {
          toast.success(`Sincronizado — ${result.rowsWritten} semana(s) actualizadas.`);
          router.refresh();
        } else {
          toast.error(`${result.failedCount} setter(s) fallaron: ${result.error ?? ""}`);
        }
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo sincronizar.");
      }
    });
  }

  if (!accountConnected) {
    return <p className="mt-3 text-sm text-neutral-500">Conectá la cuenta de Google arriba para poder agregar setters.</p>;
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Setters</p>
        {setters && setters.some((s) => s.spreadsheetId) && (
          <Button size="sm" variant="secondary" onClick={handleSyncAll} loading={isSyncingAll}>
            <RefreshCw size={14} aria-hidden="true" />
            Sincronizar ahora
          </Button>
        )}
      </div>

      {!setters ? (
        <p className="text-sm text-neutral-500">Cargando…</p>
      ) : setters.length === 0 ? (
        <p className="text-sm text-neutral-500">Todavía no agregaste ningún setter.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {setters.map((setter) => (
            <li key={setter.id} className="rounded-md border border-border-default bg-surface-2 p-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{setter.displayName}</span>
                <Badge variant={setter.lastSyncStatus === "ok" ? "success" : setter.lastSyncStatus === "error" ? "error" : "neutral"}>
                  {setter.spreadsheetId ? (setter.lastSyncStatus === "ok" ? "🟢 Sincronizado" : setter.lastSyncStatus === "error" ? "Error" : "Pendiente") : "Sin hoja"}
                </Badge>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSetterId(setter.id);
                      setSheetInput("");
                    }}
                    aria-label="Vincular hoja"
                    className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-3 hover:text-foreground"
                  >
                    <Pencil size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveSetter(setter)}
                    aria-label="Eliminar setter"
                    className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-error-bg hover:text-error-strong"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {setter.spreadsheetId && editingSetterId !== setter.id && (
                <div className="mt-1 flex flex-col gap-0.5 text-xs text-neutral-500">
                  <span>Hoja: {setter.sheetName ?? "—"}</span>
                  {setter.lastSyncedAt && <span>Última sync: {new Date(setter.lastSyncedAt).toLocaleString("es")}</span>}
                  {setter.lastSyncStatus === "error" && <span className="text-error-strong">{setter.lastSyncError}</span>}
                  <button type="button" onClick={() => handleUnlinkSheet(setter)} className="w-fit text-error-strong hover:underline">
                    Desconectar hoja
                  </button>
                </div>
              )}

              {editingSetterId === setter.id && (
                <div className="mt-2 flex flex-col gap-2">
                  <Input
                    label="Link o ID de la hoja"
                    value={sheetInput}
                    onChange={(e) => setSheetInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSaveSheet(setter.id)} loading={isPending}>
                      Guardar
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditingSetterId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="flex items-end gap-2">
          <Input label="Nuevo setter" value={newSetterName} onChange={(e) => setNewSetterName(e.target.value)} placeholder="Nombre del setter" containerClassName="flex-1" />
          <Button size="sm" variant="secondary" onClick={handleCreateSetter} loading={isPending}>
            <Plus size={15} aria-hidden="true" />
            Agregar
          </Button>
        </div>
      )}
    </div>
  );
}
