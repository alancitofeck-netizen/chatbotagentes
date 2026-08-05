"use client";

import { ADVISORY_BRANCHES, BRANCH_QUESTIONS } from "@/lib/advisorySessions/constants";
import { DynamicQuestionForm } from "../DynamicQuestionForm";

export function BranchStep({
  branchKey,
  answers,
  onBranchChange,
  onAnswersChange,
}: {
  branchKey: string | null;
  answers: Record<string, unknown>;
  onBranchChange: (key: string) => void;
  onAnswersChange: (next: Record<string, unknown>) => void;
}) {
  const questions = branchKey ? (BRANCH_QUESTIONS[branchKey] ?? []) : [];

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold text-foreground">Seleccionar ramo</h2>
      <p className="mb-4 text-sm text-neutral-500">Elegí el producto de interés — las preguntas cambian según el ramo.</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ADVISORY_BRANCHES.map((branch) => {
          const Icon = branch.icon;
          const selected = branchKey === branch.key;
          return (
            <button
              key={branch.key}
              type="button"
              onClick={() => onBranchChange(branch.key)}
              className={`flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all duration-150 ease-out ${
                selected ? "border-accent-500 bg-accent-50 shadow-[var(--elevation-sm)]" : "border-border-default hover:border-accent-300 hover:bg-surface-2"
              }`}
            >
              <span className={`flex size-9 items-center justify-center rounded-full ${selected ? "bg-accent-100 text-accent-700" : "bg-surface-2 text-neutral-500"}`}>
                <Icon className="size-[18px]" aria-hidden="true" />
              </span>
              <span className={`text-sm font-medium ${selected ? "text-accent-700" : "text-foreground"}`}>{branch.label}</span>
              <span className="text-xs text-neutral-500">{branch.description}</span>
            </button>
          );
        })}
      </div>

      {branchKey && questions.length > 0 && (
        <div className="mt-6 flex flex-col gap-1 border-t border-border-default pt-6">
          <h3 className="mb-3 text-sm font-medium text-foreground">Preguntas específicas — {ADVISORY_BRANCHES.find((b) => b.key === branchKey)?.label}</h3>
          <DynamicQuestionForm fields={questions} data={answers} onChange={onAnswersChange} />
        </div>
      )}
    </div>
  );
}
