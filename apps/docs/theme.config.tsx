import type { DocsThemeConfig } from "nextra-theme-docs";

const config: DocsThemeConfig = {
  logo: <span>OpenStatus</span>,
  project: {
    link: "https://github.com/openstatusHQ/openstatus",
  },
  chat: {
    link: "https://discord.com/invite/dHD4JtSfsn",
  },
  docsRepositoryBase:
    "https://github.com/openstatusHQ/openstatus/tree/main/apps/docs",
  footer: {
    text: "OpenStatus Documentation",
  },
  useNextSeoProps() {
    return {
      titleTemplate: "%s | OpenStatus Documentation",
      description: "An Open Source alternative for your next Status Page",
      openGraph: {
        url: "https://openstatus.dev/api/og",
        title: "OpenStatus Documentation",
        description: "An Open Source alternative for your next Status Page",
      },
      twitter: {
        cardType: 'summary_large_image',
        site: 'https://nextra.vercel.app'
      },
    };
  },
};

export default config;
