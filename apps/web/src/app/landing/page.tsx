import { CustomMDX } from "@/content/mdx";
import { getHomePage } from "@/content/utils";
import { getPageMetadata } from "../shared-metadata";
import { getJsonLDProduct, getJsonLDOrganization } from "../shared-metadata";
import type { Metadata } from "next";
import type { Organization, Product, WebPage, WithContext } from "schema-dts";

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

export function generateMetadata(): Metadata {
  const homePage = getHomePage();
  return getPageMetadata(homePage);
}

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
      <h1>{homePage.metadata.title}</h1>
      <p className="text-lg text-muted-foreground">
        {homePage.metadata.description}
      </p>
      <CustomMDX source={homePage.content} />
    </div>
  );
}
