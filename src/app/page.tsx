import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { HomeLanding } from "./HomeLanding";

// The app's official name — exactly "Growth Link" — is the <title>, never
// a longer marketing string. The descriptive copy belongs only in
// `description`/`openGraph.description`, never appended to the title.
const TITLE = "Growth Link";
const DESCRIPTION =
  "Growth Link es una plataforma SaaS de CRM impulsada por inteligencia artificial que ayuda a empresas, agencias y equipos comerciales a gestionar todas sus conversaciones de WhatsApp, clientes, procesos comerciales y automatizaciones desde un único lugar.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    siteName: "Growth Link",
    title: TITLE,
    description: DESCRIPTION,
    url: "https://www.growthlink.uk",
    locale: "es_AR",
    type: "website",
    images: ["/growth_businesss_logo.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/growth_businesss_logo.jpg"],
  },
};

/** Logged-in users keep the exact same behavior as before (straight to
 * /dashboard). Logged-out visitors now see a real marketing homepage instead
 * of an unconditional redirect to /login — required by Google OAuth brand
 * verification, which rejected the previous "/" for not explaining
 * Growth Link's purpose (a bare redirect has no content of its own to
 * review). */
export default async function RootPage() {
  const user = await getUser();
  if (user) redirect("/dashboard");
  return <HomeLanding />;
}
