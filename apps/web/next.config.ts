const { withContentCollections } = require("@content-collections/next");
const { withSentryConfig } = require("@sentry/nextjs");
import type { NextConfig } from "next";

// REMINDER: avoid Clickjacking attacks by setting the X-Frame-Options header
const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@openstatus/ui", "@openstatus/api"],
  outputFileTracingIncludes: {
    "/": [
      "./node_modules/.pnpm/@google-cloud/tasks/build/esm/src/**/*.json",
      "./node_modules/@google-cloud/tasks/build/esm/src/**/*.js",
    ],
  },
  experimental: {
    turbopackScopeHoisting: false,
    // serverMinification:false,
  },
  serverExternalPackages: ["@google-cloud/tasks"],
  expireTime: 180, // 3 minutes
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "screenshot.openstat.us",
      },
      {
        protocol: "https",
        hostname: "www.openstatus.dev",
      },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  async redirects() {
    return [
      {
        source: "/legal/terms",
        destination: "/terms",
        permanent: true,
      },
      {
        source: "/legal/privacy",
        destination: "/privacy",
        permanent: true,
      },
      {
        source: "/features/monitoring",
        destination: "/uptime-monitoring",
        permanent: true,
      },
      {
        source: "/features/status-page",
        destination: "/status-page",
        permanent: true,
      },
      {
        source: "/app/:path*",
        destination: "https://app.openstatus.dev/",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/status-page/themes/:path*",
          destination: "https://www.stpg.dev/:path*",
        },
        {
          source: "/:path*",
          has: [
            {
              type: "host",
              value: "themes.openstatus.dev",
            },
          ],
          destination: "https://www.stpg.dev/:path*",
        },
        // New design: proxy app routes to external host with slug prefix
        {
          source: "/:path*",
          has: [
            { type: "cookie", key: "sp_mode", value: "new" },
            {
              type: "host",
              value: "(?<slug>[^.]+)\\.(openstatus\\.dev|localhost)",
            },
          ],
          destination: "https://:slug.stpg.dev/:path*",
        },
        // Handle custom domains (e.g., status.mxkaske.dev)
        {
          source:
            "/:path((?!api|assets|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
          has: [
            { type: "cookie", key: "sp_mode", value: "new" },
            {
              type: "host",
              value: "^(?!.*\\.openstatus\\.dev$)(?!openstatus\\.dev$)$",
            },
          ],
          destination: "https://www.stpg.dev/:path*",
        },
        // enfore routes to avoid infinite redirects - https://github.com/vercel/vercel/issues/6126#issuecomment-823523122
        // testing with https://validator.w3.org/feed/check.cgi
        {
          source: "/feed/rss",
          has: [
            { type: "cookie", key: "sp_mode", value: "new" },
            {
              type: "host",
              value: "^(?!.*\\.openstatus\\.dev$)(?!openstatus\\.dev$)$",
            },
          ],
          destination: "https://www.stpg.dev/:domain/feed/rss",
        },
        {
          source: "/feed/atom",
          has: [
            { type: "cookie", key: "sp_mode", value: "new" },
            {
              type: "host",
              value: "^(?!.*\\.openstatus\\.dev$)(?!openstatus\\.dev$)$",
            },
          ],
          destination: "https://www.stpg.dev/:domain/feed/atom",
        },
        {
          source: "/feed/rss",
          has: [
            { type: "cookie", key: "sp_mode", value: "new" },
            {
              type: "host",
              value: "^(?<domain>.+)$",
            },
          ],
          destination: "https://www.stpg.dev/:domain/feed/rss",
        },
        {
          source: "/feed/atom",
          has: [
            { type: "cookie", key: "sp_mode", value: "new" },
            {
              type: "host",
              value: "^(?<domain>.+)$",
            },
          ],
          destination: "https://www.stpg.dev/:domain/feed/atom",
        },
        {
          source:
            "/:path((?!api|assets|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|badge|feed|events|monitors|protected|verify).*)",
          has: [
            { type: "cookie", key: "sp_mode", value: "new" },
            {
              type: "host",
              value: "^(?<domain>.+)$",
            },
          ],
          destination: "https://www.stpg.dev/:domain*",
        },
        {
          source:
            "/:path((?!api|assets|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
          has: [
            { type: "cookie", key: "sp_mode", value: "new" },
            {
              type: "host",
              value: "^(?<domain>.+)$",
            },
          ],
          destination: "https://www.stpg.dev/:domain/:path*",
        },
        // Handle API routes for custom domains
        {
          source: "/api/:path*",
          has: [
            { type: "cookie", key: "sp_mode", value: "new" },
            {
              type: "host",
              value:
                "^(?!.*\\.openstatus\\.dev$)(?!openstatus\\.dev$)(?<domain>.+)$",
            },
          ],
          destination: "https://www.stpg.dev/api/:path*",
        },
        // Handle static assets for custom domains
        {
          source: "/_next/:path*",
          has: [
            { type: "cookie", key: "sp_mode", value: "new" },
            {
              type: "host",
              value:
                "^(?!.*\\.openstatus\\.dev$)(?!openstatus\\.dev$)(?<domain>.+)$",
            },
          ],
          destination: "https://www.stpg.dev/_next/:path*",
        },
      ],
    };
  },
};

module.exports = withSentryConfig(
  async () => await withContentCollections(nextConfig),
  {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    // Only print logs for uploading source maps in CI
    // Set to `true` to suppress logs
    silent: !process.env.CI,

    org: "openstatus",
    project: "openstatus",
  },
  {
    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Pass the auth token
    authToken: process.env.SENTRY_AUTH_TOKEN,

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Transpiles SDK to be compatible with IE11 (increases bundle size)
    transpileClientSDK: false,

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,
  },
);
