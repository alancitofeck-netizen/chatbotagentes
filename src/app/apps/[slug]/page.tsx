import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicMiniAppBySlug } from "@/lib/miniApps/queries";
import { RetirementSimulatorApp } from "./RetirementSimulatorApp";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const app = await getPublicMiniAppBySlug(slug);
  return { title: app ? `${app.name} — Growth Link` : "Mini App — Growth Link" };
}

/** Fully public route — a top-level page outside (protected)/(auth), same
 * precedent as src/app/privacy/page.tsx. middleware.ts's PROTECTED_PREFIXES
 * only covers /dashboard and /select-workspace, so this needs no changes
 * there to stay unauthenticated. */
export default async function MiniAppPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = await getPublicMiniAppBySlug(slug);
  if (!app) notFound();

  if (app.templateKey === "simulador_retiro") {
    return <RetirementSimulatorApp app={app} />;
  }

  notFound();
}
