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
      // The existing brand SVG retains its original design. PNG artwork at
      // 192/512 px must be exported and verified for Play Store packaging.
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
