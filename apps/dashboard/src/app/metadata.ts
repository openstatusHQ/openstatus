import type { Metadata } from "next";

export const TITLE = "OpenStatus Template";
export const DESCRIPTION =
  "We've created this template to help you get started with your @shadcn/ui project. It uses @nextjs in an SPA mode and can be exported statically (BYO router).";

const OG_TITLE = "OpenStatus Template";
const OG_DESCRIPTION = "Quick start template for your shadcn/ui project.";
const FOOTER = "template.openstatus.dev";

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
