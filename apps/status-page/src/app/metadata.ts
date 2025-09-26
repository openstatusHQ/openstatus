import type { Metadata } from "next";

export const TITLE = "Theme explorer by openstatus";
export const DESCRIPTION =
  "Easily customize your status page using our built-in themes. Explore our themes and contribute new ones to the community.";

const OG_TITLE = "Theme explorer by openstatus";
const OG_DESCRIPTION = "Easily customize your status page with our built-in themes.";
const FOOTER = "themes.openstatus.dev";
const IMAGE = "assets/og/dashboard-v2.png";

export const defaultMetadata: Metadata = {
  title: {
    template: `%s | ${TITLE}`,
    default: TITLE,
  },
  icons: "https://www.openstatus.dev/favicon.ico",
  description: DESCRIPTION,
  metadataBase: new URL("https://www.openstatus.dev"),
};

export const twitterMetadata: Metadata["twitter"] = {
  title: TITLE,
  description: DESCRIPTION,
  card: "summary_large_image",
  images: [
    `/api/og?title=${OG_TITLE}&description=${OG_DESCRIPTION}&footer=${FOOTER}&image=${IMAGE}`,
  ],
};

export const ogMetadata: Metadata["openGraph"] = {
  title: TITLE,
  description: DESCRIPTION,
  type: "website",
  images: [
    `/api/og?title=${OG_TITLE}&description=${OG_DESCRIPTION}&footer=${FOOTER}&image=${IMAGE}`,
  ],
};
