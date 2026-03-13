import type { MDXData } from "@/content/utils";
import type { Metadata } from "next";

export const TITLE = "openstatus";
export const HOMEPAGE_TITLE =
  "openstatus - The open-source status page trusted by teams from seed to IPO";
export const DESCRIPTION =
  "Ship your status page before your SOC 2 auditor asks for it. Communicate incidents, prove compliance readiness, and monitor uptime from 28 global regions. Open source and free to start.";

export const OG_DESCRIPTION =
  "The open-source status page for compliance-ready teams";

export const BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://www.openstatus.dev"
    : "http://localhost:3000";

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

export const defaultMetadata: Metadata = {
  title: {
    template: `%s | ${TITLE}`,
    default: HOMEPAGE_TITLE,
  },
  description: DESCRIPTION,
  metadataBase: new URL(BASE_URL),
  alternates: {
    canonical: "/",
  },
  twitter: twitterMetadata,
  openGraph: ogMetadata,
};

export const getPageMetadata = (page: MDXData, basePath?: string): Metadata => {
  const { slug, metadata } = page;
  const { title, description, category, publishedAt } = metadata;

  const ogImage = `${BASE_URL}/api/og?title=${encodeURIComponent(
    title,
  )}&description=${encodeURIComponent(
    description,
  )}&category=${encodeURIComponent(category)}`;

  const url = basePath
    ? `${BASE_URL}/${basePath}/${slug}`
    : `${BASE_URL}/${slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: publishedAt.toISOString(),
      url,
      images: [
        {
          url: ogImage,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
};
