"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "@/components/toast/toast";
import { getWorkspaceMembersAction } from "@/lib/inbox/actions";
import { getClientsListAction } from "@/lib/clients/actions";
import { getAdvisorSetterAssignmentsAction, setAdvisorAssignmentsForSetterAction } from "@/lib/appointmentSync/actions";

interface Option {
  id: string;
  name: string;
}

/** Roster "qué setter trabaja para qué asesor" — pedido explícito del
 * usuario ("un setter puede trabajar para uno o varios asesores"), usado
 * por el sync para validar que la fila de la hoja no mezcle un setter con
 * un asesor que no le corresponde (ver appointmentSync/runner.ts). Solo
 * visible/editable para platform admin, mismo criterio que el resto de
 * configuración cross-tenant de Asesores. */
export function AdvisorSetterAssignmentsManager({ canManage }: { canManage: boolean }) {
  const [setters, setSetters] = useState<Option[] | null>(null);
  const [advisors, setAdvisors] = useState<Option[] | null>(null);
  const [assignments, setAssignments] = useState<Map<string, Set<string>>>(new Map());
  const [openSetterId, setOpenSetterId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    Promise.all([getWorkspaceMembersAction(), getClientsListAction(), getAdvisorSetterAssignmentsAction()]).then(([members, clients, rows]) => {
      setSetters(members.map((m) => ({ id: m.memberId, name: m.fullName })));
      setAdvisors(clients.map((c) => ({ id: c.id, name: c.contactName })));
      const map = new Map<string, Set<string>>();
      for (const r of rows) {
        const set = map.get(r.setterId) ?? new Set<string>();
        set.add(r.clientId);
        map.set(r.setterId, set);
      }
      setAssignments(map);
    });
  }, []);

  function toggleAdvisor(setterId: string, clientId: string) {
    const current = new Set(assignments.get(setterId) ?? []);
    if (current.has(clientId)) current.delete(clientId);
    else current.add(clientId);
    const next = new Map(assignments);
    next.set(setterId, current);
    setAssignments(next);
    startTransition(async () => {
      try {
        await setAdvisorAssignmentsForSetterAction(setterId, [...current]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar la asignación.");
      }
    });
  }

  if (!canManage) return null;
  if (!setters || !advisors) return <p className="text-[13px] text-neutral-500">Cargando…</p>;

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-border-default pt-4">
      <p className="text-[13px] font-medium text-foreground">Setters ↔ Asesores</p>
      <p className="text-[12px] text-neutral-500">Para qué asesores trabaja cada setter — el sync de agenda valida que cada fila los cruce correctamente.</p>
      <ul className="flex flex-col gap-1.5">
        {setters.map((setter) => {
          const assigned = assignments.get(setter.id) ?? new Set<string>();
          const isOpen = openSetterId === setter.id;
          return (
            <li key={setter.id} className="rounded-md bg-surface-2">
              <button
                type="button"
                onClick={() => setOpenSetterId(isOpen ? null : setter.id)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
              >
                <span className="text-[13px] font-medium text-foreground">{setter.name}</span>
                <span className="flex items-center gap-2 text-[12px] text-neutral-500">
                  {assigned.size} asesor{assigned.size === 1 ? "" : "es"}
                  <ChevronDown size={14} className={isOpen ? "rotate-180" : ""} aria-hidden="true" />
                </span>
              </button>
              {isOpen && (
                <div className="flex flex-col gap-1 border-t border-border-default px-3 py-2">
                  {advisors.map((advisor) => (
                    <label key={advisor.id} className="flex items-center gap-2 text-[13px] text-foreground">
                      <input type="checkbox" checked={assigned.has(advisor.id)} onChange={() => toggleAdvisor(setter.id, advisor.id)} className="accent-accent-500" />
                      {advisor.name}
                    </label>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
