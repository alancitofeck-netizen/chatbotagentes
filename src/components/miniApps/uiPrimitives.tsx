"use client";

/**
 * Brand-aware primitives shared by every Mini App template's public page —
 * deliberately local (not the shared src/components/ui/Button.tsx /
 * ProgressBar.tsx) since those hardcode GL's own --color-accent-* tokens;
 * each mini app's whole point is rendering ITS OWN generated palette
 * instead (see src/lib/miniApps/paletteEngine.ts), without touching the
 * shared components every authenticated screen still relies on.
 *
 * Originally lived only inside RetirementSimulatorApp.tsx; extracted here
 * once a second template (the "Calculadora de Brecha de Retiro") needed
 * the exact same building blocks — moved, not copied, so both templates
 * stay in sync automatically.
 */

import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode } from "react";
import Image from "next/image";
import { Loader2, type LucideIcon } from "lucide-react";
import type { PublicMiniAppView } from "@/lib/miniApps/queries";

/** `color-mix` instead of Tailwind's opacity-modifier-on-arbitrary-value —
 * the palette is only known to this page as CSS custom properties (computed
 * once server-side in page.tsx, never passed down as a JS object), so a
 * "10% of --ma-button-primary-bg" tint has to happen in CSS, not JS. */
export function soften(cssVar: string, percent: number): string {
  return `color-mix(in srgb, var(${cssVar}) ${percent}%, transparent)`;
}

/** Animated count-up for headline numbers — cubic ease-out, ~900ms,
 * disabled entirely under prefers-reduced-motion. */
export function useCountUp(target: number, active: boolean) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    if (!active) return;
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const raf = requestAnimationFrame(() => {
        setDisplay(target);
        fromRef.current = target;
      });
      return () => cancelAnimationFrame(raf);
    }
    const from = fromRef.current;
    const t0 = performance.now();
    const dur = 900;
    let raf = 0;
    function tick(t: number) {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);
  return display;
}

export function MiniAppButton({
  variant = "primary",
  loading,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost"; loading?: boolean }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none";
  const styleByVariant: CSSProperties =
    variant === "primary"
      ? { background: "var(--ma-button-primary-bg)", color: "var(--ma-button-primary-text)" }
      : variant === "secondary"
        ? { background: "transparent", color: "var(--ma-text-color)", border: "1px solid var(--ma-border-strong)" }
        : { background: "transparent", color: "var(--ma-text-muted)" };

  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`${base} ${className}`}
      style={styleByVariant}
      onMouseEnter={(e) => {
        if (variant === "primary") e.currentTarget.style.background = "var(--ma-button-primary-hover)";
      }}
      onMouseLeave={(e) => {
        if (variant === "primary") e.currentTarget.style.background = "var(--ma-button-primary-bg)";
      }}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function MiniAppProgressBar({ value, colorVar = "--ma-button-primary-bg" }: { value: number; colorVar?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--ma-background-surface-alt)" }}>
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${clamped}%`, background: `var(${colorVar})` }}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

export function DecorativeBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ background: "var(--ma-background-page)" }} aria-hidden="true">
      <div
        className="absolute inset-0 bg-[length:220%_220%] opacity-[0.10] motion-safe:animate-[gradient-pan_22s_ease_infinite]"
        style={{ backgroundImage: "var(--ma-gradient-decorative)" }}
      />
      <div className="absolute -top-24 -left-20 size-72 rounded-full blur-3xl motion-safe:animate-[float-slow_7s_ease-in-out_infinite]" style={{ background: soften("--ma-button-primary-bg", 14) }} />
      <div className="absolute top-1/3 -right-16 size-80 rounded-full blur-3xl motion-safe:animate-[float-slow_9s_ease-in-out_infinite]" style={{ background: soften("--ma-button-secondary-bg", 14) }} />
      <div className="absolute -bottom-24 left-1/4 size-72 rounded-full blur-3xl motion-safe:animate-[float-slow_8s_ease-in-out_infinite]" style={{ background: soften("--ma-chart-series-secondary", 10) }} />
    </div>
  );
}

/** "Who is this mini app from" header — `badgeLabel` names the template
 * ("Simulador", "Calculadora", ...) since that's the one piece that varies
 * per template; `licenseBadge` (e.g. "Cédula CNSF vigente") is an optional
 * 2nd line some templates configure and others don't. */
export function AgentBar({ app, badgeLabel, licenseBadge }: { app: PublicMiniAppView; badgeLabel: string; licenseBadge?: string }) {
  const { branding, config } = app;
  const agentName = config.assignedAgentName ?? "Growth Link";
  const initials = agentName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div
      className="flex items-center gap-3 rounded-2xl p-3 backdrop-blur-sm"
      style={{ background: soften("--ma-background-surface", 92), border: "1px solid var(--ma-border)", boxShadow: "var(--ma-shadow-sm)" }}
    >
      {branding.logoUrl ? (
        <Image src={branding.logoUrl} alt={agentName} width={44} height={44} className="size-11 shrink-0 rounded-xl object-cover" unoptimized />
      ) : (
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-[15px] font-semibold tracking-wide"
          style={{ background: "var(--ma-gradient-hero)", color: "var(--ma-gradient-hero-text)" }}
        >
          {initials || "GL"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold" style={{ color: "var(--ma-title-color)" }}>
          {agentName}
        </p>
        <p className="truncate text-xs" style={{ color: "var(--ma-text-muted)" }}>
          {app.description || "Asesor en protección y retiro"}
        </p>
        {licenseBadge && (
          <p className="truncate text-[10.5px]" style={{ color: "var(--ma-text-muted)" }}>
            {licenseBadge}
          </p>
        )}
      </div>
      <span
        className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold tracking-[0.08em] uppercase"
        style={{ background: "var(--ma-tag-bg)", color: "var(--ma-tag-text)" }}
      >
        {badgeLabel}
      </span>
    </div>
  );
}

export function StepShell({ icon: Icon, title, subtitle, children }: { icon: LucideIcon; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 motion-safe:animate-[fade-in-up_0.35s_ease]">
      <div className="flex items-center gap-2.5">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: "var(--ma-tag-bg)", color: "var(--ma-icon-color)" }}
        >
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-[19px] font-semibold tracking-[-0.01em]" style={{ color: "var(--ma-title-color)" }}>
            {title}
          </h2>
          {subtitle && (
            <p className="text-[13px]" style={{ color: "var(--ma-text-muted)" }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Styled text/number input with an optional "$"-style prefix — the
 * Simulador already repeats this exact inline styling twice (nombre,
 * whatsapp steps); the Calculadora needs it several times more (sueldo,
 * semanas, ahorro, nombre, whatsapp, email), so extracting it now is a
 * genuine, non-speculative reuse rather than a premature abstraction. */
export function MiniAppInput({
  label,
  hint,
  prefix,
  error,
  className = "",
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; prefix?: string; error?: string }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-[13.5px] font-medium" style={{ color: "var(--ma-text-color)" }}>
          {label}
        </label>
      )}
      {hint && (
        <p className="mb-1.5 text-[12px]" style={{ color: "var(--ma-text-muted)" }}>
          {hint}
        </p>
      )}
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px]" style={{ color: "var(--ma-text-muted)" }}>
            {prefix}
          </span>
        )}
        <input
          {...props}
          id={inputId}
          className={`w-full rounded-xl px-4 py-3 text-[15px] outline-none transition-colors duration-150 ${prefix ? "pl-7" : ""} ${className}`}
          style={{
            background: "var(--ma-background-surface)",
            border: `1px solid ${error ? "var(--color-error-strong)" : "var(--ma-border-strong)"}`,
            color: "var(--ma-text-color)",
          }}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-[12px]" style={{ color: "var(--color-error-strong)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
