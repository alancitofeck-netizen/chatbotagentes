import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getWorkspaceModuleStatus } from "@/lib/settings/queries";

export const metadata: Metadata = { title: "ManyChat — Growth Link" };

/** Fuera de (protected)/ a propósito — mismo motivo que
 * src/app/operaciones/[tool]/page.tsx y src/app/asesorias/[asesoriaId]/page.tsx:
 * el dashboard ocupa el 100% del viewport (tiene su propio header/nav), así
 * que no puede quedar envuelto en el Sidebar/Navbar del sitio. Sigue
 * autenticada normalmente (requireActiveWorkspace) — no se hereda el layout
 * de (protected), así que el chequeo se repite acá, igual que en esos dos
 * módulos. Mismo criterio de acceso que tenía el módulo anterior: cualquier
 * rol del workspace puede verlo, gateado por workspace_modules. */
export default async function ManychatPage() {
  const { workspaceId } = await requireActiveWorkspace();
  const moduleStatus = await getWorkspaceModuleStatus(workspaceId);
  const enabled = moduleStatus.some((m) => m.moduleKey === "manychat" && m.enabled);

  if (!enabled) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#F4F6FB" }}>
        <div style={{ maxWidth: 420, textAlign: "center", display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#141735" }}>El módulo ManyChat no está activo</h1>
          <p style={{ color: "#5E6484", fontSize: 14 }}>Activalo desde Perfil → Módulos para ver el dashboard de leads.</p>
          <Link
            href="/dashboard"
            style={{ marginTop: 8, alignSelf: "center", padding: "9px 16px", borderRadius: 11, background: "#141735", color: "#F4F6FB", fontWeight: 600, fontSize: 14, textDecoration: "none" }}
          >
            Volver
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, width: "100vw", height: "100dvh", background: "#EEF9FA", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", paddingTop: "calc(10px + env(safe-area-inset-top, 0px))", background: "#EEF9FA" }}>
        <Link
          href="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            height: 34,
            padding: "0 12px",
            borderRadius: 12,
            background: "#0E1630",
            color: "#EEF3FB",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Volver
        </Link>
      </div>
      <iframe
        src="/api/manychat/frame"
        title="ManyChat — Growth Link"
        allow="clipboard-write"
        style={{ flex: 1, width: "100%", minHeight: 0, border: "none" }}
      />
    </div>
  );
}
