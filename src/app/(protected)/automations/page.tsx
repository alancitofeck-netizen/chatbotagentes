import { redirect } from "next/navigation";

/** Automatizaciones was consolidated into /profile (Perfil > Automatizaciones)
 * — kept as a redirect so old bookmarks/links don't 404. */
export default function AutomationsRedirectPage() {
  redirect("/profile?tab=automations");
}
