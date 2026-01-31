import { CustomMDX } from "@/content/mdx";
import { getHomePage } from "@/content/utils";
import { defaultMetadata } from "@/lib/metadata/shared-metadata";
import {
  getJsonLDFAQPage,
  getJsonLDOrganization,
  getJsonLDProduct,
} from "@/lib/metadata/structured-data";
import type { Metadata } from "next";
import type {
  FAQPage,
  Organization,
  Product,
  WebPage,
  WithContext,
} from "schema-dts";

const jsonLdProduct: WithContext<Product> = getJsonLDProduct();

const jsonLdOrganization: WithContext<Organization> = getJsonLDOrganization();

const jsonLDWebpage: WithContext<WebPage> = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "openstatus",
  description: "Open-source uptime and synthetic monitoring with status pages.",
  url: "https://openstatus.dev",
  image: "https://openstatus.dev/assets/logos/OpenStatus-Logo.svg",
  headline: "Showcase your uptime with a status page",
};

const jsonLDFAQPage: WithContext<FAQPage> = getJsonLDFAQPage([
  {
    question: "What are the free limits?",
    answer:
      "As free user you will start with a total of one monitor and one status page (incl. three page components) as well as cron jobs of min. 10m. You can upgrade to a paid plan at any time. No credit card is required to sign up and you can cancel at any time.",
  },
  {
    question: "Who are we?",
    answer:
      "We are Thibault and Max and we take you with us on our journey. Read more on our about page at https://www.openstatus.dev/about.",
  },
  {
    question: "How does it work?",
    answer:
      "We ping your endpoints from multiple regions to calculate uptime and display the current status on your status page. We also collect response time data like headers and timing phases and display it on your dashboard.",
  },
  {
    question: "What regions do we support?",
    answer:
      "We support monitoring from 28 regions worldwide across all continents: Europe (Amsterdam, Stockholm, Paris, Frankfurt, London), North America (Dallas, New Jersey, Los Angeles, San Jose, Chicago, Toronto), South America (São Paulo), Asia (Mumbai, Tokyo, Singapore), Africa (Johannesburg), and Oceania (Sydney).",
  },
  {
    question: "How can I help?",
    answer:
      "There are many ways you can help us: Spread the word by telling your friends and colleagues about OpenStatus, report bugs if you find them, suggest new features, contribute to the project if you are a developer, become a paid user if you are a business, or star our project on GitHub.",
  },
]);

export const metadata: Metadata = defaultMetadata;

export default function Page() {
  const homePage = getHomePage();
  return (
    <div className="prose dark:prose-invert max-w-none">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: jsonLd
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLdProduct).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: jsonLd
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLdOrganization).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: jsonLd
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLDWebpage).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: jsonLd
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLDFAQPage).replace(/</g, "\\u003c"),
        }}
      />
      <h1>{homePage.metadata.title}</h1>
      <p className="text-lg">{homePage.metadata.description}</p>
      <CustomMDX source={homePage.content} />
    </div>
  );
}
