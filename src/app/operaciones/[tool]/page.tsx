import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Operaciones — Growth Link" };

const TOOLS: Record<string, { title: string; bg: string }> = {
  "herramienta-1": { title: "Growth Link OS", bg: "#0a0e14" },
  "herramienta-2": { title: "Growth Link Map", bg: "#0b0f16" },
};

/** Fuera de (protected)/ a propósito — mismo motivo que
 * src/app/asesorias/[asesoriaId]/page.tsx: cada herramienta ocupa el 100%
 * del viewport (tiene su propio sidebar/topbar), así que no puede quedar
 * envuelta en el Sidebar/Navbar del sitio. Sigue autenticada normalmente
 * (requireActiveWorkspace) + el mismo gate de rol que
 * (protected)/operaciones/layout.tsx (owner/admin, o supervisión) — no se
 * hereda ese layout acá, así que el chequeo se repite. */
export default async function OperacionToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  const info = TOOLS[tool];
  if (!info) notFound();

  const { role, isSupervising } = await requireActiveWorkspace();
  if (role !== "owner" && role !== "admin" && !isSupervising) notFound();

  return (
    <div style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", background: info.bg }}>
      <iframe
        src={`/api/operaciones/${tool}/frame`}
        title={info.title}
        allow="fullscreen; clipboard-write"
        allowFullScreen
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
      />
      <Link
        href="/operaciones"
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
          background: "rgba(18,24,36,0.85)",
          border: "1px solid rgba(79,146,255,0.32)",
          color: "#e7edf5",
          fontSize: 12,
          fontWeight: 600,
          textDecoration: "none",
          backdropFilter: "blur(6px)",
        }}
      >
        <ArrowLeft size={13} aria-hidden="true" />
        Volver a Operaciones
      </Link>
    </div>
  );
}
