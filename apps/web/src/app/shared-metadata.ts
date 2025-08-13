import type { Metadata } from "next";

export const TITLE = "openstatus";
export const DESCRIPTION =
  "Monitor your API and website globally. Showcase your reliability with a public status page. Get started for free with our open-source uptime and synthetic monitoring platform!";

export const OG_DESCRIPTION =
  "Open-source status page and uptime monitoring system";

export const defaultMetadata: Metadata = {
  title: {
    template: `%s | ${TITLE}`,
    default: TITLE,
  },
  description: DESCRIPTION,
  metadataBase: new URL("https://www.openstatus.dev"),
};

export const twitterMetadata: Metadata["twitter"] = {
  title: TITLE,
  description: DESCRIPTION,
  card: "summary_large_image",
  images: ["/api/og"],
};

export const ogMetadata: Metadata["openGraph"] = {
  title: TITLE,
  description: DESCRIPTION,
  type: "website",
  images: ["/api/og"],
};
