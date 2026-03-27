import { fileURLToPath } from "node:url";
// @ts-check
import sitemap from "@astrojs/sitemap";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";
import starlightImageZoom from "starlight-image-zoom";
import starlightLinksValidator from "starlight-links-validator";
import starlightLlmsTxt from "starlight-llms-txt";
import Icons from "unplugin-icons/vite";

import config from "./src/config/config.json";
import sidebar from "./src/config/sidebar.json";
import social from "./src/config/social.json";

const { site } = config;
const { title, logo, logo_darkmode } = site;

// https://astro.build/config
export default defineConfig({
  site: "https://docs.openstatus.dev",
  vite: {
    plugins: /** @type {any} */ ([Icons({ compiler: "astro" }), tailwindcss()]),
    ssr: {
      noExternal: ["zod"],
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "~": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  },
  image: {
    service: { entrypoint: "astro/assets/services/noop" },
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
      title,
      favicon: "/favicon.ico",
      logo: {
        light: logo,
        dark: logo_darkmode,
        alt: "OpenStatus Logo",
      },
      // @ts-ignore
      social: social.main || [],
      sidebar: sidebar.main || [],
      customCss: ["./src/styles/global.css"],
      components: {
        Head: "./src/components/override-components/Head.astro",
        Header: "./src/components/override-components/Header.astro",
        Hero: "./src/components/override-components/Hero.astro",
        PageFrame: "./src/components/override-components/PageFrame.astro",
        PageSidebar: "./src/components/override-components/PageSidebar.astro",
        TwoColumnContent:
          "./src/components/override-components/TwoColumnContent.astro",
        ContentPanel: "./src/components/override-components/ContentPanel.astro",
        Pagination: "./src/components/override-components/Pagination.astro",
        Sidebar: "./src/components/override-components/Sidebar.astro",
        Footer: "./src/components/Footer.astro",
      },
      editLink: {
        baseUrl: "https://github.com/openstatusHQ/openstatus/app/docs",
      },
      plugins: [
        starlightLinksValidator({
          errorOnLocalLinks: false,
        }),
        starlightLlmsTxt({
          projectName: "openstatus docs",
          description:
            "openstatus is an open-source status page platform with global monitoring (HTTP, TCP, DNS).",
        }),
        starlightImageZoom(),
      ],
    }),
  ],
});
