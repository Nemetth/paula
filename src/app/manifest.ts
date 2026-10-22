import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Paula — plan del día",
    short_name: "Paula",
    description: "Planificación diaria, ciclos de clientes y cobros.",
    start_url: "/hoy",
    display: "standalone",
    background_color: "#eceff3",
    theme_color: "#2a2e36",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
