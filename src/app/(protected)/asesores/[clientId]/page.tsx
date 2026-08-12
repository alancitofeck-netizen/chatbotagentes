import { redirect } from "next/navigation";

/** /asesores/[clientId] nunca tuvo página propia — solo layout.tsx (header +
 * tabs) y sus subrutas (resumen/operacion/etc). "Ver cliente" en ClientCard/
 * ClientListRow.tsx navega acá sin sufijo, así que sin este redirect da 404.
 * Resumen es la pestaña de aterrizaje natural (primera en TABS, igual que
 * la referencia visual del módulo). */
export default async function ClientProfileIndexPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  redirect(`/asesores/${clientId}/resumen`);
}
