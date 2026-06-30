import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type {
  AggregateRating,
  BlogPosting,
  BreadcrumbList,
  CollectionPage,
  FAQPage,
  Graph,
  HowTo,
  Organization,
  Person,
  Product,
  Review,
  Service,
  SoftwareApplication,
  TechArticle,
  Thing,
  WebPage,
  WithContext,
} from "schema-dts";

import type { MDXData } from "@/content/utils";

import { BASE_URL } from "./shared-metadata";

export const getJsonLDWebPage = (
  input: MDXData | { name: string; url: string },
): WithContext<WebPage> => {
  if (!("metadata" in input)) {
    return {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: input.name,
      url: input.url,
    };
  }
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${input.metadata.title} | openstatus`,
    headline: input.metadata.description,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": BASE_URL,
    },
  };
};

export const getJsonLDService = (input: {
  name: string;
  url: string;
}): WithContext<Service> => {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: input.name,
    url: input.url,
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

export const getJsonLDTechArticle = (
  doc: MDXData,
): WithContext<TechArticle> => {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: doc.metadata.title,
    description: doc.metadata.description,
    datePublished: doc.metadata.publishedAt.toISOString(),
    dateModified: doc.metadata.publishedAt.toISOString(),
    url: `${BASE_URL}${doc.href}`,
    author: {
      "@type": "Organization",
      name: "openstatus",
      url: BASE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "openstatus",
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/assets/logos/OpenStatus-Logo.svg`,
      },
    },
  };
};

export const getJsonLDOrganization = (): WithContext<Organization> => {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "openstatus",
    url: BASE_URL,
    logo: `${BASE_URL}/assets/logos/OpenStatus-Logo.svg`,
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

// Sourced from https://www.trustpilot.com/review/openstatus.dev
const trustpilotReviews: Review[] = [
  {
    "@type": "Review",
    reviewRating: {
      "@type": "Rating",
      ratingValue: 5,
      bestRating: 5,
      worstRating: 1,
    },
    author: {
      "@type": "Person",
      name: "Johannes",
    },
    datePublished: "2024-06-11",
    name: "Open source status page which works super well!",
    reviewBody:
      "Love that we have an open source alternative for our status page at Formbricks! Great team and execution, big fan of openstatus!",
  },
];

const trustpilotAggregateRating: AggregateRating = {
  "@type": "AggregateRating",
  ratingValue: 5,
  bestRating: 5,
  worstRating: 1,
  reviewCount: trustpilotReviews.length,
};

export const getJsonLDProduct = (): WithContext<Product> => {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "openstatus",
    description:
      "The open-source status page and uptime monitoring platform trusted by growing teams.",
    image: `${BASE_URL}/assets/logos/OpenStatus-Logo.svg`,
    url: BASE_URL,
    brand: {
      "@type": "Brand",
      name: "openstatus",
      logo: `${BASE_URL}/assets/logos/OpenStatus-Logo.svg`,
    },
    offers: Object.entries(allPlans).map(([_, value]) => ({
      "@type": "Offer",
      price: value.price.monthly.USD,
      name: value.title,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    })),
    aggregateRating: trustpilotAggregateRating,
    review: trustpilotReviews,
  };
};

export const getJsonLDSoftwareApplication =
  (): WithContext<SoftwareApplication> => {
    return {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "openstatus",
      url: BASE_URL,
      description:
        "The open-source status page and uptime monitoring platform trusted by growing teams.",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Status Pages & Uptime Monitoring",
      operatingSystem: "Web, Self-hosted",
      offers: Object.entries(allPlans).map(([_, value]) => ({
        "@type": "Offer",
        price: value.price.monthly.USD,
        name: value.title,
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      })),
      featureList: [
        "Branded status pages with custom domains",
        "Multi-region uptime monitoring from 28 locations",
        "Incident communication and subscriber notifications",
        "API monitoring (REST, GraphQL)",
        "SOC 2 compliance-ready",
        "Monitoring as code",
        "Self-hosting option",
        "Open-source",
      ],
      screenshot: `${BASE_URL}/assets/landing/dashboard.png`,
      aggregateRating: trustpilotAggregateRating,
      review: trustpilotReviews,
    };
  };

export const getJsonLDPerson = (item: {
  name: string;
  url?: string;
}): WithContext<Person> => {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: item.name,
    url: item.url,
  };
};

type ItemListEntry = { name: string; url: string; description?: string };

export function getJsonLDItemList(
  items: MDXData[],
  prefix: string,
): WithContext<CollectionPage>;
export function getJsonLDItemList(
  items: ItemListEntry[],
): WithContext<CollectionPage>;
export function getJsonLDItemList(
  items: MDXData[] | ItemListEntry[],
  prefix?: string,
): WithContext<CollectionPage> {
  // MDXData overload maps slug → URL via prefix; the entry overload carries
  // pre-resolved URLs (used where card href ≠ slug, e.g. docs section hubs).
  const entries: ItemListEntry[] =
    prefix !== undefined
      ? (items as MDXData[]).map((item) => ({
          name: item.metadata.title,
          url: `${BASE_URL}${prefix}/${item.slug}`,
          description: item.metadata.description,
        }))
      : (items as ItemListEntry[]);
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: entries.length,
      itemListElement: entries.map((entry, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: entry.url,
        name: entry.name,
        description: entry.description,
      })),
    },
  };
}

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

export function getJsonLDFAQPage(
  input: MDXData | { question: string; answer: string }[],
): WithContext<FAQPage> | null {
  const faq = Array.isArray(input) ? input : input.metadata.faq;
  if (!faq) {
    return null;
  }
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export const getJsonLDHowTo = (post: MDXData): WithContext<HowTo> | null => {
  if (!post.metadata.howto) {
    return null;
  }

  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: post.metadata.title,
    description: post.metadata.description,
    totalTime: post.metadata.howto.totalTime,
    step: post.metadata.howto.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
      image: step.image ?? undefined,
      url: step.url ?? undefined,
    })),
  };
};

/** Merge schema objects into a single `@graph`, stripping their per-item `@context`. */
export const createJsonLDGraph = (
  items: (WithContext<Thing> | null)[],
): Graph => {
  const graphItems = items
    .filter((item): item is WithContext<Thing> => item !== null)
    .map(
      (item) =>
        Object.fromEntries(
          Object.entries(item).filter(([key]) => key !== "@context"),
        ) as Thing,
    );

  return {
    "@context": "https://schema.org",
    "@graph": graphItems,
  };
};
