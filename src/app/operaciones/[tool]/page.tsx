import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileCode2 } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Operaciones — Growth Link" };

const KNOWN_TOOLS = new Set(["herramienta-1", "herramienta-2"]);

/** Fuera de (protected)/ a propósito — mismo motivo que
 * src/app/asesorias/[asesoriaId]/page.tsx: la herramienta ocupa el 100% del
 * viewport (tiene su propio sidebar/topbar), así que no puede quedar
 * envuelta en el Sidebar/Navbar del sitio. Sigue autenticada normalmente
 * (requireActiveWorkspace) + el mismo gate de rol que
 * (protected)/operaciones/layout.tsx (owner/admin, o supervisión) — no se
 * hereda ese layout acá, así que el chequeo se repite. */
export default async function OperacionToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  if (!KNOWN_TOOLS.has(tool)) notFound();

  const { role, isSupervising } = await requireActiveWorkspace();
  if (role !== "owner" && role !== "admin" && !isSupervising) notFound();

  if (tool !== "herramienta-1") {
    return (
      <div className="flex min-h-screen flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <Link href="/operaciones" className="flex w-fit items-center gap-1.5 text-sm text-neutral-500 hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a Operaciones
        </Link>
        <EmptyState icon={FileCode2} title="Todavía no se cargó esta herramienta" description="En cuanto se suba el contenido, va a aparecer acá." />
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", background: "#0a0e14" }}>
      <iframe
        src="/api/operaciones/herramienta-1/frame"
        title="Growth Link OS"
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
