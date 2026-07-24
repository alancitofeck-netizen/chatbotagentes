import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Inbox,
  Kanban,
  Bot,
  CalendarDays,
  HardDrive,
  Table2,
  UserSearch,
  BarChart3,
  Zap,
  ShieldCheck,
  Lock,
  KeyRound,
  Building2,
  Briefcase,
  Users,
  MessageCircle,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { buttonClassName } from "@/components/ui/Button";

interface FeatureCard {
  icon: LucideIcon;
  iconClass: string;
  title: string;
  description: string;
}

const FEATURE_CARDS: FeatureCard[] = [
  {
    icon: Inbox,
    iconClass: "bg-success-bg text-success-strong",
    title: "WhatsApp Inbox",
    description: "Una bandeja unificada para atender todas tus conversaciones de WhatsApp Business en un solo lugar.",
  },
  {
    icon: Kanban,
    iconClass: "bg-accent-100 text-accent-700",
    title: "CRM",
    description: "Gestioná contactos, empresas y oportunidades de venta con un pipeline visual, de principio a fin.",
  },
  {
    icon: Bot,
    iconClass: "bg-accent-100 text-accent-700",
    title: "IA",
    description: "Agentes de inteligencia artificial que responden o asisten a tu equipo directamente en WhatsApp.",
  },
  {
    icon: CalendarDays,
    iconClass: "bg-primary-100 text-primary-700",
    title: "Google Calendar",
    description: "Sincronizá tus eventos y agendá reuniones sin salir de Growth Link (conexión opcional).",
  },
  {
    icon: HardDrive,
    iconClass: "bg-primary-100 text-primary-700",
    title: "Google Drive",
    description: "Importá y exportá documentos directamente desde tu Drive al módulo de Documentos (conexión opcional).",
  },
  {
    icon: Table2,
    iconClass: "bg-success-bg text-success-strong",
    title: "Google Sheets",
    description: "Leé los indicadores de tu equipo desde una planilla de Google y vé los KPIs en tiempo real (conexión opcional).",
  },
  {
    icon: UserSearch,
    iconClass: "bg-primary-100 text-primary-700",
    title: "ATS",
    description: "Gestioná vacantes y candidatos de tus procesos de reclutamiento dentro de la misma plataforma.",
  },
  {
    icon: BarChart3,
    iconClass: "bg-success-bg text-success-strong",
    title: "KPIs",
    description: "Un panel de indicadores por setter y por equipo, con rankings, objetivos y gráficos.",
  },
  {
    icon: Zap,
    iconClass: "bg-accent-100 text-accent-700",
    title: "Automatizaciones",
    description: "Reglas automáticas que mueven oportunidades, asignan conversaciones y notifican a tu equipo.",
  },
];

const INTEGRATIONS = [
  { icon: CalendarDays, iconClass: "bg-primary-100 text-primary-700", label: "Google Calendar" },
  { icon: HardDrive, iconClass: "bg-primary-100 text-primary-700", label: "Google Drive" },
  { icon: Table2, iconClass: "bg-success-bg text-success-strong", label: "Google Sheets" },
  { icon: MessageCircle, iconClass: "bg-success-bg text-success-strong", label: "WhatsApp" },
  { icon: Bot, iconClass: "bg-accent-100 text-accent-700", label: "IA (OpenRouter)" },
];

const SECURITY_POINTS = [
  {
    icon: ShieldCheck,
    title: "Aislamiento por Workspace",
    description: "Cada empresa tiene su propio Workspace — sus datos nunca son accesibles desde otro Workspace de la plataforma.",
  },
  {
    icon: Lock,
    title: "HTTPS de punta a punta",
    description: "Toda la comunicación entre tu navegador y Growth Link viaja cifrada.",
  },
  {
    icon: ShieldCheck,
    title: "Supabase Row Level Security",
    description: "Controles de seguridad a nivel de base de datos que refuerzan el aislamiento entre Workspaces en cada consulta.",
  },
  {
    icon: KeyRound,
    title: "Supabase Vault",
    description: "Los tokens de acceso de integraciones (incluyendo Google) se guardan siempre cifrados, nunca en texto plano.",
  },
];

const AUDIENCES = [
  { icon: Building2, label: "Agencias" },
  { icon: Briefcase, label: "Empresas" },
  { icon: Users, label: "Equipos comerciales" },
  { icon: MessageCircle, label: "Negocios que usan WhatsApp" },
];

/** Public marketing homepage — rendered directly at "/" for anyone without a
 * session (src/app/page.tsx redirects logged-in users to /dashboard instead,
 * unchanged from before). Built specifically to satisfy Google OAuth brand
 * verification's requirement that the Homepage link clearly explain what the
 * app is and does — the previous "/" just redirected straight to /login,
 * which Google rejected as not explaining Growth Link's purpose. Uses the
 * exact name "Growth Link" (two words), matching the app's established
 * branding used everywhere else (login page, emails, etc.). */
export function HomeLanding() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-2">
      <header className="border-b border-border-default bg-surface-1">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Logo size="sm" />
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">Growth Link</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link href="/login" className={buttonClassName({ variant: "ghost", size: "sm" })}>
              Iniciar sesión
            </Link>
            <Link href="/register" className={buttonClassName({ variant: "primary", size: "sm" })}>
              Crear cuenta
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto w-full max-w-4xl px-6 py-20 text-center sm:py-28">
          <h1 className="text-balance text-[40px] leading-[48px] font-semibold tracking-[-0.02em] text-foreground sm:text-[56px] sm:leading-[64px]">
            Growth Link
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-[18px] leading-8 text-neutral-600 sm:text-[20px] sm:leading-9">
            Growth Link es una plataforma SaaS de CRM impulsada por inteligencia artificial para gestionar
            conversaciones de WhatsApp, clientes, equipos comerciales y automatizaciones, todo desde un solo lugar.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/register" className={buttonClassName({ variant: "primary", size: "lg" })}>
              Crear cuenta gratis
            </Link>
            <Link href="/login" className={buttonClassName({ variant: "secondary", size: "lg" })}>
              Iniciar sesión
            </Link>
          </div>
        </section>

        {/* Qué es Growth Link */}
        <section className="border-t border-border-default bg-surface-1">
          <div className="mx-auto w-full max-w-4xl px-6 py-16 text-center sm:py-20">
            <h2 className="text-[28px] font-semibold tracking-[-0.02em] text-foreground">¿Qué es Growth Link?</h2>
            <p className="mx-auto mt-4 max-w-2xl text-[16px] leading-7 text-neutral-600">
              Growth Link centraliza la operación conversacional de tu negocio sobre WhatsApp: un mismo lugar donde tu
              equipo y la inteligencia artificial atienden clientes, gestionan un pipeline de ventas, coordinan un
              calendario, procesan reclutamiento y miden resultados — sin depender de planillas sueltas ni de
              herramientas desconectadas entre sí. Cada empresa opera en su propio Workspace, aislado y privado.
            </p>
          </div>
        </section>

        {/* Qué podés hacer */}
        <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
          <h2 className="text-center text-[28px] font-semibold tracking-[-0.02em] text-foreground">
            ¿Qué podés hacer con Growth Link?
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_CARDS.map(({ icon: Icon, iconClass, title, description }) => (
              <div key={title} className="rounded-lg bg-surface-1 p-5 shadow-[var(--elevation-sm)]">
                <span className={`flex size-9 items-center justify-center rounded-full ${iconClass}`}>
                  <Icon className="size-[18px]" aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-[15px] font-semibold text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-neutral-600">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Integraciones */}
        <section className="border-t border-border-default bg-surface-1">
          <div className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-20">
            <h2 className="text-center text-[28px] font-semibold tracking-[-0.02em] text-foreground">Integraciones</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-[15px] leading-7 text-neutral-600">
              Growth Link se conecta con las herramientas que ya usás. Todas las conexiones son opcionales: vos decidís
              cuáles activar, y podés desconectarlas en cualquier momento desde Perfil → Integraciones.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              {INTEGRATIONS.map(({ icon: Icon, iconClass, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 rounded-full border border-border-default bg-surface-2 px-4 py-2.5"
                >
                  <span className={`flex size-7 items-center justify-center rounded-full ${iconClass}`}>
                    <Icon className="size-[14px]" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Seguridad y privacidad */}
        <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
          <h2 className="text-center text-[28px] font-semibold tracking-[-0.02em] text-foreground">
            Seguridad y privacidad
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SECURITY_POINTS.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-lg bg-surface-1 p-5 shadow-[var(--elevation-sm)]">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                  <Icon className="size-[18px]" aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-[15px] font-semibold text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-neutral-600">{description}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-neutral-500">
            Más detalles en nuestra <Link href="/privacy" className="font-medium text-accent-600 hover:text-accent-700">Política de Privacidad</Link>.
          </p>
        </section>

        {/* Para quién está pensado */}
        <section className="border-t border-border-default bg-surface-1">
          <div className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-20">
            <h2 className="text-center text-[28px] font-semibold tracking-[-0.02em] text-foreground">
              Para quién está pensado
            </h2>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              {AUDIENCES.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 rounded-full border border-border-default bg-surface-2 px-4 py-2.5"
                >
                  <Icon className="size-4 text-neutral-600" aria-hidden="true" />
                  <span className="text-sm font-medium text-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="mx-auto w-full max-w-3xl px-6 py-20 text-center sm:py-24">
          <h2 className="text-balance text-[28px] font-semibold tracking-[-0.02em] text-foreground">
            Empezá a usar Growth Link hoy
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-7 text-neutral-600">
            Creá tu cuenta gratis o iniciá sesión con Google — tu Workspace se configura automáticamente.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/register" className={buttonClassName({ variant: "primary", size: "lg" })}>
              Crear cuenta gratis
            </Link>
            <Link href="/login" className={buttonClassName({ variant: "secondary", size: "lg" })}>
              Iniciar sesión
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
