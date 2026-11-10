import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "WeedReset — Sua jornada, seu ritmo",
    short_name: "WeedReset",
    description: "Ferramentas de apoio para quem deseja reduzir ou interromper o consumo de cannabis, registrar humor e acompanhar objetivos pessoais.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#090916",
    theme_color: "#110e22",
    lang: "pt-BR",
    categories: ["health", "lifestyle"],
    prefer_related_applications: false,
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
