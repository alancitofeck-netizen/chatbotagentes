"use client";

import { useActionState } from "react";
import { saveSheetLinkAction, type SheetLinkState } from "./actions";

const INITIAL: SheetLinkState = { ok: false, error: null };

/** Pegar el link de la hoja de ManyChat. Lo guarda el workspace, no el navegador. */
export function SheetLinkForm({ currentUrl }: { currentUrl: string | null }) {
  const [state, action, pending] = useActionState(saveSheetLinkAction, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-foreground">Link de la hoja de ManyChat</span>
        <input
          name="sheetUrl"
          type="url"
          required
          defaultValue={currentUrl ?? ""}
          placeholder="https://docs.google.com/spreadsheets/d/…"
          className="h-11 rounded-md border border-border-default bg-surface-1 px-3 text-sm text-foreground outline-none focus:border-accent-500"
        />
      </label>
      <p className="text-[12px] text-neutral-500">
        La hoja tiene que estar compartida como &quot;Cualquier persona con el enlace puede ver&quot;.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-md bg-accent-600 px-4 text-sm font-medium text-[var(--on-accent)] hover:bg-accent-700 disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar hoja"}
        </button>
        {state.error && <p className="text-sm text-error-strong">{state.error}</p>}
        {state.ok && !state.error && <p className="text-sm text-success-strong">Hoja guardada.</p>}
      </div>
    </form>
  );
}
