import type { Metadata } from "next";

import type { MDXData } from "@/content/utils";

export const TITLE = "openstatus";
export const HOMEPAGE_TITLE = "The Compliance-First Status Page";
export const DESCRIPTION =
  "Ship your status page before your SOC 2 auditor asks for it. Communicate incidents, prove compliance readiness, and monitor uptime from 28 global regions. Open source and free to start.";

export const OG_DESCRIPTION = "The status page for compliance-ready teams";

export const BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://www.openstatus.dev"
    : "http://localhost:3000";

export const APP_URL = "https://app.openstatus.dev";

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

// Next merges metadata shallowly per field, so a page must emit its own
// og/twitter blocks or it inherits the root layout's generic ones wholesale.
export const getSocialMetadata = (args: {
  title: string;
  description: string;
  url: string;
  category?: string;
  ogImage?: string;
}): Pick<Metadata, "openGraph" | "twitter"> => {
  const { title, description, url, category, ogImage: ogImageOverride } = args;

  const searchParams = new URLSearchParams({ title, description });
  if (category) searchParams.set("category", category);
  const ogImage =
    ogImageOverride ?? `${BASE_URL}/api/og?${searchParams.toString()}`;

  return {
    openGraph: {
      title,
      description,
      type: "website",
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

export const getPageMetadata = (page: MDXData, basePath?: string): Metadata => {
  const { slug, metadata } = page;
  const { title, description, category, publishedAt, seo } = metadata;

  const url = basePath
    ? `${BASE_URL}/${basePath}/${slug}`
    : `${BASE_URL}/${slug}`;

  const metaTitle = seo?.title ?? title;
  const metaDescription = seo?.description ?? description;

  const { openGraph, twitter } = getSocialMetadata({
    title: metaTitle,
    description: metaDescription,
    url,
    category,
    ogImage: seo?.ogImage,
  });

  return {
    // `absolute` bypasses the `%s | openstatus` template so the override is verbatim
    title: seo?.title ? { absolute: seo.title } : title,
    description: metaDescription,
    alternates: {
      canonical: seo?.canonical ?? url,
    },
    ...(seo?.noindex ? { robots: { index: false } } : {}),
    openGraph: {
      ...openGraph,
      type: "article",
      publishedTime: publishedAt.toISOString(),
    },
    twitter,
  };
};
