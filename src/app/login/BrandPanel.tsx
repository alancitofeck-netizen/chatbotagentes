import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

const FEATURES = [
  "WhatsApp Multiagente",
  "IA integrada para responder clientes",
  "Automatizaciones inteligentes",
  "Calendario y tareas",
  "Pipeline de ventas",
  "Reportes en tiempo real",
];

const FLOATING_CARDS = [
  { emoji: "💬", label: "WhatsApp Integrado" },
  { emoji: "⚡", label: "Automatizaciones" },
  { emoji: "🤖", label: "Inteligencia Artificial" },
];

/** Right column of the login screen — a self-contained "product landing"
 * panel instead of a stock photo, per the redesign brief. Isolated in its
 * own component (and its own top-level route, src/app/login/) rather than
 * touching src/app/(auth)/layout.tsx, which register/forgot-password/
 * reset-password still use unchanged.
 *
 * Two separate layers, not one: the decorative background (gradient + wash
 * + blurred shapes) lives in its own `absolute inset-0 overflow-hidden`
 * div, and the real content is a plain sibling with no `overflow-hidden` of
 * its own. The first version put both in the same overflow-hidden flex
 * column with `justify-between` — on a browser window shorter than the
 * card's natural content height, that silently *clipped* the middle
 * headline/checklist block instead of scrolling it (logo and floating
 * cards, first/last flex children, stayed visible; the middle one didn't).
 * Content now flows naturally with `gap`s instead of `justify-between`, so
 * a short viewport just makes the whole page scroll — same as the form
 * column already does — instead of silently hiding text.
 *
 * The real bug, found via `document.elementFromPoint()` (not guesswork —
 * getComputedStyle on the hidden text kept reporting opacity:1/visible,
 * which is what made this one hard to spot): the background wrapper above
 * is `position: absolute`. Per the CSS2 painting-order spec, a positioned
 * element with `z-index: auto` paints in a *later* step than plain
 * non-positioned in-flow content — DOM order only breaks ties *within* the
 * same step, it doesn't matter *across* steps. So the absolute background,
 * despite coming first in the markup, was painting *on top of* the plain
 * `<div>`s holding the logo/headline/checklist/cards, which had no
 * position of their own and so belonged to an earlier paint step. Every
 * content wrapper below now has `relative` (position:relative, still
 * z-index:auto) specifically to move it into the *same* paint step as the
 * background — that's what makes DOM order decide the outcome again, and
 * why later-in-markup content now correctly wins. */
export function BrandPanel() {
  return (
    <div className="relative isolate hidden lg:flex lg:flex-col lg:items-center lg:justify-center lg:gap-10 lg:p-12 xl:p-16">
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-[length:200%_200%] motion-safe:animate-[gradient-pan_18s_ease_infinite]"
          style={{
            backgroundImage:
              "linear-gradient(120deg, var(--color-primary-950) 0%, var(--color-primary-900) 40%, var(--color-accent-900) 100%)",
          }}
        />
        <div className="absolute inset-0 bg-primary-950/55" />
        <div className="pointer-events-none absolute -top-24 -left-24 size-80 rounded-full bg-accent-500/25 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute top-1/3 -right-16 size-72 rounded-full bg-primary-500/20 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-24 left-1/4 size-96 rounded-full bg-accent-400/15 blur-3xl" aria-hidden="true" />
      </div>

      <Logo inverted size="lg" className="relative" />

      <div className="relative flex max-w-md flex-col items-center gap-4 text-center">
        <h2 className="text-balance text-[32px] leading-[40px] font-semibold tracking-[-0.02em] text-white">
          Growth Link
        </h2>
        <p className="text-[17px] leading-7 text-white/85">El centro de operaciones para agencias modernas.</p>
        <ul className="mt-2 flex flex-col items-start gap-3">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-2.5 text-[15px] font-medium text-white">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                <CheckCircle2 className="size-[14px] text-white" aria-hidden="true" />
              </span>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative flex flex-wrap justify-center gap-3">
        {FLOATING_CARDS.map((card, i) => (
          <div
            key={card.label}
            style={{ animationDelay: `${i * 0.4}s` }}
            className="flex items-center gap-2 rounded-xl border border-white/25 bg-white/15 px-4 py-3 text-sm font-semibold text-white shadow-[var(--elevation-md)] backdrop-blur-md motion-safe:animate-[float-slow_5s_ease-in-out_infinite]"
          >
            <span aria-hidden="true">{card.emoji}</span>
            {card.label}
          </div>
        ))}
      </div>

      <p className="relative text-xs text-white/70">© {new Date().getFullYear()} Growth Link</p>
    </div>
  );
}
