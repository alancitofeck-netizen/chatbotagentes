import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables next/navigation's forbidden()/unauthorized() — used to return a
  // real HTTP 403 (not just a 404 via notFound()) from Server Components
  // that gate admin-only surfaces (CRM "Agentes" tab, ATS, the platform
  // supervisor panel) by role, per the role-based-permissions requirement
  // that a manually-typed URL must be rejected with 403, not silently
  // hidden or redirected.
  experimental: {
    authInterrupts: true,
    // Sin esto, el Router Cache del cliente (distinto del cache de servidor
    // que revalidatePath sí invalida) guarda 30s cualquier ruta dinámica
    // visitada por navegación interna (<Link>/router.push) — así, volver a
    // /asesorias después de terminar una asesoría desde /sync (un Route
    // Handler, no un Server Action: nada le avisa al cliente que hay que
    // refrescar) mostraba datos viejos hasta que pasaban esos 30s. dynamic:0
    // hace que toda página dinámica siempre traiga datos frescos del
    // servidor en cada navegación — apropiado acá, es un CRM interno, no un
    // sitio de alto tráfico donde ese cache ahorre carga real.
    staleTimes: {
      dynamic: 0,
    },
  },

  // pdfkit reads its bundled AFM font metrics files from disk at runtime via
  // a path relative to its own package location — bundling it (the Next.js
  // default for server code) rewrites/loses that path, causing "ENOENT
  // .../pdfkit/js/data/Helvetica.afm" at request time. Keeping it external
  // means it's just `require()`d normally from node_modules, where its
  // internal relative paths resolve correctly.
  serverExternalPackages: ["pdfkit"],

  // Contactos moved from its own top-level route into Inbox's secondary nav
  // (src/app/(protected)/inbox/contactos/) — keeps old bookmarks/links alive.
  async redirects() {
    return [{ source: "/contacts", destination: "/inbox/contactos", permanent: false }];
  },
};

export default nextConfig;
