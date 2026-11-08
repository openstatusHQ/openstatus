import type { Metadata } from "next";

import type { MDXData } from "../../content/utils";

export const TITLE = "openstatus";
export const HOMEPAGE_TITLE =
  "Open Source Status Page, Uptime Monitoring & Incident Response";
export const DESCRIPTION =
  "Open source status page, incident response and global uptime monitoring. When something breaks, your subscribers hear it first and your auditor gets the trail.";

export const OG_DESCRIPTION =
  "Status pages and incident response for humans and agents";

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

// Every HTML page has a markdown twin at `<path>.md` (see next.config.ts
// rewrites); advertising it lets agents find it without guessing the suffix.
export const markdownAlternate = (path: string) => ({
  types: { "text/markdown": `${BASE_URL}${path === "/" ? "/index" : path}.md` },
});

export const getPageMetadata = (page: MDXData, basePath?: string): Metadata => {
  const { slug, metadata } = page;
  const { title, description, category, publishedAt, updatedAt, seo } =
    metadata;

  const path = basePath ? `/${basePath}/${slug}` : `/${slug}`;
  const url = `${BASE_URL}${path}`;

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
      ...markdownAlternate(path),
    },
    ...(seo?.noindex ? { robots: { index: false } } : {}),
    openGraph: {
      ...openGraph,
      type: "article",
      publishedTime: publishedAt.toISOString(),
      modifiedTime: (updatedAt ?? publishedAt).toISOString(),
    },
    twitter,
  };
};

// Index/listing routes have no MDX file; title, description and path come
// from `content/sections.ts` so the markdown twin shows the same words.
export const getListingMetadata = (args: {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
}): Metadata => {
  const { title, description, path, ogImage } = args;
  return {
    ...defaultMetadata,
    title,
    description,
    alternates: { canonical: path, ...markdownAlternate(path) },
    ...getSocialMetadata({
      title,
      description,
      url: `${BASE_URL}${path}`,
      ogImage,
    }),
  };
};

// Home sits outside `getPageMetadata`: its canonical is `/`, its title skips
// the `%s | openstatus` template and its OG card is the static one. home.mdx
// owns the words; HOMEPAGE_TITLE/DESCRIPTION are only the root-layout fallback.
export const getHomeMetadata = (page: MDXData): Metadata => {
  const { title, description, category, seo } = page.metadata;
  const metaTitle = seo?.title ?? title;
  const metaDescription = seo?.description ?? description;

  return {
    ...defaultMetadata,
    title: { absolute: metaTitle },
    description: metaDescription,
    alternates: {
      canonical: seo?.canonical ?? "/",
      ...markdownAlternate("/"),
    },
    ...(seo?.noindex ? { robots: { index: false } } : {}),
    ...getSocialMetadata({
      title: metaTitle,
      description: metaDescription,
      url: BASE_URL,
      category,
      ogImage: seo?.ogImage ?? `${BASE_URL}/api/og`,
    }),
  };
};
