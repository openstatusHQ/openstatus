import type { MDXData } from "@/content/utils";
import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type { Metadata } from "next";
import type {
  BlogPosting,
  BreadcrumbList,
  FAQPage,
  Organization,
  Product,
  WebPage,
  WithContext,
} from "schema-dts";

export const TITLE = "openstatus";
export const HOMEPAGE_TITLE =
  "OpenStatus - Open-Source Status Page & Uptime Monitoring";
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
  basePath: string,
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
    url: `${BASE_URL}/${basePath}/${post.slug}`,
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

export const getJsonLDBreadcrumbList = (
  items: { name: string; url: string }[],
): WithContext<BreadcrumbList> => {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
};

export const getJsonLDFAQPage = (): WithContext<FAQPage> => {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What are the free limits?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "As free user you will start with a total of one monitor and one status page (incl. three page components) as well as cron jobs of min. 10m. You can upgrade to a paid plan at any time. No credit card is required to sign up and you can cancel at any time.",
        },
      },
      {
        "@type": "Question",
        name: "Who are we?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "We are Thibault and Max and we take you with us on our journey. Read more on our about page at https://www.openstatus.dev/about.",
        },
      },
      {
        "@type": "Question",
        name: "How does it work?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "We ping your endpoints from multiple regions to calculate uptime and display the current status on your status page. We also collect response time data like headers and timing phases and display it on your dashboard.",
        },
      },
      {
        "@type": "Question",
        name: "What regions do we support?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "We support monitoring from 28 regions worldwide across all continents: Europe (Amsterdam, Stockholm, Paris, Frankfurt, London), North America (Dallas, New Jersey, Los Angeles, San Jose, Chicago, Toronto), South America (São Paulo), Asia (Mumbai, Tokyo, Singapore), Africa (Johannesburg), and Oceania (Sydney).",
        },
      },
      {
        "@type": "Question",
        name: "How can I help?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "There are many ways you can help us: Spread the word by telling your friends and colleagues about OpenStatus, report bugs if you find them, suggest new features, contribute to the project if you are a developer, become a paid user if you are a business, or star our project on GitHub.",
        },
      },
    ],
  };
};
