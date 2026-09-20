import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wild Bean Coffee Manager",
    short_name: "Wild Bean Manager",
    description: "Private store operations and inventory workspace.",
    start_url: "/overview",
    display: "standalone",
    background_color: "#fbf9f6",
    theme_color: "#24160e",
    icons: [
      {
        src: "/brand/wild-bean-logo.jpg",
        sizes: "512x512",
        type: "image/jpeg",
        purpose: "any",
      },
    ],
    orientation: "portrait",
    categories: ["business", "productivity"],
  };
}
