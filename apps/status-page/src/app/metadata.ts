import type { Metadata } from "next";

export const TITLE = "openstatus";
export const DESCRIPTION =
  "Use community themes for your status page or contribute your own.";

const OG_TITLE = "Theme Store";
const OG_DESCRIPTION =
  "Use community themes for your status page or contribute your own.";
const FOOTER = "themes.openstatus.dev";
const IMAGE = "assets/og/status-page.png";

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
