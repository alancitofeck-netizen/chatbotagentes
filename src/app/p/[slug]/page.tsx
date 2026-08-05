import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicPresentationBySlug, incrementPresentationViews } from "@/lib/presentations/queries";
import { PublicPresentationView } from "./PublicPresentationView";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const presentation = await getPublicPresentationBySlug(slug);
  return { title: presentation ? `${presentation.title} — Growth Link` : "Presentación — Growth Link" };
}

/** Ruta completamente pública, fuera de (protected)/(auth) — mismo
 * precedente que src/app/apps/[slug]/page.tsx (Mini Apps): middleware.ts's
 * PROTECTED_PREFIXES solo cubre /dashboard y /select-workspace, así que no
 * necesita ningún cambio ahí para seguir sin autenticación. */
export default async function PresentationPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const presentation = await getPublicPresentationBySlug(slug);
  if (!presentation) notFound();

  void incrementPresentationViews(presentation.id);

  const assetBase = `/api/public/presentaciones/${slug}/asset`;
  function relativePath(storedPath: string): string {
    const prefix = `${presentation!.workspaceId}/${presentation!.id}/`;
    return storedPath.startsWith(prefix) ? storedPath.slice(prefix.length) : storedPath;
  }

  return (
    <PublicPresentationView
      presentation={presentation}
      photoUrls={presentation.photos.map((p) => `${assetBase}/${relativePath(p.selectedPath)}`)}
      pdfUrl={presentation.pdfStoragePath ? `${assetBase}/${relativePath(presentation.pdfStoragePath)}` : null}
    />
  );
}
