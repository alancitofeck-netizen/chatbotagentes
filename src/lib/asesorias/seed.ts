import "server-only";
import { buildFreshMeetingOsProject, type MeetingOsProject } from "@/lib/asesorias/meetingOsDefaults";

export interface AsesoriaSeedContact {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
}

export interface AsesoriaSeedBrand {
  companyName?: string;
  advisorName?: string;
  email?: string;
  whatsapp?: string;
  calendly?: string;
  website?: string;
  logoUrl?: string;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

/** Arma el `meetingProject` inicial para una Asesoría recién creada.
 *
 * `continuable: true` siembra `progress: 1` (en vez de 0) para que la
 * pantalla de inicio del propio archivo, sin tocarlo, muestre directo la
 * tarjeta "Continuar última reunión" con estos datos ya cargados — es el
 * único camino donde el prospecto sobrevive al primer clic del asesor
 * (`homeStart()`/"Comenzar" siempre reinicia `session` a `blankSession()`,
 * descartando cualquier prospecto precargado — ver el plan de esta sesión).
 * Solo se pide para asesorías creadas desde un Contacto ya identificado; el
 * efecto colateral aceptado es que se salta la diapositiva "cover" (índice 0)
 * y las 2 pantallas del Meeting Router. Branding (marca/logo/Calendly/
 * WhatsApp del asesor) sí sobrevive siempre, sin este truco, porque
 * `homeStart()` nunca toca `meetingProject.brand`. */
export function buildAsesoriaSeed(input: {
  contact?: AsesoriaSeedContact | null;
  advisorName?: string | null;
  brand?: AsesoriaSeedBrand | null;
  continuable?: boolean;
}): MeetingOsProject {
  const fullName = input.contact?.name?.trim() ?? "";
  const { firstName, lastName } = splitName(fullName);

  return buildFreshMeetingOsProject({
    prospect: {
      firstName,
      lastName,
      fullName,
      name: fullName,
      company: input.contact?.company ?? "",
      email: input.contact?.email ?? "",
      whatsapp: input.contact?.phone ?? "",
    },
    advisor: input.advisorName ?? "",
    brand: {
      companyName: input.brand?.companyName,
      advisorName: input.brand?.advisorName,
      contact: {
        email: input.brand?.email ?? "",
        whatsapp: input.brand?.whatsapp ?? "",
        calendly: input.brand?.calendly ?? "",
        website: input.brand?.website ?? "",
      },
      assets: input.brand?.logoUrl
        ? { logo: { url: input.brand.logoUrl, sourceType: "url", data: "", mimeType: "", fileName: "", fit: "contain", position: "center", background: "transparent" } }
        : undefined,
    },
    progress: input.continuable ? 1 : 0,
  });
}
