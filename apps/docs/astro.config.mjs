import sitemap from "@astrojs/sitemap";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";
import starlightImageZoom from "starlight-image-zoom";
import starlightLinksValidator from "starlight-links-validator";
import starlightLlmsTxt from "starlight-llms-txt";

import Icons from "unplugin-icons/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://docs.openstatus.dev",
  vite: {
    plugins: [Icons({ compiler: "astro" }), tailwindcss()],
  },
  env: {
    schema: {
      NEXT_PUBLIC_OPENPANEL_CLIENT_ID: envField.string({
        access: "public",
        context: "client",
      }),
    },
  },
  integrations: [
    sitemap(),
    starlight({
      title: "openstatus docs",
      favicon: "/favicon.ico",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/openstatusHQ/openstatus",
        },
        {
          icon: "discord",
          label: "Discord",
          href: "https://www.openstatus.dev/discord",
        },
        {
          icon: "blueSky",
          label: "BlueSky",
          href: "https://bsky.app/profile/openstatus.dev",
        },
      ],
      components: {
        SiteTitle: "./src/components/SiteTitle.astro",
        Head: "./src/components/Head.astro",
        Hero: "./src/components/Hero.astro",
        Footer: "./src/components/Footer.astro",
      },
      editLink: {
        baseUrl: "https://github.com/openstatusHQ/openstatus/app/docs",
      },
      customCss: [
        // Path to your Tailwind base styles:
        "./src/global.css",
        "./src/custom.css",
        "@fontsource-variable/inter",
      ],
      sidebar: [
        {
          label: "Concepts",
          items: [
            {
              label: "About Uptime monitoring",
              slug: "concept/uptime-monitoring",
            },
            {
              label: "Best Practices for Status Pages",
              slug: "concept/best-practices-status-page",
            },
            {
              label: "Uptime Calculation and Values",
              slug: "concept/uptime-calculation-and-values",
            },
            {
              label: "Uptime Monitoring as Code",
              slug: "concept/uptime-monitoring-as-code",
            },
            {
              label: "Latency vs Response Time",
              slug: "concept/latency-vs-response-time",
            },
          ],
        },
        {
          label: "Tutorials",
          items: [
            {
              label: "How to create a monitor",
              slug: "tutorial/how-to-create-monitor",
            },
            {
              label: "How to create a status page",
              slug: "tutorial/how-to-create-status-page",
            },
            {
              label: "How to configure a status page",
              slug: "tutorial/how-to-configure-status-page",
            },
            {
              label: "How to create a private location (beta)",
              slug: "tutorial/how-to-create-private-location",
            },
            {
              label: "Get Started with OpenStatus CLI",
              slug: "tutorial/get-started-with-openstatus-cli",
            },
            {
              label: "How to set up the Slack Agent",
              slug: "tutorial/how-to-setup-slack-agent",
            },
          ],
        },

        {
          label: "Guides",
          items: [
            {
              label: "Monitor your MCP Server",
              slug: "guides/how-to-monitor-mcp-server",
            },
            {
              label: "Run check in GitHub Actions",
              slug: "guides/how-to-run-synthetic-test-github-action",
            },
            {
              label: "Export Metrics to your OTLP Endpoint",
              slug: "guides/how-to-export-metrics-to-otlp-endpoint",
            },
            {
              label: "How to Add an SVG Status Badge to your GitHub README",
              slug: "guides/how-to-add-svg-status-badge",
            },
            {
              label: "How to use React Status Widget",
              slug: "guides/how-to-use-react-widget",
            },
            {
              label: "How to deploy probes on Cloudflare Containers ",
              slug: "guides/how-to-deploy-probes-cloudflare-containers",
            },
            {
              label: "How to self-host openstatus",
              slug: "guides/self-hosting-openstatus",
            },
            {
              label: "Self host Status Page only",
              slug: "guides/self-host-status-page-only",
            },
          ],
        },
        {
          label: "SDK",
          items: [
            {
              label: "Node SDK",
              autogenerate: { directory: "sdk/nodejs" },
              collapsed: true,
            },
          ],
        },
        {
          label: "Reference",
          items: [
            {
              label: "CLI Reference",
              slug: "reference/cli-reference",
            },
            {
              label: "API Reference V1 - Deprecated",
              link: "https://api.openstatus.dev/v1",
              // badge: { text: 'External' },
              attrs: {
                target: "_blank",
              },
            },
            {
              label: "API Reference V2",
              link: "https://api.openstatus.dev/openapi",
              // badge: { text: 'External' },
              attrs: {
                target: "_blank",
              },
            },
            {
              label: "DNS Monitor",
              slug: "reference/dns-monitor",
            },
            {
              label: "HTTP Monitor",
              slug: "reference/http-monitor",
            },
            {
              label: "Incident",
              slug: "reference/incident",
            },
            {
              label: "TCP Monitor",
              slug: "reference/tcp-monitor",
            },
            {
              label: "Notification",
              slug: "reference/notification",
            },
            {
              label: "Location",
              slug: "reference/location",
            },
            {
              label: "Private location",
              slug: "reference/private-location",
            },
            {
              label: "Status Page",
              slug: "reference/status-page",
            },
            {
              label: "Page Components",
              slug: "reference/page-components",
            },
            {
              label: "Status Report",
              slug: "reference/status-report",
            },
            {
              label: "Subscriber",
              slug: "reference/subscriber",
            },
            {
              label: "Terraform Provider",
              slug: "reference/terraform",
            },
          ],
        },
      ],
      plugins: [
        starlightLlmsTxt({
          projectName: "openstatus docs",
          description:
            "openstatus is an open-source global uptime monitoring platform that offers a status page and monitoring as code.",
        }),
        starlightImageZoom(),
        starlightLinksValidator({
          errorOnLocalLinks: false,
        }),
      ],
    }),
  ],
});
