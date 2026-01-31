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

export const getJsonLDFAQPage = (
  faqs: Array<{ question: string; answer: string }>,
): WithContext<FAQPage> => {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
};

export const getJsonLDHowTo = (params: {
  title: string;
  description: string;
  steps: Array<{
    name: string;
    text: string;
    image?: string;
    url?: string;
  }>;
  totalTime?: string;
}): WithContext<HowTo> => {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: params.title,
    description: params.description,
    totalTime: params.totalTime,
    step: params.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
      image: step.image,
      url: step.url,
    })),
  };
};

// TODO: create the graph so that we only have to pass a single item
// to script the JSON-LD for the page
// export const createJsonLDGraph = (items: WithContext<object>[]): WithContext<Graph> => {}
