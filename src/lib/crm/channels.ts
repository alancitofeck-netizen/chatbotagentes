import { MessageCircle, Camera, Globe, Tag, type LucideIcon } from "lucide-react";

/** Canales visibles en el board — agrupación deliberada, no un espejo 1:1 de
 * `contacts.source` (que es texto libre: "LinkedIn", "referido", "ats", etc.).
 * "manychat" se agrupa dentro de "instagram" porque para quien usa el CRM es
 * el mismo canal de conversación (DM de Instagram), aunque sea una
 * integración técnica distinta — decisión confirmada con el usuario. TikTok
 * no tiene bucket propio: no existe integración alguna que escriba ese
 * source hoy, así que nunca aparecería con datos reales. */
export type Channel = "whatsapp" | "instagram" | "web" | "manual";

export const CHANNELS: Channel[] = ["whatsapp", "instagram", "web", "manual"];

export const CHANNEL_LABEL: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  web: "Web",
  manual: "Otros",
};

export const CHANNEL_ICON: Record<Channel, LucideIcon> = {
  whatsapp: MessageCircle,
  instagram: Camera,
  web: Globe,
  manual: Tag,
};

/** Mismo `source` que ya alimenta el filtro "Origen" existente
 * (`contacts.source`, ver boardFilters.ts) — esto solo lo agrupa para la
 * barra de canales. Nunca descarta un lead: cualquier source no reconocido
 * (o null) cae en "manual" ("Otros"), nunca desaparece de la vista. */
export function resolveChannel(source: string | null): Channel {
  if (source === "whatsapp") return "whatsapp";
  if (source === "instagram" || source === "manychat") return "instagram";
  if (source === "mini_app") return "web";
  return "manual";
}
