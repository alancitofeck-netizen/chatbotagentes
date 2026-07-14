"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { History } from "lucide-react";
import type { AgentTestRun } from "@/lib/ai-agents/queries";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function HistoryTab({ initialRuns }: { initialRuns: AgentTestRun[] }) {
  if (initialRuns.length === 0) {
    return <EmptyState icon={History} title="Sin historial todavía" description="Cada prueba desde la pestaña Pruebas queda registrada acá." />;
  }

  return (
    <div className="flex flex-col gap-3">
      {initialRuns.map((run) => (
        <Card key={run.id}>
          <div className="flex items-center justify-between gap-3">
            <CardHeader title={formatDate(run.createdAt)} />
            <p className="text-xs text-neutral-400">
              {run.tokensIn + run.tokensOut} tokens · ${run.costUsd.toFixed(4)}
            </p>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <p>
              <span className="text-xs font-medium uppercase text-neutral-400">Mensaje de prueba</span>
              <br />
              {run.testMessage}
            </p>
            {run.reply && (
              <p>
                <span className="text-xs font-medium uppercase text-neutral-400">Respuesta</span>
                <br />
                {run.reply}
              </p>
            )}
            {run.error && <p className="text-error-strong">{run.error}</p>}
            {run.toolTrace.length > 0 && (
              <ul className="flex flex-col gap-0.5 border-t border-border-default pt-2">
                {run.toolTrace.map((call, i) => (
                  <li key={i} className="text-xs text-neutral-500">
                    <span className="font-mono">{call.name}</span>({JSON.stringify(call.arguments)}) → {JSON.stringify(call.result)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
