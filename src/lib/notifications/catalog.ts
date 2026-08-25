import {
  UserPlus,
  ArrowRightLeft,
  Trophy,
  XCircle,
  MessageSquare,
  CheckSquare,
  Mail,
  MailWarning,
  Zap,
  ZapOff,
  CalendarX,
  CalendarClock,
  UserCog,
  UserMinus,
  Bot,
  AlertTriangle,
  Gauge,
  PlugZap,
  ShieldAlert,
  CircleDollarSign,
  type LucideIcon,
} from "lucide-react";

export type NotificationCategory = "crm" | "inbox" | "calendario" | "automatizaciones" | "agentes" | "ia" | "sistema" | "polizas" | "cobranza";
export type NotificationPriority = "info" | "success" | "warning" | "error";

/** Fase 1 (docs/blueprint no cubre notificaciones — ver plan de
 * implementación): un evento nuevo de cualquier módulo se agrega acá y ya
 * queda disponible para notify()/notifyMany() sin tocar el resto del
 * sistema. `category`/`priority`/`icon` son los defaults — el llamador
 * siempre provee su propio `title`/`message`. */
export const EVENT_CATALOG = {
  // CRM
  lead_assigned: { category: "crm", priority: "info", icon: UserPlus },
  lead_stage_changed: { category: "crm", priority: "info", icon: ArrowRightLeft },
  lead_won: { category: "crm", priority: "success", icon: Trophy },
  lead_lost: { category: "crm", priority: "warning", icon: XCircle },
  lead_comment_added: { category: "crm", priority: "info", icon: MessageSquare },
  lead_task_created: { category: "crm", priority: "info", icon: CheckSquare },
  lead_inactive: { category: "crm", priority: "warning", icon: AlertTriangle },

  // Inbox
  message_received: { category: "inbox", priority: "info", icon: Mail },
  message_send_failed: { category: "inbox", priority: "error", icon: MailWarning },
  conversation_unanswered: { category: "inbox", priority: "warning", icon: MailWarning },

  // Automatizaciones
  automation_executed: { category: "automatizaciones", priority: "success", icon: Zap },
  automation_failed: { category: "automatizaciones", priority: "error", icon: ZapOff },

  // Calendario
  meeting_cancelled: { category: "calendario", priority: "warning", icon: CalendarX },
  meeting_rescheduled: { category: "calendario", priority: "info", icon: CalendarClock },
  meeting_upcoming: { category: "calendario", priority: "info", icon: CalendarClock },
  meeting_started: { category: "calendario", priority: "success", icon: CalendarClock },

  // Agentes (equipo)
  member_added: { category: "agentes", priority: "success", icon: UserPlus },
  member_removed: { category: "agentes", priority: "warning", icon: UserMinus },
  member_role_changed: { category: "agentes", priority: "info", icon: UserCog },

  // IA
  ai_agent_created: { category: "ia", priority: "success", icon: Bot },
  ai_execution_error: { category: "ia", priority: "error", icon: AlertTriangle },
  ai_usage_high: { category: "ia", priority: "warning", icon: Gauge },
  ai_quota_exceeded: { category: "ia", priority: "error", icon: Gauge },
  referral_followup_task_created: { category: "ia", priority: "info", icon: CheckSquare },

  // Sistema
  integration_disconnected: { category: "sistema", priority: "warning", icon: PlugZap },

  // Pólizas
  policy_renewal_reminder: { category: "polizas", priority: "warning", icon: ShieldAlert },

  // Cobranza
  collection_payment_reminder: { category: "cobranza", priority: "warning", icon: CircleDollarSign },
} as const satisfies Record<string, { category: NotificationCategory; priority: NotificationPriority; icon: LucideIcon }>;

export type NotificationEventType = keyof typeof EVENT_CATALOG;

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  crm: "CRM",
  inbox: "Inbox",
  calendario: "Calendario",
  automatizaciones: "Automatizaciones",
  agentes: "Agentes",
  ia: "IA",
  sistema: "Sistema",
  polizas: "Pólizas",
  cobranza: "Cobranza",
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as NotificationCategory[];

export const PRIORITY_ICON_CLASS: Record<NotificationPriority, string> = {
  info: "text-info-strong bg-info-bg",
  success: "text-success-strong bg-success-bg",
  warning: "text-warning-strong bg-warning-bg",
  error: "text-error-strong bg-error-bg",
};

export function getEventMeta(eventType: string) {
  return EVENT_CATALOG[eventType as NotificationEventType] as
    | { category: NotificationCategory; priority: NotificationPriority; icon: LucideIcon }
    | undefined;
}
