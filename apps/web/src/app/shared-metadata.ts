import type { MDXData } from "@/content/utils";
import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type { Metadata } from "next";
import type {
  BlogPosting,
  Organization,
  Product,
  WebPage,
  WithContext,
} from "schema-dts";

export const TITLE = "openstatus";
export const DESCRIPTION =
  "Monitor your services globally and showcase your uptime with a status page. Get started for free with our open-source status page with uptime monitoring solution.";

export const OG_DESCRIPTION =
  "Open-source status page and uptime monitoring system";

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
    default: TITLE,
  },
  description: DESCRIPTION,
  metadataBase: new URL(BASE_URL),
  twitter: twitterMetadata,
  openGraph: ogMetadata,
};

export const getPageMetadata = (page: MDXData): Metadata => {
  const { slug, metadata } = page;
  const { title, description, category, publishedAt } = metadata;

  const ogImage = `${BASE_URL}/api/og?title=${encodeURIComponent(
    title,
  )}&description=${encodeURIComponent(
    description,
  )}&category=${encodeURIComponent(category)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: publishedAt.toISOString(),
      url: `${BASE_URL}/changelog/${slug}`,
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

export const getJsonLDWebPage = (page: MDXData): WithContext<WebPage> => {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${page.metadata.title} | openstatus`,
    headline: page.metadata.description,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": "https://www.openstatus.dev",
    },
  };
};

export const getJsonLDBlogPosting = (
  post: MDXData,
): WithContext<BlogPosting> => {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.metadata.title,
    datePublished: post.metadata.publishedAt.toISOString(),
    dateModified: post.metadata.publishedAt.toISOString(),
    description: post.metadata.description,
    image: post.metadata.image
      ? `${BASE_URL}${post.metadata.image}`
      : `/api/og?title=${encodeURIComponent(
          post.metadata.title,
        )}&description=${encodeURIComponent(
          post.metadata.description,
        )}&category=${encodeURIComponent(post.metadata.category)}`,
    url: `${BASE_URL}/blog/${post.slug}`,
    author: {
      "@type": "Person",
      name: post.metadata.author,
    },
  };
};

export const getJsonLDOrganization = (): WithContext<Organization> => {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "openstatus",
    url: "https://openstatus.dev",
    logo: "https://openstatus.dev/assets/logos/OpenStatus-Logo.svg",
    sameAs: [
      "https://github.com/openstatushq",
      "https://linkedin.com/company/openstatus",
      "https://bsky.app/profile/openstatus.dev",
      "https://x.com/openstatushq",
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "Support",
        email: "ping@openstatus.dev",
      },
    ],
  };
};

export const getJsonLDProduct = (): WithContext<Product> => {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "openstatus",
    description:
      "Open-source uptime and synthetic monitoring with status pages.",
    brand: {
      "@type": "Brand",
      name: "openstatus",
      logo: "https://openstatus.dev/assets/logos/OpenStatus-Logo.svg",
    },
    offers: Object.entries(allPlans).map(([_, value]) => ({
      "@type": "Offer",
      price: value.price.USD,
      name: value.title,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    })),
  };
};
