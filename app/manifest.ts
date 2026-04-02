import type { MetadataRoute } from "next"

const LOGO =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/omegacrate_logo-tJzRwAfwpZAQEkJOSjQGI93l5hRU06.png"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OmegaCases",
    short_name: "OmegaCases",
    description: "Open cases, trade rare items, earn crypto",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#313338",
    theme_color: "#5865f2",
    categories: ["games", "entertainment"],
    icons: [
      {
        src: LOGO,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: LOGO,
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  }
}
