"use client";

import { useEffect, useState } from "react";
import { Search, User } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/toast/toast";
import { searchContactsForMergeAction, mergeContactsAction } from "@/lib/inbox/actions";
import { INBOX_PRIMARY } from "./inboxColors";

interface Candidate {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

/** Fusiona el contacto actual DENTRO del elegido acá — mismo sentido que el
 * verbo humano "fusionar a X con Y": todo (conversaciones, oportunidades,
 * reuniones, tareas, etiquetas) se reasigna al elegido, el actual se borra.
 * merge_contacts() (0087_merge_contacts.sql) corre atómicamente. */
export function MergeContactDialog({
  open,
  contactId,
  contactName,
  onClose,
  onMerged,
}: {
  open: boolean;
  contactId: string;
  contactName: string;
  onClose: () => void;
  onMerged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    if (!open) {
      Promise.resolve().then(() => {
        setQuery("");
        setCandidates([]);
        setSelected(null);
      });
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      Promise.resolve().then(() => setCandidates([]));
      return;
    }
    const timeout = setTimeout(() => {
      searchContactsForMergeAction(contactId, query).then(setCandidates);
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, contactId]);

  function handleConfirm() {
    if (!selected) return;
    setMerging(true);
    mergeContactsAction(contactId, selected.id)
      .then(() => {
        toast.success(`${contactName} se fusionó con ${selected.name}.`);
        onMerged();
        onClose();
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudo fusionar los contactos."))
      .finally(() => setMerging(false));
  }

  return (
    <ConfirmDialog
      open={open}
      title="Fusionar contacto"
      description={
        <>
          Todo el historial de <strong className="text-foreground">{contactName}</strong> (conversaciones, oportunidades, reuniones,
          tareas y etiquetas) se va a mover al contacto que elijas abajo, y <strong className="text-foreground">{contactName}</strong> se
          va a eliminar. Esta acción no se puede deshacer.
        </>
      }
      confirmLabel="Fusionar"
      isLoading={merging}
      onConfirm={handleConfirm}
      onCancel={onClose}
    >
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
            }}
            placeholder="Buscar por nombre, teléfono o email…"
            className="w-full rounded-full border border-border-strong bg-surface-2 py-2 pl-8 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-surface-1"
          />
        </div>
        {candidates.length > 0 && !selected && (
          <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-border-default p-1">
            {candidates.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelected(c)}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                >
                  <User size={14} className="shrink-0 text-neutral-400" />
                  <span className="min-w-0 flex-1 truncate text-foreground">{c.name}</span>
                  <span className="shrink-0 text-xs text-neutral-500">{c.phone ?? c.email ?? ""}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {selected && (
          <div className={`flex items-center justify-between rounded-md ${INBOX_PRIMARY.tint} px-3 py-2`}>
            <span className={`text-sm font-medium ${INBOX_PRIMARY.tintText}`}>{selected.name}</span>
            <button type="button" onClick={() => setSelected(null)} className="text-xs text-neutral-500 hover:underline">
              Cambiar
            </button>
          </div>
        )}
      </div>
    </ConfirmDialog>
  );
}
