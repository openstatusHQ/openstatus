import starlight from "@astrojs/starlight";
import tailwind from "@astrojs/tailwind";
// @ts-check
import { defineConfig } from "astro/config";
import starlightSidebarTopics from "starlight-sidebar-topics";

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      title: "OpenStatus",
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
                  { label: "Overview", slug: "monitoring/intro" },
                  {
                    label: "Create you first monitor",
                    slug: "monitoring/create-monitor",
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
                        label: "Headers",
                        slug: "monitoring/customization/headers",
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
                  {
                    label: "Monitor Types",
                    collapsed: true,
                    items: [
                      {
                        label: "HTTP Monitor",
                        slug: "monitoring/type/http",
                      },
                      {
                        label: "TCP Monitor",
                        slug: "monitoring/type/tcp",
                      },
                    ],
                  },
                ],
                collapsed: false,
              },
              {
                label: "Status Page",

                items: [
                  { label: "Overview", slug: "status-page/status-page" },
                  {
                    label: "Subscribers",
                    slug: "status-page/status-page-subscribers",
                  },
                  { label: "Reports", slug: "status-page/status-report" },

                  { label: "Widget", slug: "status-page/status-widget" },
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
            label: "CLI",
            icon: "seti:shell",
            link: "/cli/introduction",
            items: [
              {
                label: "ClI",
                autogenerate: { directory: "cli" },
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
