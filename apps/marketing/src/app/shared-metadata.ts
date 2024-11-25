import type { Metadata } from "next";

export const TITLE = "OpenStatus";
export const DESCRIPTION =
  "A better way to monitor your API and your website. Don't let downtime or a slow response time ruin your user experience. Try the open-source synthetic monitoring platform for free!";

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
