"use client";

import { useEffect, useState, useTransition } from "react";
import { Laptop, LogOut, ShieldCheck, ShieldAlert, X } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import type { MySession } from "@/lib/profile/queries";
import { signOutOtherSessions, enrollMfaFactor, verifyMfaEnrollment, unenrollMfaFactor, listMfaFactorsAction } from "@/lib/profile/actions";
import { ChangePasswordCard } from "./ChangePasswordCard";

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Short device/browser label from the raw user_agent — simple keyword
 * matching, not a full UA-parsing library (not worth a new dependency for a
 * one-line hint). */
function deviceLabelFor(userAgent: string | null): string {
  if (!userAgent) return "Dispositivo desconocido";
  const ua = userAgent.toLowerCase();
  const os = ua.includes("windows") ? "Windows" : ua.includes("mac") ? "macOS" : ua.includes("android") ? "Android" : ua.includes("iphone") || ua.includes("ipad") ? "iOS" : ua.includes("linux") ? "Linux" : "Dispositivo";
  const browser = ua.includes("edg/") ? "Edge" : ua.includes("chrome/") ? "Chrome" : ua.includes("firefox/") ? "Firefox" : ua.includes("safari/") ? "Safari" : "navegador";
  return `${browser} en ${os}`;
}

/** Decodes the `session_id` claim from the current access token (base64url
 * JSON, no signature verification needed client-side — this is only used to
 * highlight "este dispositivo" in the list, not for any authorization
 * decision) so the current session can be identified for real instead of
 * guessed by comparing user_agent strings. */
function decodeSessionId(accessToken: string): string | null {
  try {
    const payload = accessToken.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as { session_id?: string };
    return claims.session_id ?? null;
  } catch {
    return null;
  }
}

/** Enrollment real de TOTP vía Supabase Auth (2 pasos: escanear → verificar)
 * — sin "códigos de recuperación" falsos: Supabase MFA no tiene ese
 * concepto, así que en vez de simularlo se deja una nota real de contacto.
 * `qrCode` es el SVG que devuelve Supabase (`data.totp.qr_code`), se
 * renderiza tal cual — mismo patrón que la documentación oficial de
 * Supabase para este flujo. */
function MfaEnrollDialog({ onClose, onEnrolled }: { onClose: () => void; onEnrolled: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    enrollMfaFactor()
      .then((res) => {
        if (cancelled) return;
        setFactorId(res.factorId);
        setQrCode(res.qrCode);
        setSecret(res.secret);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo iniciar la activación.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleVerify() {
    if (!factorId) return;
    setLoading(true);
    setError(null);
    try {
      await verifyMfaEnrollment(factorId, code);
      toast.success("Verificación en dos pasos activada.");
      onEnrolled();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código incorrecto.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-neutral-950/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Activar verificación en dos pasos"
        className="relative flex w-full max-w-sm flex-col gap-4 rounded-lg bg-surface-1 p-5 shadow-[var(--elevation-lg)]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-foreground">{step === 1 ? "Escaneá el código" : "Ingresá el código"}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-neutral-400 hover:bg-surface-2" aria-label="Cerrar">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {step === 1 && (
          <>
            <p className="text-sm text-neutral-500">Abrí tu app de autenticación (Google Authenticator, 1Password, etc.) y escaneá este código.</p>
            {qrCode ? (
              <div className="mx-auto size-44 rounded-lg bg-white p-3" dangerouslySetInnerHTML={{ __html: qrCode }} />
            ) : (
              <div className="mx-auto flex size-44 items-center justify-center text-sm text-neutral-400">
                {error ?? "Generando…"}
              </div>
            )}
            {secret && (
              <p className="text-center text-xs text-neutral-500">
                ¿No podés escanear? Ingresá esta clave: <span className="font-mono text-foreground">{secret}</span>
              </p>
            )}
            <p className="text-center text-xs text-neutral-400">Si perdés el dispositivo, escribinos para desactivarla.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="button" disabled={!factorId} onClick={() => setStep(2)}>
                Siguiente
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-sm text-neutral-500">Escribí los 6 números que muestra la app.</p>
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                setError(null);
              }}
              inputMode="numeric"
              maxLength={6}
              autoFocus
              className="w-full rounded-md border border-border-strong bg-surface-1 px-3 py-2 text-center text-lg tracking-[0.4em] outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
            />
            {error && <p className="text-center text-xs text-error">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep(1)} disabled={loading}>
                Atrás
              </Button>
              <Button type="button" onClick={handleVerify} loading={loading} disabled={code.length !== 6}>
                Verificar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function SecuritySection({
  sessions,
  onSessionsChanged,
}: {
  sessions: MySession[];
  onSessionsChanged: () => void;
}) {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaLoaded, setMfaLoaded] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);

  function refreshMfaFactors() {
    listMfaFactorsAction().then((factors) => {
      setMfaFactorId(factors.find((f) => f.status === "verified")?.id ?? null);
      setMfaLoaded(true);
    });
  }

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) setCurrentSessionId(decodeSessionId(data.session.access_token));
    });
    refreshMfaFactors();
  }, []);

  function handleSignOutOthers() {
    if (!window.confirm("¿Cerrar sesión en todos los demás dispositivos?")) return;
    startTransition(async () => {
      try {
        await signOutOtherSessions();
        onSessionsChanged();
        toast.success("Se cerraron las otras sesiones.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudieron cerrar las otras sesiones.");
      }
    });
  }

  async function handleUnenroll() {
    if (!mfaFactorId) return;
    if (!window.confirm("¿Desactivar la verificación en dos pasos? Tu cuenta va a quedar protegida solo con la contraseña.")) return;
    setUnenrolling(true);
    try {
      await unenrollMfaFactor(mfaFactorId);
      toast.success("Verificación en dos pasos desactivada.");
      refreshMfaFactors();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo desactivar.");
    } finally {
      setUnenrolling(false);
    }
  }

  const hasMfa = Boolean(mfaFactorId);
  const hasSinglePassword = true; // siempre hay contraseña — Supabase exige una para signInWithPassword
  const noOtherSessions = sessions.length <= 1;
  const levelPoints = 25 + (hasSinglePassword ? 15 : 0) + (hasMfa ? 45 : 0) + (noOtherSessions ? 15 : 0);
  const level = levelPoints >= 85 ? { label: "Nivel alto", color: "bg-success" } : levelPoints >= 50 ? { label: "Nivel medio", color: "bg-accent-500" } : { label: "Nivel básico", color: "bg-warning" };
  const levelTip = !hasMfa ? "Activá la verificación en dos pasos." : !noOtherSessions ? "Revisá las sesiones que no reconocés." : "Tu cuenta está bien protegida.";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center gap-4">
          <div className="min-w-[150px]">
            <p className="text-[15px] font-semibold text-foreground">{level.label}</p>
            <p className="text-[13px] text-neutral-500">{levelTip}</p>
          </div>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
            <div className={cn("h-full rounded-full transition-all duration-500", level.color)} style={{ width: `${levelPoints}%` }} />
          </div>
        </div>
      </Card>

      <ChangePasswordCard />

      <Card>
        <CardHeader
          title="Verificación en dos pasos (2FA)"
          action={mfaLoaded && (hasMfa ? <Badge variant="success">Activada</Badge> : <Badge variant="neutral">Desactivada</Badge>)}
        />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={cn("flex size-9 items-center justify-center rounded-full", hasMfa ? "bg-success-bg text-success-strong" : "bg-surface-3 text-neutral-500")}>
              {hasMfa ? <ShieldCheck className="size-[18px]" aria-hidden="true" /> : <ShieldAlert className="size-[18px]" aria-hidden="true" />}
            </span>
            <p className="text-sm text-neutral-500">
              {hasMfa ? "Te pedimos un código cada vez que iniciás sesión en un dispositivo nuevo." : "Capa extra de seguridad al iniciar sesión, con una app de autenticación."}
            </p>
          </div>
          {hasMfa ? (
            <Button variant="destructive" size="sm" onClick={handleUnenroll} loading={unenrolling}>
              Desactivar
            </Button>
          ) : (
            <Button size="sm" onClick={() => setEnrollOpen(true)} disabled={!mfaLoaded}>
              Activar
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Sesiones activas"
          action={
            sessions.length > 1 && (
              <Button size="sm" variant="destructive" onClick={handleSignOutOthers} loading={isPending}>
                <LogOut size={14} aria-hidden="true" />
                Cerrar sesión en otros dispositivos
              </Button>
            )
          }
        />
        <ul className="flex flex-col divide-y divide-border-default">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2.5">
              <Laptop className="size-4 shrink-0 text-neutral-400" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm text-foreground">
                  {deviceLabelFor(s.userAgent)}
                  {s.id === currentSessionId && <Badge variant="success">Este dispositivo</Badge>}
                </p>
                <p className="truncate text-[12px] text-neutral-500">
                  {s.ip ?? "IP desconocida"} · última actividad {formatDateTime(s.updatedAt ?? s.createdAt)}
                </p>
              </div>
            </li>
          ))}
          {sessions.length === 0 && <p className="py-2 text-sm text-neutral-500">Sin sesiones registradas.</p>}
        </ul>
      </Card>

      {enrollOpen && (
        <MfaEnrollDialog
          onClose={() => setEnrollOpen(false)}
          onEnrolled={() => {
            setEnrollOpen(false);
            refreshMfaFactors();
          }}
        />
      )}
    </div>
  );
}
