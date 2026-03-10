import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/registro", "/privacidad"],
        disallow: [
          "/admin/",
          "/equipo/",
          "/cliente/",
          "/superadmin/",
          "/api/",
          "/login",
        ],
      },
    ],
    sitemap: "https://isytask-web.vercel.app/sitemap.xml",
  };
}
