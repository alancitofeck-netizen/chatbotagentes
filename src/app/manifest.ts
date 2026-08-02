import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Growth Link",
    short_name: "Growth Link",
    description:
      "Growth Link es una plataforma SaaS de CRM impulsada por inteligencia artificial para gestionar conversaciones de WhatsApp, clientes, equipos comerciales y automatizaciones.",
    start_url: "/",
    scope: "/",
    id: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#6c63ff",
    // Placeholder monogram (public/icon.svg) — swap for a real designed PNG
    // (192/512 + a maskable variant with safe-zone padding) before shipping
    // to real users; see optimización mobile Fase 5 plan.
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
