import type { MDXData } from "@/content/utils";
import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type {
  BlogPosting,
  BreadcrumbList,
  FAQPage,
  HowTo,
  Organization,
  Person,
  Product,
  SoftwareApplication,
  Thing,
  WebPage,
  WithContext,
} from "schema-dts";
import { BASE_URL } from "./shared-metadata";

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
    url: "https://openstatus.dev",
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

export const getJsonLDSoftwareApplication =
  (): WithContext<SoftwareApplication> => {
    return {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "openstatus",
      url: "https://openstatus.dev",
      description:
        "Open-source uptime and synthetic monitoring with status pages.",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Monitoring & Observability",
      operatingSystem: "Web, Self-hosted",
      offers: Object.entries(allPlans).map(([_, value]) => ({
        "@type": "Offer",
        price: value.price.USD,
        name: value.title,
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      })),
      featureList: [
        "Multi-region uptime monitoring",
        "API monitoring (REST, GraphQL)",
        "Branded status pages",
        "Incident notifications (Slack, PagerDuty, email)",
        "Monitoring as code",
        "Self-hosting option",
        "Open-source",
      ],
      screenshot: "https://www.openstatus.dev/assets/landing/dashboard.png",
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

export function getJsonLDFAQPage(input: MDXData): WithContext<FAQPage> | null {
  if (!input.metadata.faq) {
    return null;
  }
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: input.metadata.faq.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
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
    totalTime: post.metadata.howto?.totalTime,
    step: post.metadata.howto?.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
      image: step.image ?? undefined,
      url: step.url ?? undefined,
    })),
  };
};

/**
 * Creates a unified JSON-LD graph from multiple schema objects
 * Combines multiple schemas into a single @graph structure
 *
 * @param items - Array of schema objects with @context
 * @returns A single schema object with @graph containing all items
 *
 * @example
 * const graph = createJsonLDGraph([
 *   getJsonLDWebPage(data),
 *   getJsonLDBlogPosting(data),
 *   getJsonLDFAQPage(faqs),
 * ]);
 */
export const createJsonLDGraph = (
  items: (WithContext<Thing> | null)[],
): { "@context": string; "@graph": unknown[] } => {
  const graphItems = items.filter(
    (item): item is WithContext<Thing> => item !== null,
  );

  return {
    "@context": "https://schema.org",
    "@graph": graphItems,
  };
};
