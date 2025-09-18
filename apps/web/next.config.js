const { withContentCollections } = require("@content-collections/next");
const { withSentryConfig } = require("@sentry/nextjs");

// REMINDER: avoid Clickjacking attacks by setting the X-Frame-Options header
const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@openstatus/ui", "@openstatus/api"],
  outputFileTracingIncludes: {
    "/": [
      "./node_modules/.pnpm/@google-cloud/tasks/build/esm/src/**/*.json",
      "./node_modules/@google-cloud/tasks/build/esm/src/**/*.js",
    ],
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
    const HOST =
      process.env.NODE_ENV === "development" ? "localhost:3001" : "stpg.dev";
    const PROTOCOL = process.env.NODE_ENV === "development" ? "http" : "https";
    return {
      beforeFiles: [
        // Proxy app subdomain to /app
        {
          source: "/:path*",
          has: [
            {
              type: "host",
              value: "app.openstatus.dev",
            },
          ],
          destination: "/app/:path*",
        },
        // New design: proxy Next.js assets from external host when cookie indicates "new"
        {
          source: "/_next/:path*",
          has: [
            { type: "cookie", key: "sp_mode", value: "new" },
            {
              type: "host",
              value: "(?<slug>[^.]+)\\.(openstatus\\.dev|localhost)",
            },
          ],
          destination: `${PROTOCOL}://${HOST}/_next/:path*`,
        },
        // New design: proxy app routes to external host with slug prefix
        {
          source: "/:path((?!_next/).*)",
          has: [
            { type: "cookie", key: "sp_mode", value: "new" },
            {
              type: "host",
              value: "(?<slug>[^.]+)\\.(openstatus\\.dev|localhost)",
            },
          ],
          // NOTE: might be different on prod and localhost (without :slug)
          destination: `${PROTOCOL}://${HOST}/:slug/:path*`,
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

    // Suppresses source map uploading logs during build
    silent: true,

    org: "openstatus",
    project: "openstatus",
  },
  {
    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Transpiles SDK to be compatible with IE11 (increases bundle size)
    transpileClientSDK: false,

    // Hides source maps from generated client bundles
    hideSourceMaps: true,

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,
  },
);
