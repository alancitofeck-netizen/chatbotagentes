"use client";

import { useEffect, useState, useTransition } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Check,
  MessageCircle,
  Camera,
  Music2,
  Globe,
  Users,
  AppWindow,
  PenLine,
  Upload,
  Tag as TagIcon,
} from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { toast } from "@/components/toast/toast";
import { tagBadgeVariant } from "@/app/(protected)/inbox/tagColor";
import { toggleContactTag } from "@/lib/inbox/actions";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import type { OpportunityCard, OpportunityTag, PipelineStage } from "@/lib/crm/queries";
import { createOpportunity, updateOpportunity, findContactConversationByPhoneAction } from "@/lib/crm/actions";
import { getMiniAppsListAction } from "@/lib/miniApps/actions";
import { formatCurrency } from "@/lib/utils/format";

const CURRENCIES = ["USD", "ARS", "EUR", "MXN"];

type SourceKey = "whatsapp" | "instagram" | "tiktok" | "web" | "referido" | "mini_app" | "manual" | "importado" | "otro";

const SOURCE_OPTIONS: { key: SourceKey; label: string; icon: LucideIcon }[] = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "instagram", label: "Instagram", icon: Camera },
  { key: "tiktok", label: "TikTok", icon: Music2 },
  { key: "web", label: "Web", icon: Globe },
  { key: "referido", label: "Referido", icon: Users },
  { key: "mini_app", label: "Mini App", icon: AppWindow },
  { key: "manual", label: "Manual", icon: PenLine },
  { key: "importado", label: "Importado", icon: Upload },
  { key: "otro", label: "Otro", icon: TagIcon },
];
const SOURCE_KEYS = SOURCE_OPTIONS.map((o) => o.key) as string[];
const SOURCE_LABEL: Record<SourceKey, string> = Object.fromEntries(SOURCE_OPTIONS.map((o) => [o.key, o.label])) as Record<SourceKey, string>;

/** Un `source` libre (texto histórico tipo "LinkedIn", o vacío en un lead
 * nuevo) que no matchea ninguno de los 9 valores fijos cae en "Otro" con
 * ese texto ya cargado en el campo libre — ida y vuelta sin pérdida para
 * leads creados antes de este wizard. */
function resolveInitialSource(source: string | null): { key: SourceKey; otherText: string } {
  if (source && SOURCE_KEYS.includes(source)) return { key: source as SourceKey, otherText: "" };
  return { key: "otro", otherText: source ?? "" };
}

function textField(v: Record<string, unknown> | undefined, key: string): string {
  const val = v?.[key];
  return typeof val === "string" ? val : "";
}

function cleanBlock(obj: Record<string, string>): Record<string, string> | undefined {
  const entries = Object.entries(obj).filter(([, v]) => v.trim());
  return entries.length ? Object.fromEntries(entries) : undefined;
}

interface MiniAppOption {
  id: string;
  name: string;
}

const STEP_LABELS = ["Contacto", "Oportunidad", "Asignación"];

export function LeadWizardSheet({
  card,
  stages,
  defaultStageId,
  members,
  tags,
  onClose,
  onSaved,
  onViewLead,
}: {
  card: OpportunityCard | null;
  stages: PipelineStage[];
  defaultStageId: string | null;
  members: WorkspaceMemberOption[];
  tags: OpportunityTag[];
  onClose: () => void;
  /** Se llama tras crear o guardar cambios (siempre) — refresca el board,
   * mismo patrón que el LeadFormSheet anterior. */
  onSaved: () => void;
  /** Solo se usa desde la pantalla de éxito de "Crear lead" — abre el
   * drawer de detalle del lead recién creado. */
  onViewLead?: (opportunityId: string) => void;
}) {
  const isEdit = card !== null;
  const initialSource = resolveInitialSource(card?.source ?? null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [succeeded, setSucceeded] = useState<{ opportunityId: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Paso 1 — Contacto
  const [name, setName] = useState(card?.contactName ?? "");
  const [phone, setPhone] = useState(card?.phone ?? "");
  const [email, setEmail] = useState(card?.email ?? "");
  const [company, setCompany] = useState(card?.company ?? "");
  const [jobTitle, setJobTitle] = useState(card?.jobTitle ?? "");
  const [sourceKey, setSourceKey] = useState<SourceKey>(initialSource.key);
  const [otherSourceText, setOtherSourceText] = useState(initialSource.otherText);

  const sd = card?.sourceDetails ?? undefined;
  const [instagramDetails, setInstagramDetails] = useState({
    username: textField(sd?.instagram as Record<string, unknown> | undefined, "username"),
    campaign: textField(sd?.instagram as Record<string, unknown> | undefined, "campaign"),
    ad: textField(sd?.instagram as Record<string, unknown> | undefined, "ad"),
    conversationId: textField(sd?.instagram as Record<string, unknown> | undefined, "conversationId"),
  });
  const [tiktokDetails, setTiktokDetails] = useState({
    username: textField(sd?.tiktok as Record<string, unknown> | undefined, "username"),
    campaign: textField(sd?.tiktok as Record<string, unknown> | undefined, "campaign"),
    video: textField(sd?.tiktok as Record<string, unknown> | undefined, "video"),
    leadId: textField(sd?.tiktok as Record<string, unknown> | undefined, "leadId"),
  });
  const [webDetails, setWebDetails] = useState({
    landingPage: textField(sd?.web as Record<string, unknown> | undefined, "landingPage"),
    formulario: textField(sd?.web as Record<string, unknown> | undefined, "formulario"),
    utmSource: textField(sd?.web as Record<string, unknown> | undefined, "utmSource"),
    utmCampaign: textField(sd?.web as Record<string, unknown> | undefined, "utmCampaign"),
  });
  const [miniAppDetails, setMiniAppDetails] = useState({
    miniAppId: textField(sd?.miniApp as Record<string, unknown> | undefined, "miniAppId"),
    formulario: textField(sd?.miniApp as Record<string, unknown> | undefined, "formulario"),
    submissionId: textField(sd?.miniApp as Record<string, unknown> | undefined, "submissionId"),
  });
  const [referidoDetails, setReferidoDetails] = useState({
    referredBy: textField(sd?.referido as Record<string, unknown> | undefined, "referredBy"),
    relation: textField(sd?.referido as Record<string, unknown> | undefined, "relation"),
    notes: textField(sd?.referido as Record<string, unknown> | undefined, "notes"),
  });
  // `phone` guarda qué teléfono produjo este resultado, para no mostrar un
  // "Conversación encontrada" desactualizado mientras el usuario sigue
  // tipeando un número distinto (ver comparación con trimmedPhone abajo).
  const [whatsappCheck, setWhatsappCheck] = useState<{ phone: string; found: boolean; conversationId: string | null } | null>(null);
  const [miniApps, setMiniApps] = useState<MiniAppOption[]>([]);

  useEffect(() => {
    if (sourceKey !== "mini_app" || miniApps.length > 0) return;
    getMiniAppsListAction().then((list) => setMiniApps(list.map((m) => ({ id: m.id, name: m.name }))));
  }, [sourceKey, miniApps.length]);

  useEffect(() => {
    const trimmed = phone.trim();
    if (sourceKey !== "whatsapp" || !trimmed) return;
    const timer = setTimeout(() => {
      findContactConversationByPhoneAction(trimmed).then((res) => {
        setWhatsappCheck({ phone: trimmed, found: Boolean(res?.conversationId), conversationId: res?.conversationId ?? null });
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [phone, sourceKey]);

  const trimmedPhone = phone.trim();
  const whatsappResult = whatsappCheck && whatsappCheck.phone === trimmedPhone ? whatsappCheck : null;

  // Paso 2 — Oportunidad
  const [title, setTitle] = useState(card?.title ?? "");
  const [value, setValue] = useState(String(card?.value ?? ""));
  const [currency, setCurrency] = useState(card?.currency ?? "USD");
  const [priority, setPriority] = useState<"high" | "medium" | "low">(card?.priority ?? "medium");
  const [probability, setProbability] = useState(card?.probability !== null && card?.probability !== undefined ? String(card.probability) : "");
  const [expectedCloseDate, setExpectedCloseDate] = useState(card?.expectedCloseDate ?? "");
  const [stageId, setStageId] = useState(defaultStageId ?? stages[0]?.id ?? "");

  // Paso 3 — Asignación
  const [ownerId, setOwnerId] = useState(card?.ownerId ?? "");
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set(card?.tags.map((t) => t.id) ?? []));

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  function resolvedSource(): string {
    if (sourceKey === "otro") return otherSourceText.trim() || "otro";
    return sourceKey;
  }

  function buildSourceDetails(): Record<string, unknown> | null {
    const base: Record<string, unknown> = { ...(card?.sourceDetails ?? {}) };
    const set = (key: string, cleaned: Record<string, string> | undefined) => {
      if (cleaned) base[key] = cleaned;
      else delete base[key];
    };
    if (sourceKey === "instagram") set("instagram", cleanBlock(instagramDetails));
    if (sourceKey === "tiktok") set("tiktok", cleanBlock(tiktokDetails));
    if (sourceKey === "web") set("web", cleanBlock(webDetails));
    if (sourceKey === "mini_app") {
      const miniAppName = miniApps.find((m) => m.id === miniAppDetails.miniAppId)?.name ?? "";
      set("miniApp", cleanBlock({ ...miniAppDetails, miniAppName }));
    }
    if (sourceKey === "referido") set("referido", cleanBlock(referidoDetails));
    if (sourceKey === "whatsapp" && whatsappResult) {
      base.whatsapp = { conversationFound: whatsappResult.found, conversationId: whatsappResult.conversationId };
    }
    return Object.keys(base).length > 0 ? base : null;
  }

  function resetForm() {
    setStep(1);
    setSucceeded(null);
    setName("");
    setPhone("");
    setEmail("");
    setCompany("");
    setJobTitle("");
    setSourceKey("otro");
    setOtherSourceText("");
    setInstagramDetails({ username: "", campaign: "", ad: "", conversationId: "" });
    setTiktokDetails({ username: "", campaign: "", video: "", leadId: "" });
    setWebDetails({ landingPage: "", formulario: "", utmSource: "", utmCampaign: "" });
    setMiniAppDetails({ miniAppId: "", formulario: "", submissionId: "" });
    setReferidoDetails({ referredBy: "", relation: "", notes: "" });
    setWhatsappCheck(null);
    setTitle("");
    setValue("");
    setCurrency("USD");
    setPriority("medium");
    setProbability("");
    setExpectedCloseDate("");
    setStageId(defaultStageId ?? stages[0]?.id ?? "");
    setOwnerId("");
    setSelectedTagIds(new Set());
    setErrorMessage(null);
  }

  function goNext() {
    if (step === 1 && !name.trim()) {
      setErrorMessage("El nombre es obligatorio.");
      return;
    }
    if (step === 2 && !title.trim()) {
      setErrorMessage("El título de la oportunidad es obligatorio.");
      return;
    }
    setErrorMessage(null);
    setStep((s) => (s === 1 ? 2 : 3) as 1 | 2 | 3);
  }

  function goBack() {
    setErrorMessage(null);
    setStep((s) => (s === 3 ? 2 : 1) as 1 | 2 | 3);
  }

  function handleSubmit() {
    if (!title.trim()) {
      setErrorMessage("El título de la oportunidad es obligatorio.");
      return;
    }
    setErrorMessage(null);
    const input = {
      name,
      phone,
      email,
      company,
      jobTitle,
      source: resolvedSource(),
      sourceDetails: buildSourceDetails(),
      title,
      value: Number(value) || 0,
      currency,
      priority,
      probability: probability.trim() ? Number(probability) : null,
      expectedCloseDate: expectedCloseDate.trim() || null,
      ownerId: ownerId || null,
    };

    startTransition(async () => {
      try {
        let contactId: string;
        let opportunityId: string;
        if (isEdit && card) {
          await updateOpportunity(card.id, card.contactId, input);
          contactId = card.contactId;
          opportunityId = card.id;
        } else {
          const created = await createOpportunity(input, stageId || undefined);
          contactId = created.contactId;
          opportunityId = created.id;
        }

        const previousTagIds = new Set(card?.tags.map((t) => t.id) ?? []);
        const tagChanges: Promise<unknown>[] = [];
        for (const tagId of selectedTagIds) {
          if (!previousTagIds.has(tagId)) tagChanges.push(toggleContactTag(contactId, tagId, true));
        }
        for (const tagId of previousTagIds) {
          if (!selectedTagIds.has(tagId)) tagChanges.push(toggleContactTag(contactId, tagId, false));
        }
        await Promise.all(tagChanges);

        onSaved();
        if (isEdit) {
          toast.success("Lead actualizado.");
          onClose();
        } else {
          setSucceeded({ opportunityId });
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "No se pudo guardar el lead.");
      }
    });
  }

  const selectedStageName = stages.find((s) => s.id === stageId)?.name ?? "—";
  const selectedOwnerName = members.find((m) => m.memberId === ownerId)?.fullName ?? null;
  const selectedTags = tags.filter((t) => selectedTagIds.has(t.id));
  const SourceIcon = SOURCE_OPTIONS.find((o) => o.key === sourceKey)?.icon ?? TagIcon;

  return (
    <Sheet
      open
      onClose={onClose}
      title={isEdit ? "Editar lead" : "Nuevo lead"}
      className="max-w-[560px]"
    >
      {succeeded ? (
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-success-bg text-success-strong">
            <Check className="size-8" aria-hidden="true" />
          </span>
          <div>
            <p className="text-base font-semibold text-foreground">¡Lead creado correctamente!</p>
            <p className="mt-1 text-sm text-neutral-500">{name} fue agregado al pipeline.</p>
          </div>
          <div className="w-full rounded-lg border border-border-default bg-surface-2 p-4 text-left">
            <div className="mb-2 flex items-center gap-2">
              <Avatar name={name} size={28} />
              <div>
                <p className="text-sm font-medium text-foreground">{name}</p>
                <p className="text-xs text-neutral-500">{title}</p>
              </div>
            </div>
            <p className="text-sm text-neutral-500">
              Valor: <span className="font-mono text-foreground">{formatCurrency(Number(value) || 0, currency)}</span>
            </p>
            <p className="text-sm text-neutral-500">
              Etapa: <span className="text-foreground">{selectedStageName}</span>
            </p>
            <p className="flex items-center gap-1.5 text-sm text-neutral-500">
              Fuente: <SourceIcon className="size-3.5" aria-hidden="true" /> <span className="text-foreground">{SOURCE_LABEL[sourceKey]}</span>
            </p>
          </div>
          <div className="flex w-full flex-col gap-2">
            <Button
              fullWidth
              onClick={() => {
                const id = succeeded.opportunityId;
                onClose();
                onViewLead?.(id);
              }}
            >
              Ver lead
            </Button>
            <Button fullWidth variant="secondary" onClick={resetForm}>
              Crear otro
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5 p-5">
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
            {STEP_LABELS.map((label, i) => {
              const stepNum = i + 1;
              const isCurrent = stepNum === step;
              const isDone = stepNum < step;
              return (
                <span key={label} className="flex items-center gap-2">
                  {i > 0 && <span className="h-px w-4 bg-border-default" />}
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`flex size-4 items-center justify-center rounded-full text-[10px] ${
                        isDone ? "bg-success text-white" : isCurrent ? "bg-accent-500 text-white" : "border border-border-strong text-transparent"
                      }`}
                    >
                      {isDone ? <Check className="size-2.5" aria-hidden="true" /> : ""}
                    </span>
                    <span className={isCurrent ? "text-foreground" : ""}>{label}</span>
                  </span>
                </span>
              );
            })}
          </div>

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Información del contacto</p>
                <p className="text-xs text-neutral-500">Agregá los datos básicos del contacto.</p>
              </div>
              <Input label="Nombre completo *" value={name} onChange={(e) => setName(e.target.value)} data-tour="crm.lead-name-input" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} data-tour="crm.lead-phone-input" />
                <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Empresa" value={company} onChange={(e) => setCompany(e.target.value)} />
                <Input label="Cargo" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
              </div>

              <div className="flex flex-col gap-1.5" data-tour="crm.lead-source-input">
                <label className="text-sm font-medium text-foreground">¿De dónde llegó este lead?</label>
                <div className="grid grid-cols-3 gap-2">
                  {SOURCE_OPTIONS.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSourceKey(key)}
                      className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium ${
                        sourceKey === key ? "border-accent-500 bg-accent-50 text-accent-700" : "border-border-default text-foreground hover:border-border-strong"
                      }`}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {sourceKey === "otro" && (
                <Input
                  label="Especificá la fuente (opcional)"
                  value={otherSourceText}
                  onChange={(e) => setOtherSourceText(e.target.value)}
                  placeholder="Ej. LinkedIn, feria, publicidad offline"
                />
              )}

              {sourceKey === "whatsapp" && trimmedPhone && (
                <div className="rounded-lg border border-border-default bg-surface-2 p-3 text-xs">
                  <p className="mb-1 font-medium text-neutral-500">Conversación asociada</p>
                  {!whatsappResult && <p className="text-neutral-500">Buscando…</p>}
                  {whatsappResult?.found && (
                    <p className="flex items-center gap-1 text-success-strong">
                      <Check size={13} aria-hidden="true" /> Conversación encontrada
                    </p>
                  )}
                  {whatsappResult && !whatsappResult.found && <p className="text-neutral-500">No se encontró ninguna conversación con este número todavía.</p>}
                </div>
              )}

              {sourceKey === "instagram" && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border-default p-3">
                  <Input label="Usuario de Instagram" value={instagramDetails.username} onChange={(e) => setInstagramDetails((v) => ({ ...v, username: e.target.value }))} />
                  <Input label="Campaña" value={instagramDetails.campaign} onChange={(e) => setInstagramDetails((v) => ({ ...v, campaign: e.target.value }))} />
                  <Input label="Anuncio" value={instagramDetails.ad} onChange={(e) => setInstagramDetails((v) => ({ ...v, ad: e.target.value }))} />
                  <Input label="ID de conversación" value={instagramDetails.conversationId} onChange={(e) => setInstagramDetails((v) => ({ ...v, conversationId: e.target.value }))} />
                  <p className="col-span-2 text-xs text-neutral-400">Estos campos son opcionales y nos ayudan a entender mejor el origen del lead.</p>
                </div>
              )}

              {sourceKey === "tiktok" && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border-default p-3">
                  <Input label="Usuario de TikTok" value={tiktokDetails.username} onChange={(e) => setTiktokDetails((v) => ({ ...v, username: e.target.value }))} />
                  <Input label="Campaña" value={tiktokDetails.campaign} onChange={(e) => setTiktokDetails((v) => ({ ...v, campaign: e.target.value }))} />
                  <Input label="Video / anuncio" value={tiktokDetails.video} onChange={(e) => setTiktokDetails((v) => ({ ...v, video: e.target.value }))} />
                  <Input label="ID de lead" value={tiktokDetails.leadId} onChange={(e) => setTiktokDetails((v) => ({ ...v, leadId: e.target.value }))} />
                  <p className="col-span-2 text-xs text-neutral-400">Estos campos son opcionales y nos ayudan a entender mejor el origen del lead.</p>
                </div>
              )}

              {sourceKey === "web" && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border-default p-3">
                  <Input label="Landing Page" value={webDetails.landingPage} onChange={(e) => setWebDetails((v) => ({ ...v, landingPage: e.target.value }))} />
                  <Input label="Formulario" value={webDetails.formulario} onChange={(e) => setWebDetails((v) => ({ ...v, formulario: e.target.value }))} />
                  <Input label="UTM Source" value={webDetails.utmSource} onChange={(e) => setWebDetails((v) => ({ ...v, utmSource: e.target.value }))} />
                  <Input label="UTM Campaign" value={webDetails.utmCampaign} onChange={(e) => setWebDetails((v) => ({ ...v, utmCampaign: e.target.value }))} />
                  <p className="col-span-2 text-xs text-neutral-400">Estos campos son opcionales y nos ayudan a entender mejor el origen del lead.</p>
                </div>
              )}

              {sourceKey === "mini_app" && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border-default p-3">
                  <Select
                    label="Mini App de origen"
                    containerClassName="col-span-2"
                    value={miniAppDetails.miniAppId}
                    onChange={(e) => setMiniAppDetails((v) => ({ ...v, miniAppId: e.target.value }))}
                  >
                    <option value="">Sin especificar</option>
                    {miniApps.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                  <Input label="Formulario" value={miniAppDetails.formulario} onChange={(e) => setMiniAppDetails((v) => ({ ...v, formulario: e.target.value }))} />
                  <Input label="ID de envío" value={miniAppDetails.submissionId} onChange={(e) => setMiniAppDetails((v) => ({ ...v, submissionId: e.target.value }))} />
                  <p className="col-span-2 text-xs text-neutral-400">Estos campos son opcionales y nos ayudan a entender mejor el origen del lead.</p>
                </div>
              )}

              {sourceKey === "referido" && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border-default p-3">
                  <Input label="Referido por" value={referidoDetails.referredBy} onChange={(e) => setReferidoDetails((v) => ({ ...v, referredBy: e.target.value }))} />
                  <Select label="Relación" value={referidoDetails.relation} onChange={(e) => setReferidoDetails((v) => ({ ...v, relation: e.target.value }))}>
                    <option value="">Sin especificar</option>
                    <option value="Cliente">Cliente</option>
                    <option value="Familiar">Familiar</option>
                    <option value="Amigo">Amigo</option>
                    <option value="Colega">Colega</option>
                    <option value="Otro">Otro</option>
                  </Select>
                  <Input
                    label="Notas adicionales"
                    containerClassName="col-span-2"
                    value={referidoDetails.notes}
                    onChange={(e) => setReferidoDetails((v) => ({ ...v, notes: e.target.value }))}
                  />
                  <p className="col-span-2 text-xs text-neutral-400">Estos campos son opcionales y nos ayudan a entender mejor el origen del lead.</p>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Información de la oportunidad</p>
                <p className="text-xs text-neutral-500">Definí los detalles comerciales de esta oportunidad.</p>
              </div>
              <Input label="Título de oportunidad *" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Plan premium — Nombre del cliente" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Valor *" type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} />
                <Select label="Moneda" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Prioridad" value={priority} onChange={(e) => setPriority(e.target.value as "high" | "medium" | "low")}>
                  <option value="high">Alta</option>
                  <option value="medium">Media</option>
                  <option value="low">Baja</option>
                </Select>
                <Input
                  label="Probabilidad de cierre (%)"
                  type="number"
                  min={0}
                  max={100}
                  value={probability}
                  onChange={(e) => setProbability(e.target.value)}
                />
              </div>
              <Input label="Fecha estimada de cierre" type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} />
              {!isEdit && (
                <Select label="Etapa inicial *" value={stageId} onChange={(e) => setStageId(e.target.value)}>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Asignación y etiquetas</p>
                <p className="text-xs text-neutral-500">Asigná el lead y agregá etiquetas.</p>
              </div>
              <Select label="Agente responsable" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                <option value="">Sin asignar</option>
                {members.map((m) => (
                  <option key={m.memberId} value={m.memberId}>
                    {m.fullName}
                  </option>
                ))}
              </Select>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Etiquetas</label>
                <div className="flex flex-wrap gap-1.5">
                  {tags.length === 0 && <p className="text-xs text-neutral-500">Todavía no hay etiquetas en el workspace.</p>}
                  {tags.map((tag) => (
                    <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)} className={selectedTagIds.has(tag.id) ? "" : "opacity-40"}>
                      <Badge variant={tagBadgeVariant(tag.color)}>{tag.name}</Badge>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border-default bg-surface-2 p-3 text-sm">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">Resumen</p>
                <div className="flex flex-col gap-1.5">
                  <p className="flex items-center gap-1.5"><Avatar name={name || "?"} size={18} /> {name || "—"}</p>
                  <p className="flex items-center gap-1.5"><SourceIcon className="size-3.5 text-neutral-400" aria-hidden="true" /> {sourceKey === "otro" ? otherSourceText || "Otro" : SOURCE_LABEL[sourceKey]}</p>
                  <p>💼 {title || "—"}</p>
                  <p className="font-mono">{formatCurrency(Number(value) || 0, currency)}</p>
                  <p>📊 Etapa: {isEdit ? (stages.find((s) => s.id === card?.stageId)?.name ?? "—") : selectedStageName}</p>
                  <p>👤 Asignado a {selectedOwnerName ?? "Sin asignar"}</p>
                  {selectedTags.length > 0 && (
                    <p className="flex flex-wrap items-center gap-1">
                      🏷️ {selectedTags.map((t) => (
                        <Badge key={t.id} variant={tagBadgeVariant(t.color)}>
                          {t.name}
                        </Badge>
                      ))}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {errorMessage && <p className="text-sm text-error-strong">{errorMessage}</p>}

          <div className="flex items-center gap-2">
            {step === 1 ? (
              <Button variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
            ) : (
              <Button variant="secondary" onClick={goBack}>
                ← Atrás
              </Button>
            )}
            {step < 3 ? (
              <Button className="ml-auto" onClick={goNext} data-tour={step === 1 ? "crm.wizard-step1-continue" : "crm.wizard-step2-continue"}>
                Continuar →
              </Button>
            ) : (
              <Button className="ml-auto" onClick={handleSubmit} loading={isPending} data-tour="crm.lead-save-button">
                {isPending ? (isEdit ? "Guardando…" : "Creando…") : isEdit ? "Guardar cambios" : "Crear lead"}
              </Button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}
