import sitemap from "@astrojs/sitemap";
import starlight from "@astrojs/starlight";
import tailwind from "@astrojs/tailwind";
// @ts-check
import { defineConfig } from "astro/config";
import starlightSidebarTopics from "starlight-sidebar-topics";
import Icons from "unplugin-icons/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://docs.openstatus.dev",
  vite: {
    plugins: [Icons({ compiler: "astro" })],
  },
  integrations: [
    sitemap(),
    starlight({
      title: "OpenStatus Documentation",
      favicon: "/favicon.ico",
      social: {
        github: "https://github.com/openstatusHQ/openstatus",
        blueSky: "https://bsky.app/profile/openstatus.dev",
      },
      components: {
        SiteTitle: "./src/components/SiteTitle.astro",
        Head: "./src/components/Head.astro",
        Hero: "./src/components/Hero.astro",
      },
      editLink: {
        baseUrl: "https://github.com/openstatusHQ/openstatus/app/docs",
      },
      customCss: [
        // Path to your Tailwind base styles:
        "./src/tailwind.css",
        "./src/custom.css",
      ],
      plugins: [
        starlightSidebarTopics([
          {
            label: "Documentation",
            link: "/getting-started/introduction",
            id: "docs",
            icon: "open-book",
            items: [
              {
                label: "Getting Started",
                items: [
                  {
                    label: "Introduction",
                    slug: "getting-started/introduction",
                  },
                ],
              },
              {
                label: "Synthetic Monitoring",
                items: [
                  { label: "Overview", slug: "monitoring/overview" },
                  {
                    label: "Create you first monitor",
                    slug: "monitoring/create-monitor",
                  },
                  {
                    label: "Monitor Types",
                    collapsed: true,
                    items: [
                      {
                        label: "HTTP",
                        slug: "monitoring/type/http",
                      },
                      {
                        label: "TCP",
                        slug: "monitoring/type/tcp",
                      },
                    ],
                  },
                  {
                    label: "Customizations",
                    collapsed: true,
                    items: [
                      {
                        label: "Assertions",
                        slug: "monitoring/customization/assertions",
                      },
                      {
                        label: "Frequency",
                        slug: "monitoring/customization/frequency",
                      },
                      {
                        label: "Regions",
                        slug: "monitoring/customization/regions",
                      },
                      {
                        label: "Timing",
                        slug: "monitoring/customization/timing",
                      },
                    ],
                  },
                ],
                collapsed: false,
              },
              {
                label: "Status Page",

                items: [
                  { label: "Overview", slug: "status-page/overview" },
                  { label: "Reports", slug: "status-page/reports" },
                  { label: "Maintenances", slug: "status-page/maintenances" },
                  { label: "Widget", slug: "status-page/widget" },
                  { label: "Custom Domain", slug: "status-page/custom-domain" },
                  {
                    label: "Subscribers",
                    slug: "status-page/subscribers",
                  },
                  {
                    label: "Customization",
                    autogenerate: { directory: "status-page/customization" },
                    collapsed: true,
                  },
                ],
              },
              { label: "Incidents", autogenerate: { directory: "incident" } },
              {
                label: "Alerting",
                items: [
                  { label: "Overview", slug: "alerting/overview" },
                  {
                    label: "Notification Channels",
                    autogenerate: {
                      directory: "alerting/providers",
                      collapsed: true,
                    },
                  },
                ],
              },
              {
                label: "Tools",
                autogenerate: { directory: "tools" },
              },
              {
                label: "Support",
                items: [
                  {
                    label: "Help",
                    slug: "help/support",
                    collapsed: true,
                  },
                ],
              },
            ],
          },
          {
            label: "Guides",
            icon: "rocket",
            link: "/guides/introduction",
            items: [
              {
                label: "Guides",
                autogenerate: { directory: "guides" },
              },
            ],
          },
          {
            label: "Contributing",
            icon: "heart",
            link: "/contributing/getting-started",
            items: [
              {
                label: "Contributing",
                autogenerate: { directory: "contributing" },
              },
            ],
          },
          {
            label: "CLI",
            icon: "seti:powershell",
            link: "/cli/getting-started",
            items: [
              {
                label: "CLI",
                items: [
                  {
                    label: "Getting Started",
                    slug: "cli/getting-started",
                  },
                  {
                    label: "Commands",
                    autogenerate: { directory: "cli/commands" },
                  },
                ],
              },
            ],
          },
          {
            label: "API Reference",
            icon: "puzzle",
            link: "https://api.openstatus.dev/v1",
          },
        ]),
      ],
    }),
    tailwind({
      // Disable the default base styles:
      applyBaseStyles: false,
    }),
  ],
});
