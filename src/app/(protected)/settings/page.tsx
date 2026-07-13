import { redirect } from "next/navigation";

/** Configuración was consolidated into /profile (Mi perfil/Cuenta/Seguridad/
 * Preferencias/Workspace/Integraciones/Facturación) — kept as a redirect so
 * old bookmarks/links don't 404. */
export default function SettingsRedirectPage() {
  redirect("/profile?tab=workspace");
}
