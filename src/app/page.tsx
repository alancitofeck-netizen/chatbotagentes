import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { HomeLanding } from "./HomeLanding";

export const metadata: Metadata = {
  title: "Growth Link — CRM con IA para WhatsApp",
  description:
    "Growth Link es una plataforma SaaS de CRM impulsada por inteligencia artificial que ayuda a empresas, agencias y equipos comerciales a gestionar todas sus conversaciones de WhatsApp, clientes, procesos comerciales y automatizaciones desde un único lugar.",
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
