"use client";

import { useRef, useState, type FormEvent } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { toast } from "@/components/toast/toast";
import { Upload, FileSpreadsheet, ArrowRight, CheckCircle2, AlertTriangle, Loader2, Globe, KeyRound, Sparkles } from "lucide-react";
import { POLICY_FIELD_DICTIONARY } from "@/lib/policies/constants";
import { parsePolicyImportFileAction, parsePolicyImportSheetAction, type PolicyImportPreview } from "@/lib/policies/actions";
import { confirmInsuranceManualSyncAction, type InsuranceManualSyncResult } from "@/lib/insuranceProviders/actions";
import { savePortalCredentialsAction, startPortalSyncAction } from "@/lib/portfolioAgent/actions";
import { SYNC_PROGRESS_MESSAGES, CONNECTION_METHODS, CONNECTION_METHOD_LABEL, type ConnectionMethod } from "@/lib/insuranceProviders/constants";
import type { InsuranceProviderCard } from "@/lib/insuranceProviders/queries";

type Step = "upload" | "sheet-select" | "mapping" | "importing" | "results";

const METHOD_ICON: Record<ConnectionMethod, typeof Globe> = { manual: Sparkles, portal: Globe, api: KeyRound };

function ComingSoonPanel({ method }: { method: "portal" | "api" }) {
  const copy =
    method === "portal"
      ? "Conexión automática por portal web — vamos a construirla en cuanto tengamos acceso confirmado con cada aseguradora. Hoy, iniciar sesión en tu nombre en un portal de terceros sin ese acuerdo no es algo que podamos ofrecer de forma segura ni confiable."
      : "Conexión por API — se habilita aseguradora por aseguradora en cuanto tengamos credenciales/documentación oficial confirmadas. Todavía no la tenemos para ninguna, así que no la mostramos como activa.";
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-strong px-6 py-10 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-neutral-400">
        {method === "portal" ? <Globe className="size-5" aria-hidden="true" /> : <KeyRound className="size-5" aria-hidden="true" />}
      </div>
      <p className="text-sm font-medium text-foreground">Próximamente</p>
      <p className="max-w-sm text-[13px] text-neutral-500">{copy}</p>
    </div>
  );
}

/** Form real de "Conectar por portal" — solo se muestra cuando
 * `insurance_providers.portal_domain` está seteado para esa aseguradora
 * (0162_portfolio_agent.sql). Guarda usuario/contraseña vía Vault
 * (savePortalCredentialsAction) y dispara la primera sincronización; el
 * progreso en vivo se ve en Analizador de Cartera, no acá (evita duplicar
 * la lógica de polling en dos lugares). */
function PortalConnectForm({ provider, onConnected }: { provider: InsuranceProviderCard; onConnected: () => void }) {
  const [portalUrl, setPortalUrl] = useState(provider.portalDomain ? `https://${provider.portalDomain}` : "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [started, setStarted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsBusy(true);
    try {
      const saved = await savePortalCredentialsAction(provider.id, portalUrl, username, password);
      if (!saved.ok) {
        toast.error(saved.error);
        return;
      }
      const syncResult = await startPortalSyncAction(saved.connectionId);
      if (!syncResult.ok) {
        toast.error(syncResult.error);
        return;
      }
      setStarted(true);
      onConnected();
    } finally {
      setIsBusy(false);
    }
  }

  if (started) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="size-8 text-success-strong" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">Sincronización iniciada.</p>
        <p className="max-w-sm text-[13px] text-neutral-500">
          El progreso en vivo lo podés seguir en <span className="font-medium text-foreground">Analizador de Cartera</span>, en el sidebar.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">URL del portal</span>
        <input
          type="url"
          required
          value={portalUrl}
          onChange={(e) => setPortalUrl(e.target.value)}
          placeholder={provider.portalDomain ? `https://${provider.portalDomain}/...` : "https://..."}
          className="rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Usuario</span>
        <input
          type="text"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="off"
          className="rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Contraseña</span>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          className="rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
        />
      </label>
      <p className="text-xs text-neutral-500">Tu contraseña se guarda cifrada — nadie en Growth Link (ni la IA) puede volver a verla en texto plano.</p>
      <Button type="submit" loading={isBusy}>
        Conectar y sincronizar
      </Button>
    </form>
  );
}

export function ConnectProviderModal({
  provider,
  open,
  onClose,
  onSynced,
}: {
  provider: InsuranceProviderCard;
  open: boolean;
  onClose: () => void;
  onSynced: () => void;
}) {
  const [method, setMethod] = useState<ConnectionMethod>("manual");
  const [step, setStep] = useState<Step>("upload");
  const [isBusy, setIsBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PolicyImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [result, setResult] = useState<InsuranceManualSyncResult | null>(null);
  const [progressIndex, setProgressIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setMethod("manual");
    setStep("upload");
    setIsBusy(false);
    setFile(null);
    setPreview(null);
    setMapping({});
    setResult(null);
    setProgressIndex(0);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFileSelected(selected: File) {
    setFile(selected);
    setIsBusy(true);
    try {
      const formData = new FormData();
      formData.set("file", selected);
      const parsed = await parsePolicyImportFileAction(formData);
      if (parsed.needsSheetSelection) {
        setPreview(parsed);
        setStep("sheet-select");
      } else {
        setPreview(parsed);
        setMapping(parsed.suggestedMapping);
        setStep("mapping");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo leer el archivo.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSheetChosen(sheetName: string) {
    if (!file) return;
    setIsBusy(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const parsed = await parsePolicyImportSheetAction(formData, sheetName);
      setPreview(parsed);
      setMapping(parsed.suggestedMapping);
      setStep("mapping");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo leer la hoja elegida.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleConfirmSync() {
    if (!preview || !file) return;
    setIsBusy(true);
    setStep("importing");
    setProgressIndex(0);

    const interval = setInterval(() => {
      setProgressIndex((i) => Math.min(i + 1, SYNC_PROGRESS_MESSAGES.length - 2));
    }, 900);

    try {
      const outcome = await confirmInsuranceManualSyncAction(provider.id, preview.rows, mapping, file.name);
      clearInterval(interval);
      setProgressIndex(SYNC_PROGRESS_MESSAGES.length - 1);
      if ("error" in outcome) {
        toast.error(outcome.error);
        setStep("mapping");
        return;
      }
      setResult(outcome);
      setStep("results");
      if (outcome.created > 0) onSynced();
    } catch (err) {
      clearInterval(interval);
      toast.error(err instanceof Error ? err.message : "No se pudo sincronizar el archivo.");
      setStep("mapping");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={handleClose} title={`Conectar ${provider.name}`} className="max-w-lg">
      <div className="flex flex-col gap-4 p-5">
        <Tabs value={method} onValueChange={(v) => setMethod(v as ConnectionMethod)}>
          <TabsList>
            {CONNECTION_METHODS.map((m) => {
              const Icon = METHOD_ICON[m];
              return (
                <TabsTrigger key={m} value={m} disabled={m === "api"}>
                  <Icon className="size-3.5" aria-hidden="true" />
                  {CONNECTION_METHOD_LABEL[m]}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="portal">
            <div className="pt-4">
              {provider.portalDomain ? <PortalConnectForm provider={provider} onConnected={onSynced} /> : <ComingSoonPanel method="portal" />}
            </div>
          </TabsContent>
          <TabsContent value="api">
            <div className="pt-4">
              <ComingSoonPanel method="api" />
            </div>
          </TabsContent>

          <TabsContent value="manual">
            <div className="flex flex-col gap-4 pt-4">
              {step === "upload" && (
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-strong bg-surface-2 p-10 text-center hover:border-accent-500">
                  {isBusy ? <Loader2 className="size-8 animate-spin text-accent-500" aria-hidden="true" /> : <Upload className="size-8 text-neutral-400" aria-hidden="true" />}
                  <p className="text-sm font-medium text-foreground">{isBusy ? "Leyendo archivo…" : `Arrastrá o hacé clic para subir el export de ${provider.name}`}</p>
                  <p className="text-xs text-neutral-500">Excel o CSV — hasta 1000 pólizas por carga.</p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.csv"
                    className="hidden"
                    disabled={isBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileSelected(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}

              {step === "sheet-select" && preview && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-foreground">Este archivo tiene varias hojas — ¿cuál querés sincronizar?</p>
                  {preview.sheets.map((sheet) => (
                    <button
                      key={sheet.name}
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleSheetChosen(sheet.name)}
                      className="flex items-center justify-between rounded-md border border-border-default px-4 py-3 text-left text-sm hover:border-accent-500 hover:bg-surface-2 disabled:opacity-50"
                    >
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        <FileSpreadsheet className="size-4 text-neutral-400" aria-hidden="true" />
                        {sheet.name}
                      </span>
                      <span className="text-xs text-neutral-500">{sheet.rowCount} registro(s)</span>
                    </button>
                  ))}
                </div>
              )}

              {step === "mapping" && preview && (
                <>
                  <p className="text-xs text-neutral-500">
                    Detectamos {Object.values(mapping).filter(Boolean).length} de {preview.headers.length} columna(s) automáticamente. Corregí lo que haga falta.
                  </p>
                  <div className="flex max-h-[45vh] flex-col divide-y divide-border-default overflow-y-auto">
                    {preview.headers.map((header) => (
                      <div key={header} className="grid grid-cols-1 items-center gap-2 py-2.5 sm:grid-cols-[1fr_auto_1fr]">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{header}</p>
                          <p className="truncate text-xs text-neutral-500">{preview.rows[0]?.[header] || "—"}</p>
                        </div>
                        <ArrowRight className="hidden size-4 text-neutral-400 sm:block" aria-hidden="true" />
                        <Select label="" containerClassName="w-full" value={mapping[header] ?? ""} onChange={(e) => setMapping({ ...mapping, [header]: e.target.value || null })}>
                          <option value="">Sin mapear</option>
                          {POLICY_FIELD_DICTIONARY.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-neutral-500">{preview.totalRows} registro(s) — entran directo como pólizas activas, ligadas a esta conexión.</p>
                  <Button onClick={handleConfirmSync} loading={isBusy}>
                    Sincronizar {preview.totalRows} póliza(s)
                  </Button>
                </>
              )}

              {step === "importing" && (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <Loader2 className="size-8 animate-spin text-accent-500" aria-hidden="true" />
                  <p className="text-sm text-foreground">{SYNC_PROGRESS_MESSAGES[progressIndex]}</p>
                </div>
              )}

              {step === "results" && result && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    {result.errors.length === 0 ? (
                      <CheckCircle2 className="size-5 text-success-strong" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="size-5 text-warning-strong" aria-hidden="true" />
                    )}
                    <p className="text-sm font-medium text-foreground">{result.created} póliza(s) sincronizada(s) con {provider.name}.</p>
                  </div>
                  {result.errors.length > 0 && (
                    <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-md border border-border-default p-3 text-xs text-neutral-500">
                      {result.errors.map((e, i) => (
                        <li key={i}>
                          Fila {e.row}: {e.message}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={reset}>
                      Sincronizar otro archivo
                    </Button>
                    <Button onClick={handleClose}>Cerrar</Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Sheet>
  );
}
