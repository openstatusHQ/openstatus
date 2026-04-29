import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// REMINDER: avoid Clickjacking attacks by setting the frame-ancestors directive
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'self' https://shoogle.dev",
  },
];

// Link headers for agent discovery (RFC 8288 / RFC 8631).
// service-doc: human-readable docs. service-desc: machine-readable API description.
const homepageLinkHeader = [
  '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
  '</.well-known/agent-skills/index.json>; rel="agent-skills"; type="application/json"',
  '<https://docs.openstatus.dev>; rel="service-doc"; type="text/html"',
  '<https://api.openstatus.dev/openapi>; rel="service-desc"; type="application/json"',
  '<https://www.openstatus.dev/llms.txt>; rel="describedby"; type="text/plain"',
  '<https://www.openstatus.dev/terms>; rel="terms-of-service"',
  '<https://www.openstatus.dev/privacy>; rel="privacy-policy"',
].join(", ");

const agentDiscoveryHeaders = [
  {
    key: "Link",
    value: homepageLinkHeader,
  },
];

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@openstatus/ui", "@openstatus/api", "next-mdx-remote"],
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
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/", headers: agentDiscoveryHeaders },
    ];
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
        source: "/api-monitoring",
        destination: "/uptime-monitoring",
        permanent: true,
      },
      {
        source: "/monitoring-as-code",
        destination: "/uptime-monitoring",
        permanent: true,
      },
      {
        source: "/private-locations",
        destination: "/uptime-monitoring",
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
        // Markdown content negotiation for AI tools
        {
          source: "/:path*",
          destination: "/api/markdown/:path*",
          has: [
            {
              type: "header",
              key: "accept",
              value: "(.*)text/markdown(.*)",
            },
          ],
        },
      ],
    };
  },
};

// For detailed options, refer to the official documentation:
// - Webpack plugin options: https://github.com/getsentry/sentry-webpack-plugin#options
// - Next.js Sentry setup guide: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
const sentryConfig = {
  // Prevent log output unless running in a CI environment (helps reduce noise in logs)
  silent: !process.env.CI,
  org: "openstatus",
  project: "openstatus",
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload a larger set of source maps for improved stack trace accuracy (increases build time)
  widenClientFileUpload: true,

  // If set to true, transpiles Sentry SDK to be compatible with IE11 (increases bundle size)
  transpileClientSDK: false,

  // Tree-shake Sentry logger statements to reduce bundle size
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
};

export default withSentryConfig(nextConfig, sentryConfig);
