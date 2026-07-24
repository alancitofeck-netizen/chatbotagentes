import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Growth Link",
    short_name: "Growth Link",
    description:
      "Growth Link es una plataforma SaaS de CRM impulsada por inteligencia artificial para gestionar conversaciones de WhatsApp, clientes, equipos comerciales y automatizaciones.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#6c63ff",
    icons: [
      {
        src: "/growth_businesss_logo.jpg",
        sizes: "200x200",
        type: "image/jpeg",
      },
    ],
  };
}
