import sitemap from "@astrojs/sitemap";
import starlight from "@astrojs/starlight";
import tailwind from "@astrojs/tailwind";
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
        discord: "https://www.openstatus.dev/discord",
      },
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
        "./src/tailwind.css",
        "./src/custom.css",
      ],
      plugins: [
        starlightSidebarTopics([
          {
            label: "Documentation",
            link: "/",
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
                    label: "Create a synthetic check",
                    slug: "monitoring/create-monitor",
                  },
                  {
                    label: "View your results data",
                    slug: "monitoring/monitor-data-collected",
                  },
                  {
                    label: "Group your checks",
                    slug: "monitoring/group-monitor-tag",
                  },
                  {
                    label: "Clone a check",
                    slug: "monitoring/clone-monitor",
                  },
                  {
                    label: "OpenTelemetry",
                    slug: "monitoring/opentelemetry",
                  },
                  {
                    label: "Check Types",
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
                        label: "Notifications",
                        slug: "monitoring/customization/notification",
                      },
                      {
                        label: "Locations",
                        slug: "monitoring/customization/locations",
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
                collapsed: true,

                items: [
                  { label: "Overview", slug: "status-page/overview" },
                  {
                    label: "Create your status page",
                    slug: "status-page/create-status-page",
                  },

                  {
                    label: "Work with Status Page",
                    autogenerate: { directory: "status-page/work" },
                    collapsed: false,
                  },
                  {
                    label: "Advanced",
                    autogenerate: { directory: "status-page/advanced" },
                    collapsed: true,
                  },
                ],
              },
              {
                label: "Incidents",
                collapsed: true,
                items: [
                  { label: "Overview", slug: "incident/overview" },
                  {
                    label: "Work with incident",
                    slug: "incident/work-with-incident",
                  },

                  {
                    label: "Incident Detail",
                    slug: "incident/incident-detail",
                  },
                ],
              },
              {
                label: "Alerting",
                collapsed: true,
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
                label: "Developer Tools",
                collapsed: true,
                autogenerate: { directory: "tools" },
              },
              {
                label: "Support",
                collapsed: true,
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
