"use client";

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import Image from "next/image";
import { simulateRetirement } from "@/lib/miniApps/financialEngine";
import { submitMiniAppLeadFromHostedPage } from "@/lib/miniApps/actions";
import type { PublicMiniAppView } from "@/lib/miniApps/queries";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value);
}

export function RetirementSimulatorApp({ app }: { app: PublicMiniAppView }) {
  const { branding, config } = app;

  useEffect(() => {
    fetch(`/api/public/mini-apps/${app.slug}/visit`, { method: "POST", keepalive: true }).catch(() => {});
    // Fire-and-forget — a failed visit ping must never block the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [edad, setEdad] = useState("");
  const [edadRetiro, setEdadRetiro] = useState("");
  const [ahorroMensual, setAhorroMensual] = useState("");
  const [ingresoActual, setIngresoActual] = useState("");
  const [nombre, setNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [consentimiento, setConsentimiento] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    const edadNum = Number(edad);
    const edadRetiroNum = Number(edadRetiro);
    const ahorroNum = Number(ahorroMensual);
    if (!edadNum || !edadRetiroNum || !ahorroNum || edadRetiroNum <= edadNum) return null;
    return simulateRetirement({
      edad: edadNum,
      edadRetiro: edadRetiroNum,
      ahorroMensual: ahorroNum,
      annualReturnRatePct: config.annualReturnRatePct,
    });
  }, [edad, edadRetiro, ahorroMensual, config.annualReturnRatePct]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!preview) {
      setError("Completá edad, edad de retiro y ahorro mensual para ver tu estimación.");
      return;
    }
    if (!nombre.trim() || !whatsapp.trim()) {
      setError("Nombre y WhatsApp son obligatorios.");
      return;
    }
    if (!consentimiento) {
      setError("Necesitamos tu consentimiento para poder contactarte.");
      return;
    }

    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const result = await submitMiniAppLeadFromHostedPage(app.slug, {
        fecha: nowIso,
        origen_app: app.name,
        nombre,
        whatsapp,
        consentimiento: true,
        consentimiento_fecha: nowIso,
        edad: Number(edad),
        edad_retiro: Number(edadRetiro),
        ahorro_mensual: Number(ahorroMensual),
        ingreso_actual: ingresoActual ? Number(ingresoActual) : undefined,
      });
      if (!result.ok) {
        setError("No pudimos guardar tus datos. Intentá de nuevo en unos minutos.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("No pudimos guardar tus datos. Intentá de nuevo en unos minutos.");
    } finally {
      setSubmitting(false);
    }
  }

  const fieldLabels = {
    edad: config.fieldLabels.edad ?? "Tu edad actual",
    edadRetiro: config.fieldLabels.edadRetiro ?? "¿A qué edad te querés retirar?",
    ahorroMensual: config.fieldLabels.ahorroMensual ?? "¿Cuánto podés ahorrar por mes? (MXN)",
    ingresoActual: config.fieldLabels.ingresoActual ?? "Tu ingreso mensual actual (MXN, opcional)",
  };

  return (
    <div
      style={{ "--mini-app-primary": branding.primaryColor } as CSSProperties}
      className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-white px-5 py-8"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        {branding.logoUrl && (
          <Image src={branding.logoUrl} alt={app.name} width={64} height={64} className="rounded-full object-cover" unoptimized />
        )}
        <h1 className="text-xl font-semibold text-neutral-900">{app.name}</h1>
        {app.description && <p className="text-sm text-neutral-500">{app.description}</p>}
      </div>

      {submitted ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-6 text-center">
          <p className="text-base font-medium text-neutral-900">¡Gracias, {nombre.split(" ")[0]}!</p>
          <p className="mt-1 text-sm text-neutral-500">Ya recibimos tus datos — pronto te vamos a contactar por WhatsApp.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-neutral-700">
              {fieldLabels.edad}
              <input
                type="number"
                min={18}
                max={90}
                required
                value={edad}
                onChange={(e) => setEdad(e.target.value)}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[var(--mini-app-primary)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-neutral-700">
              {fieldLabels.edadRetiro}
              <input
                type="number"
                min={18}
                max={100}
                required
                value={edadRetiro}
                onChange={(e) => setEdadRetiro(e.target.value)}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[var(--mini-app-primary)]"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            {fieldLabels.ahorroMensual}
            <input
              type="number"
              min={0}
              required
              value={ahorroMensual}
              onChange={(e) => setAhorroMensual(e.target.value)}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[var(--mini-app-primary)]"
            />
          </label>

          {config.showIngresoActual && (
            <label className="flex flex-col gap-1 text-sm text-neutral-700">
              {fieldLabels.ingresoActual}
              <input
                type="number"
                min={0}
                value={ingresoActual}
                onChange={(e) => setIngresoActual(e.target.value)}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[var(--mini-app-primary)]"
              />
            </label>
          )}

          {preview && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Tu fondo estimado al retiro</p>
              <p className="mt-1 text-2xl font-semibold" style={{ color: "var(--mini-app-primary)" }}>
                {formatCurrency(preview.fondoEstimado)}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Rango estimado: {formatCurrency(preview.fondoRangoBajo)} – {formatCurrency(preview.fondoRangoAlto)}
              </p>
              <p className="mt-2 text-xs text-neutral-500">
                Renta mensual estimada en el retiro: <strong>{formatCurrency(preview.rentaMensualEstimada)}</strong>
              </p>
              <p className="mt-2 text-[11px] text-neutral-400">Estimación referencial, no es asesoría financiera certificada.</p>
            </div>
          )}

          <div className="my-1 h-px bg-neutral-200" />

          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Nombre completo
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[var(--mini-app-primary)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            WhatsApp
            <input
              type="tel"
              required
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[var(--mini-app-primary)]"
            />
          </label>
          <label className="flex items-start gap-2 text-xs text-neutral-600">
            <input type="checkbox" checked={consentimiento} onChange={(e) => setConsentimiento(e.target.checked)} className="mt-0.5" />
            Acepto ser contactado por WhatsApp con los resultados de esta simulación, conforme a la LFPDPPP.
          </label>

          {error && <p className="text-sm text-error-strong">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            style={{ backgroundColor: "var(--mini-app-primary)" }}
            className="rounded-md px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Enviando…" : "Quiero que me contacten"}
          </button>
        </form>
      )}
    </div>
  );
}
