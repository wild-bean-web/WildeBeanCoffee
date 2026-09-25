import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Standalone is for the container host. Vercel serves the Next build output, and
  // standalone mode leaves that deployment with no routes.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  poweredByHeader: false,
  transpilePackages: ["pdfjs-dist"],
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    const commonHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      {
        key: "Permissions-Policy",
        value:
          "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
      },
    ];

    return [
      {
        // PDF originals must be viewable inline. Chrome's viewer treats
        // object-src 'none' and X-Frame-Options DENY as a broken document.
        source: "/api/documents/:id",
        headers: [
          ...commonHeaders,
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'; base-uri 'self'",
          },
        ],
      },
      {
        source: "/((?!api/documents/).*)",
        headers: [
          ...commonHeaders,
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
