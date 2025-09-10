import sitemap from "@astrojs/sitemap";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";
import starlightImageZoom from "starlight-image-zoom";
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
      title: "OpenStatus Documentation",
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
      ],
      sidebar: [
        {
          label: "Concepts",
          items: [
            {
              label: "Uptime monitoring",
              slug: "getting-started/introduction",
            },
            {
              label: "Status pages",
              slug: "getting-started/introduction",
            },
          ],
        },
        {label: "Tutorials",
        items: [

          {
            label: "How to create a monitor",
            slug: "tutorial/how-to-create-monitor",
          },
          {
            label: "How to create a status page",
            slug: "tutorial/how-to-create-status-page",
          },
        ]},
        {label: "Reference",
          items:[
            {
              label: "HTTP Monitor",
              slug: "reference/http-monitor",
            },
            {
              label: "TCP Monitor",
              slug: "getting-started/introduction",
            },
            {
              label: "Status Page",
              slug: "getting-started/introduction",
            },
            {
              label: "Status Report",
              slug: "getting-started/introduction",
            },
            {
              label: "CLI Reference",
              slug: "getting-started/introduction",
            },
            {label: "API Reference",
              link: "https://api.openstatus.dev/v1",
             attrs: {
               target: "_blank",
             }}

          ]},
        {label: "Guides",
        items: [

          {
            label: "Monitor your MCP Server",
            slug: "guides/how-to-monitor-mcp-server",
          },
          {
            label: "Run check in GitHub Actions",
            slug: "guides/how-to-run-synthetic-test-github-action",
          },
        ]},
      ],
      plugins: [

        starlightLlmsTxt({
          projectName: "OpenStatus Documentation",
          description:
            "OpenStatus is an open-source global uptime monitoring platform that offers a status page and monitoring as code.",
        }),
        starlightImageZoom(),
      ],
    }),
  ],
});
