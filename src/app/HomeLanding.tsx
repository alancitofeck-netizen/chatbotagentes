import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Inbox,
  Kanban,
  Bot,
  CalendarDays,
  CalendarClock,
  HardDrive,
  Table2,
  UserSearch,
  BarChart3,
  Zap,
  ShieldCheck,
  Lock,
  KeyRound,
  Ban,
  Building2,
  Briefcase,
  Users,
  Workflow,
  MessageCircle,
  CheckCircle2,
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

// Short, scannable list shown right under the hero subtitle — a reviewer (or
// any visitor) who never scrolls past the first screen should still see the
// full breadth of what Growth Link does within a few seconds.
const HERO_CAPABILITIES = [
  "CRM",
  "WhatsApp Multiagente",
  "Inteligencia Artificial",
  "Automatizaciones",
  "Calendario",
  "Google Calendar",
  "Google Drive",
  "Google Sheets",
  "ATS",
  "Gestión documental",
  "KPIs",
  "Equipos de trabajo",
];

const WHAT_IS_ITEMS = [
  "CRM",
  "WhatsApp Multiagente",
  "Inteligencia Artificial",
  "Automatizaciones",
  "Google Calendar",
  "Google Drive",
  "Google Sheets",
  "ATS",
  "Gestión documental",
  "KPIs",
  "Calendario",
  "Equipos de trabajo",
];

const FEATURE_CARDS: FeatureCard[] = [
  {
    icon: Inbox,
    iconClass: "bg-success-bg text-success-strong",
    title: "WhatsApp Multiagente",
    description: "Una bandeja unificada donde todo tu equipo atiende las conversaciones de WhatsApp Business en un solo lugar.",
  },
  {
    icon: Kanban,
    iconClass: "bg-accent-100 text-accent-700",
    title: "CRM Comercial",
    description: "Gestioná contactos, empresas y oportunidades de venta con un pipeline visual, de principio a fin.",
  },
  {
    icon: Bot,
    iconClass: "bg-accent-100 text-accent-700",
    title: "Inteligencia Artificial",
    description: "Agentes de inteligencia artificial que responden o asisten a tu equipo directamente en WhatsApp.",
  },
  {
    icon: Zap,
    iconClass: "bg-accent-100 text-accent-700",
    title: "Automatizaciones",
    description: "Reglas automáticas que mueven oportunidades, asignan conversaciones y notifican a tu equipo.",
  },
  {
    icon: CalendarClock,
    iconClass: "bg-primary-100 text-primary-700",
    title: "Calendario",
    description: "Un calendario interno para agendar reuniones y eventos, con sincronización opcional hacia Google Calendar.",
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
    title: "Dashboard KPI",
    description: "Un panel de indicadores por setter y por equipo, con rankings, objetivos y gráficos.",
  },
];

const INTEGRATIONS = [
  { icon: CalendarDays, iconClass: "bg-primary-100 text-primary-700", label: "Google Calendar" },
  { icon: HardDrive, iconClass: "bg-primary-100 text-primary-700", label: "Google Drive" },
  { icon: Table2, iconClass: "bg-success-bg text-success-strong", label: "Google Sheets" },
  { icon: MessageCircle, iconClass: "bg-success-bg text-success-strong", label: "WhatsApp" },
  { icon: Bot, iconClass: "bg-accent-100 text-accent-700", label: "Inteligencia Artificial" },
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
    title: "Credenciales cifradas",
    description: "Los tokens de acceso de integraciones (incluyendo Google) se guardan siempre cifrados, nunca en texto plano.",
  },
  {
    icon: Ban,
    title: "Nunca vendemos tus datos",
    description: "Growth Link no vende, alquila ni comercializa tus datos personales ni los de tu Workspace a terceros, bajo ninguna circunstancia.",
  },
];

const AUDIENCES = [
  { icon: Building2, label: "Agencias" },
  { icon: Briefcase, label: "Empresas" },
  { icon: Users, label: "Equipos comerciales" },
  { icon: MessageCircle, label: "Negocios que usan WhatsApp" },
  { icon: Workflow, label: "Organizaciones que automatizan procesos comerciales" },
];

/** Public marketing homepage — rendered directly at "/" for anyone without a
 * session (src/app/page.tsx redirects logged-in users to /dashboard instead,
 * unchanged from before). Built specifically to satisfy Google OAuth brand
 * verification's requirement that the Homepage link clearly explain what the
 * app is and does within a few seconds of landing — a first pass was still
 * rejected as insufficiently clear, so this revision adds a scannable
 * capability strip right under the hero (visible without scrolling), a full
 * enumerated "¿Qué es Growth Link?" bullet list, a "Características" section
 * (renamed from "¿Qué podés hacer...") with a card per module including a
 * distinct internal "Calendario" card (separate from the "Google Calendar"
 * integration card), an explicit "cada integración se autoriza
 * individualmente mediante Google OAuth" line in Integraciones, a "nunca
 * vendemos tus datos" point in Seguridad, and a 5th audience in "¿Para quién
 * es?". Same visual identity/design tokens throughout — content-only
 * expansion, no redesign. Uses "Growth Link" (two words) consistently,
 * matching every other page/metadata title in the app. */
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
          <p className="mx-auto mt-5 max-w-2xl text-balance text-[18px] leading-8 text-neutral-700 sm:text-[20px] sm:leading-9">
            Growth Link es una plataforma SaaS de CRM impulsada por inteligencia artificial que ayuda a empresas,
            agencias y equipos comerciales a gestionar todas sus conversaciones de WhatsApp, clientes, procesos
            comerciales y automatizaciones desde un único lugar.
          </p>

          <div className="mx-auto mt-6 flex max-w-2xl flex-wrap items-center justify-center gap-2">
            {HERO_CAPABILITIES.map((label) => (
              <span
                key={label}
                className="rounded-full border border-border-default bg-surface-1 px-3 py-1 text-xs font-medium text-neutral-600"
              >
                {label}
              </span>
            ))}
          </div>

          <p className="mx-auto mt-5 max-w-2xl text-balance text-sm leading-6 text-neutral-600">
            Google Calendar, Google Drive y Google Sheets son integraciones opcionales: solo se conectan cuando vos
            decidís autorizarlas mediante Google OAuth, desde Perfil → Integraciones.
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
          <div className="mx-auto w-full max-w-4xl px-6 py-16 sm:py-20">
            <h2 className="text-center text-[28px] font-semibold tracking-[-0.02em] text-foreground">
              ¿Qué es Growth Link?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-[16px] leading-7 text-neutral-600">
              Growth Link es una plataforma SaaS CRM impulsada por inteligencia artificial que ayuda a empresas,
              agencias y equipos comerciales a gestionar todas sus conversaciones de WhatsApp, clientes, procesos
              comerciales y automatizaciones desde un único lugar. Cada empresa opera en su propio Workspace,
              aislado y privado. Growth Link ofrece:
            </p>
            <ul className="mx-auto mt-6 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {WHAT_IS_ITEMS.map((item) => (
                <li key={item} className="flex items-center gap-2 text-[15px] text-neutral-700">
                  <CheckCircle2 className="size-4 shrink-0 text-accent-500" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Características */}
        <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
          <h2 className="text-center text-[28px] font-semibold tracking-[-0.02em] text-foreground">
            Características
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
              Growth Link se conecta con las herramientas que ya usás. Todas las conexiones son opcionales: cada
              integración se autoriza individualmente mediante Google OAuth, en el momento en que vos decidís
              conectarla desde Perfil → Integraciones — nunca de forma automática ni agrupada — y podés revocar el
              acceso cuando quieras.
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

        {/* Uso de las APIs de Google */}
        <section className="mx-auto w-full max-w-4xl px-6 py-16 sm:py-20">
          <h2 className="text-center text-[28px] font-semibold tracking-[-0.02em] text-foreground">
            Uso de las APIs de Google
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[15px] leading-7 text-neutral-600">
            Growth Link solicita acceso a Google Calendar, Google Drive y Google Sheets únicamente cuando el usuario
            decide conectar esas integraciones desde la sección Perfil → Integraciones. Estos permisos se utilizan
            exclusivamente para proporcionar las funcionalidades solicitadas por el usuario, como sincronizar
            eventos, acceder a documentos o importar datos desde hojas de cálculo. Growth Link no accede a datos de
            Google sin autorización explícita del usuario.
          </p>
        </section>

        {/* Seguridad */}
        <section className="border-t border-border-default bg-surface-1">
          <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
            <h2 className="text-center text-[28px] font-semibold tracking-[-0.02em] text-foreground">Seguridad</h2>
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          </div>
        </section>

        {/* Para quién es */}
        <section className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-20">
          <h2 className="text-center text-[28px] font-semibold tracking-[-0.02em] text-foreground">
            ¿Para quién es?
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
