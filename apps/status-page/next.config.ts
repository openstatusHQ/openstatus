import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      new URL("https://openstatus.dev/**"),
      new URL("https://**.public.blob.vercel-storage.com/**"),
    ],
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source:
            "/:path((?!api|assets|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
          has: [
            {
              type: "host",
              value:
                process.env.NODE_ENV === "production"
                  ? "(?<subdomain>[^.]+)\\.stpg\\.dev"
                  : "(?<subdomain>[^.]+)\\.localhost",
            },
          ],
          missing: [
            {
              type: "host",
              value:
                process.env.NODE_ENV === "production"
                  ? "www\\.stpg\\.dev"
                  : "www\\.localhost",
            },
          ],
          destination: "/:subdomain/:path*",
        },
      ],
    };
  },
};

export default nextConfig;
