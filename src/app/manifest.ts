import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mine Crush",
    short_name: "MineCrush",
    description:
      "Minesweeper meets Candy Crush — combos, power-ups, versus & co-op on your phone.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f0720",
    theme_color: "#1e0b3a",
    categories: ["games", "entertainment"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
