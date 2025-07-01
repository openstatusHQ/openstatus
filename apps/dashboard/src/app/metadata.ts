import type { Metadata } from "next";

export const TITLE = "OpenStatus";
export const DESCRIPTION =
  "OpenStatus is an open-source platform to monitor your services and keep your users informed.";

const OG_TITLE = "OpenStatus";
const OG_DESCRIPTION = "Monitor your services and keep your users informed.";
const FOOTER = "app.openstatus.dev";

export const defaultMetadata: Metadata = {
  title: {
    template: `%s | ${TITLE}`,
    default: TITLE,
  },
  description: DESCRIPTION,
  metadataBase: new URL("https://app.openstatus.dev"),
};

export const twitterMetadata: Metadata["twitter"] = {
  title: TITLE,
  description: DESCRIPTION,
  card: "summary_large_image",
  images: [
    `/api/og?title=${OG_TITLE}&description=${OG_DESCRIPTION}&footer=${FOOTER}`,
  ],
};

export const ogMetadata: Metadata["openGraph"] = {
  title: TITLE,
  description: DESCRIPTION,
  type: "website",
  images: [
    `/api/og?title=${OG_TITLE}&description=${OG_DESCRIPTION}&footer=${FOOTER}`,
  ],
};
