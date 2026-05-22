import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AstroFit",
    short_name: "AstroFit",
    description: "Self-hosted fitness tracker with XP, levels, and challenges",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0a0a12",
    theme_color: "#7c0eb3",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
