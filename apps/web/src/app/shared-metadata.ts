const TITLE = "OpenStatus";
const DESCRIPTION =
  "Open-Source uptime monitoring with beautiful status pages.";

export const defaultMetadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL("https://www.openstatus.dev"),
};

export const twitterMetadata = {
  title: TITLE,
  description: DESCRIPTION,
  card: "summary_large_image",
  images: [`/api/og`],
};

export const ogMetadata = {
  title: TITLE,
  description: DESCRIPTION,
  type: "website",
  images: [`/api/og`],
};
