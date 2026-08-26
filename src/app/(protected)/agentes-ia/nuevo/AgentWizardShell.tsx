"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ArrowLeft, ArrowRight, Rocket } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { AiToolOption } from "@/lib/ai-agents/queries";
import { createAgentFromWizard } from "@/lib/ai-agents/actions";
import {
  buildDefaultWizardState,
  buildInitialPrompt,
  stepsForModule,
  DEFAULT_TOOL_KEYS,
  TOOL_GROUPS,
  SYSTEM_RULES,
  type WizardState,
  type WizardStep,
} from "./wizardConfig";
import { WizardStepIndicator } from "./WizardStepIndicator";
import { WizardSummaryPanel } from "./WizardSummaryPanel";
import { StepIdentity, stepIdentityIsValid } from "./steps/StepIdentity";
import { StepObjective } from "./steps/StepObjective";
import { StepBrain } from "./steps/StepBrain";
import { StepActions } from "./steps/StepActions";
import { StepRules } from "./steps/StepRules";
import { StepSource } from "./steps/StepSource";
import { StepAnalysis } from "./steps/StepAnalysis";
import { StepSummary } from "./steps/StepSummary";

export function AgentWizardShell({ workspaceName, tools, referralCount }: { workspaceName: string; tools: AiToolOption[]; referralCount: number }) {
  const router = useRouter();

  function defaultToolIdsFor(agentType: WizardState["agentType"], moduleKey: WizardState["moduleKey"]) {
    const keyToId = new Map(tools.map((t) => [t.key, t.id]));
    const availableInModule = new Set(TOOL_GROUPS[moduleKey].flatMap((g) => g.toolKeys));
    return DEFAULT_TOOL_KEYS[agentType]
      .filter((k) => availableInModule.has(k))
      .map((k) => keyToId.get(k))
      .filter((id): id is string => Boolean(id));
  }

  const [state, setState] = useState<WizardState>(() => ({
    ...buildDefaultWizardState(),
    toolIds: defaultToolIdsFor("referrals", "referrals"),
  }));
  const [stepIndex, setStepIndex] = useState(0);
  const [isCreating, startCreate] = useTransition();
  const steps = stepsForModule(state.moduleKey);
  const step: WizardStep = steps[Math.min(stepIndex, steps.length - 1)];

  function update(patch: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...patch }));
  }

  /** "Tipo" y "módulo" (StepIdentity) se editan juntos porque cambiar
   * cualquiera de los dos invalida el preset de tools/objetivos/prompt ya
   * elegido — mismo criterio que ya existía para módulo solo, extendido a
   * tipo. "Agente de Referidos" siempre fuerza moduleKey='referrals' (sin
   * selector, igual que siempre). */
  function handleIdentityChange(patch: Partial<WizardState>) {
    const nextAgentType = patch.agentType ?? state.agentType;
    const nextModuleKey = nextAgentType === "referrals" ? "referrals" : (patch.moduleKey ?? state.moduleKey);
    const identityChanged = nextAgentType !== state.agentType || nextModuleKey !== state.moduleKey;
    if (identityChanged) {
      update({
        ...patch,
        agentType: nextAgentType,
        moduleKey: nextModuleKey,
        toolIds: defaultToolIdsFor(nextAgentType, nextModuleKey),
        objectives: [],
        systemPrompt: "",
        promptTouched: false,
      });
      return;
    }
    update(patch);
  }

  const canContinue = step !== "identidad" || stepIdentityIsValid(state);

  function goNext() {
    if (!canContinue) {
      toast.error("Completá el nombre del agente para continuar.");
      return;
    }
    const nextIndex = Math.min(stepIndex + 1, steps.length - 1);
    if (steps[nextIndex] === "cerebro" && !state.promptTouched) {
      update({ systemPrompt: buildInitialPrompt(state) });
    }
    setStepIndex(nextIndex);
  }
  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function handleCreate() {
    startCreate(async () => {
      try {
        const rules = [...SYSTEM_RULES[state.moduleKey], ...state.customRules];
        const { id } = await createAgentFromWizard({
          name: state.name.trim(),
          description: state.description.trim(),
          moduleKey: state.moduleKey,
          agentType: state.agentType,
          personality: state.personality,
          rules,
          toolIds: state.toolIds,
          systemPrompt: state.systemPrompt,
        });
        toast.success("Agente creado.");
        router.push(`/agentes-ia/${id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo crear el agente.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <div>
        <div className="flex items-center gap-1 text-sm text-neutral-500">
          <Link href="/agentes-ia" className="hover:text-foreground">
            Agentes IA
          </Link>
          <ChevronRight size={14} aria-hidden="true" />
          <span className="text-foreground">Nuevo agente</span>
        </div>
        <h1 className="mt-2 text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Crear nuevo agente IA</h1>
        <p className="text-sm text-neutral-500">Configurá un agente inteligente para automatizar conversaciones de WhatsApp.</p>
      </div>

      <WizardStepIndicator steps={steps} currentIndex={stepIndex} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="lg:col-span-3">
          {step === "identidad" && <StepIdentity state={state} update={handleIdentityChange} workspaceName={workspaceName} />}
          {step === "objetivo" && <StepObjective state={state} update={update} />}
          {step === "cerebro" && <StepBrain state={state} update={update} />}
          {step === "acciones" && <StepActions state={state} update={update} tools={tools} />}
          {step === "reglas" && <StepRules state={state} update={update} />}
          {step === "fuente" && <StepSource referralCount={referralCount} />}
          {step === "analisis" && <StepAnalysis state={state} update={update} />}
          {step === "resumen" && <StepSummary state={state} tools={tools} />}
        </div>
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-4">
            <WizardSummaryPanel state={state} tools={tools} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border-default pt-4">
        <Button variant="ghost" onClick={() => router.push("/agentes-ia")}>
          Cancelar
        </Button>
        <div className="flex gap-2">
          {stepIndex > 0 && (
            <Button variant="secondary" onClick={goBack}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Atrás
            </Button>
          )}
          {step === "resumen" ? (
            <Button onClick={handleCreate} loading={isCreating}>
              <Rocket className="size-4" aria-hidden="true" />
              Crear agente
            </Button>
          ) : (
            <Button onClick={goNext}>
              Continuar
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
