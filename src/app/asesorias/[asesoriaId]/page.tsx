import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getAsesoriaById } from "@/lib/asesorias/queries";

export const metadata: Metadata = { title: "Asesoría — Growth Link" };

/** Fuera de (protected)/(auth) a propósito — mismo nivel que src/app/apps/
 * — así nunca queda envuelta en el layout con Sidebar/Navbar (ver el plan
 * de esta sesión: "el usuario no debe notar ninguna diferencia visual" solo
 * es posible si esta pantalla ocupa el 100% del viewport, igual que el
 * archivo original standalone). Sigue autenticada normalmente
 * (requireActiveWorkspace) — lo único que cambia es que no hay chrome del
 * sitio alrededor. El propio Meeting OS se sirve dentro de un <iframe>
 * mismo-origen (ver /api/asesorias/[asesoriaId]/frame/route.ts para el
 * porqué) — todo lo que hay en esta página, fuera del <iframe>, es código
 * nuestro, nunca del archivo original. */
export default async function AsesoriaPage({ params }: { params: Promise<{ asesoriaId: string }> }) {
  const { asesoriaId } = await params;
  const { workspaceId } = await requireActiveWorkspace();
  const asesoria = await getAsesoriaById(workspaceId, asesoriaId);
  if (!asesoria) notFound();

  return (
    <div style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", background: "#050817" }}>
      <iframe
        src={`/api/asesorias/${asesoriaId}/frame`}
        title="Asesoría"
        allow="fullscreen; clipboard-write"
        allowFullScreen
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
      />
      <Link
        href="/asesorias"
        style={{
          position: "fixed",
          top: 14,
          left: 16,
          zIndex: 999,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 12px",
          borderRadius: 10,
          background: "rgba(13,24,56,0.85)",
          border: "1px solid rgba(127,196,255,0.32)",
          color: "#EAF2FF",
          fontSize: 12,
          fontWeight: 600,
          textDecoration: "none",
          backdropFilter: "blur(6px)",
        }}
      >
        <ArrowLeft size={13} aria-hidden="true" />
        Volver a Asesorías
      </Link>
    </div>
  );
}
