import type { Metadata } from "next";
import { ImportWizardShell } from "./ImportWizardShell";

export const metadata: Metadata = {
  title: "Importar cartera — Growth Link",
};

// Paso 1 (parse) and Paso 4 (analyze) do real per-row work at up to 10,000
// rows — ~7-9s each measured locally — close enough to Vercel's default
// Serverless Function timeout that a slower cold start or a heavier
// real-world file could tip over. Applies to every Server Action invoked
// from this route (actions.ts itself can't export route segment config —
// only async functions are allowed in a "use server" file). Same reasoning
// as the cron routes' maxDuration (src/app/api/cron/*).
export const maxDuration = 60;

/** Dedicated full-screen route rather than a Sheet/ConfirmDialog — Paso 4/5
 * need real room for potentially large validation/duplicate tables, and this
 * is a deliberate, rare, foreground flow that benefits from its own route
 * (clean back-button behavior) rather than a modal stacked over the board.
 * All state/orchestration lives client-side in ImportWizardShell; every
 * server round trip goes through src/lib/advisors/import/actions.ts, which
 * enforces its own workspace/role checks — no server-side data is needed
 * here to render the shell itself. */
export default function ImportCarteraPage() {
  return (
    <div className="flex min-h-full flex-col">
      <ImportWizardShell />
    </div>
  );
}
